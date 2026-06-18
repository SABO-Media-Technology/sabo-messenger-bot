const { matchTemplate } = require("./templates");
const { chatCompletion, isLlmConfigured } = require("./llm");
const { fetchRagContext } = require("./rag");
const { getSystemPrompt } = require("../responses/prompts");
const { getReplyText } = require("../responses/greeting");
const { detectLeadIntent } = require("./intent");
const {
  getHistory,
  appendTurn,
  getLeadProfile,
  setLeadProfile,
  getSessionMeta,
  setSessionMeta,
  hydrateThread,
} = require("../session/store");
const { queueLeadEvent } = require("../leads/queue");
const { mergeLeadProfile, refusesName } = require("../leads/extract");
const {
  buildLeadPromptBlock,
  isLeadComplete,
  isPostQualify,
  markQualified,
  buildGreetingForSession,
} = require("../leads/flow");
const { getPageContract, getVerticalId } = require("../strategies/page-contracts");
const { fetchMessengerProfile, deriveHonorific, buildHonorificAddress } = require("../facebook/profile");
const { buildPostQualifyFallback } = require("../leads/post-qualify-consult");
const { logger } = require("../utils/logger");

function buildPromptWithRag(basePrompt, ragContext) {
  if (!ragContext) return basePrompt;
  return `${basePrompt}

KIẾN THỨC THAM KHẢO (Brain RAG — ưu tiên nếu liên quan):
${ragContext}`;
}

function fallbackReply(page, profile, sessionMeta, userText = "") {
  if (profile && sessionMeta) {
    const contract = getPageContract(page);
    if (isPostQualify(profile, contract, sessionMeta)) {
      return buildPostQualifyFallback(page, profile, sessionMeta, userText);
    }
  }
  return (
    getReplyText(page.id) ||
    `Cảm ơn anh/chị đã nhắn tin ${page.name}! Em ghi nhận rồi — cho em xin SĐT hoặc Zalo để team SABO liên hệ sớm nhé?`
  );
}

function isGreetingLike(text) {
  return /^(xin chào|chào|hello|hi|hey|alo|dạ|shop ơi)/i.test((text || "").trim());
}

function isGetStartedLike(text) {
  return /tìm hiểu thêm|bắt đầu|get started/i.test(text || "");
}

/**
 * Fetch FB profile on first contact; auto-fill lead name from Graph API.
 */
async function ensureSessionProfile(page, senderId) {
  const existing = getSessionMeta(page.id, senderId);
  if (existing.fbProfileFetched) return existing;

  const fb = await fetchMessengerProfile(senderId, page.accessToken);
  const meta = {
    profileName: fb?.name || null,
    firstName: fb?.first_name || null,
    honorific: deriveHonorific(fb),
    nameRefused: false,
    fbProfileFetched: true,
  };
  setSessionMeta(page.id, senderId, meta, page.projectSlug);

  if (meta.profileName) {
    const profile = getLeadProfile(page.id, senderId);
    if (!profile.name) {
      setLeadProfile(page.id, senderId, { ...profile, name: meta.profileName }, page.projectSlug);
    }
  }

  return getSessionMeta(page.id, senderId);
}

function updateLeadFromMessage(page, senderId, userText, sessionMeta) {
  let meta = sessionMeta || getSessionMeta(page.id, senderId);
  if (refusesName(userText)) {
    meta = { ...meta, nameRefused: true };
    setSessionMeta(page.id, senderId, meta, page.projectSlug);
  }

  const contract = getPageContract(page);
  const prev = getLeadProfile(page.id, senderId);
  const merged = markQualified(mergeLeadProfile(prev, userText), contract, meta);
  if (meta.profileName && !merged.name && !meta.nameRefused) {
    merged.name = meta.profileName;
  }
  setLeadProfile(page.id, senderId, merged, page.projectSlug);
  return { profile: merged, sessionMeta: meta };
}

function maybeQueueCompleteLead(page, senderId, userText, layer, profile, sessionMeta) {
  const contract = getPageContract(page);
  if (profile.queued) return;
  if (!isLeadComplete(profile, contract, sessionMeta) && !detectLeadIntent(userText) && page.tier !== "t2") {
    return;
  }
  if (!isLeadComplete(profile, contract, sessionMeta)) return;

  const next = { ...profile, queued: true, qualified: true };
  setLeadProfile(page.id, senderId, next, page.projectSlug);

  queueLeadEvent({
    page,
    senderId,
    userText,
    replyLayer: layer,
    profile: next,
  }).catch((err) => {
    logger.warn("lead_queue_async_failed", { error: err.message });
  });
}

function templateContext(page, profile, sessionMeta) {
  const contract = getPageContract(page);
  return {
    profile,
    sessionMeta,
    postQualify: isPostQualify(profile, contract, sessionMeta),
  };
}

function recordReply(page, senderId, userText, replyText) {
  appendTurn(page.id, senderId, userText, replyText, page.projectSlug);
}

/**
 * Main reply pipeline — Layer 0 template → Layer 1/2 LLM (+ RAG) → fallback.
 */
async function generateReply(page, senderId, userText) {
  const text = (userText || "").trim();
  if (!text) {
    return { text: fallbackReply(page), layer: "fallback-empty" };
  }

  await hydrateThread(page.id, senderId, page.projectSlug);
  const sessionMeta = await ensureSessionProfile(page, senderId);
  const { profile, sessionMeta: meta } = updateLeadFromMessage(page, senderId, text, sessionMeta);
  const contract = getPageContract(page);
  const postQualify = isPostQualify(profile, contract, meta);
  const leadBlock = buildLeadPromptBlock(page, profile, meta);
  const tplCtx = templateContext(page, profile, meta);

  // Uyển Nhi greeting on first contact / get started
  if (isGreetingLike(text) || isGetStartedLike(text)) {
    const history = getHistory(page.id, senderId);
    if (history.length === 0) {
      const greeting = buildGreetingForSession(page, meta);
      recordReply(page, senderId, text, greeting);
      maybeQueueLead(page, senderId, text, "greeting-intro");
      return { text: greeting, layer: "greeting-intro" };
    }
  }

  // Layer 0 — skip canned templates after first exchange (LLM = real sales dialog)
  const historyForTpl = getHistory(page.id, senderId);
  const skipIntakeTemplates =
    historyForTpl.length > 0 &&
    (page.replyStrategy === "sabo-mt" || page.replyStrategy === "rag-mini");

  const templateHit = skipIntakeTemplates ? null : matchTemplate(text, page, tplCtx);
  if (templateHit) {
    recordReply(page, senderId, text, templateHit);
    maybeQueueLead(page, senderId, text, "template");
    maybeQueueCompleteLead(page, senderId, text, "template", profile, meta);
    return { text: templateHit, layer: postQualify ? "template-post-qualify" : "template" };
  }

  if (!isLlmConfigured()) {
    const fb = fallbackReply(page, profile, meta, text);
    recordReply(page, senderId, text, fb);
    maybeQueueLead(page, senderId, text, postQualify ? "fallback-no-llm:consult" : "fallback-no-llm");
    maybeQueueCompleteLead(page, senderId, text, "fallback-no-llm", profile, meta);
    return { text: fb, layer: postQualify ? "fallback-no-llm:consult" : "fallback-no-llm" };
  }

  const history = getHistory(page.id, senderId);
  const basePrompt = getSystemPrompt(page, leadBlock);
  let layer = page.replyStrategy;

  try {
    let systemPrompt = basePrompt;

    if (page.replyStrategy === "rag-mini" || page.replyStrategy === "human-handoff") {
      const ragContext = await fetchRagContext(text, page);
      systemPrompt = buildPromptWithRag(basePrompt, ragContext);
      layer = ragContext ? "rag-mini" : "mini";
    } else if (page.replyStrategy === "sabo-mt") {
      const ragContext = await fetchRagContext(text, page);
      if (ragContext) {
        systemPrompt = buildPromptWithRag(basePrompt, ragContext);
        layer = "sabo-mt+rag";
      } else {
        layer = "sabo-mt";
      }
    }

    const reply = await chatCompletion(
      systemPrompt,
      [...history, { role: "user", content: text }],
      { temperature: postQualify ? 0.65 : 0.5 },
    );

    recordReply(page, senderId, text, reply);
    maybeQueueLead(page, senderId, text, layer);
    maybeQueueCompleteLead(
      page,
      senderId,
      text,
      layer,
      getLeadProfile(page.id, senderId),
      getSessionMeta(page.id, senderId),
    );

    if (page.replyStrategy === "human-handoff" && page.tier === "t2") {
      const alreadyHasHandoff = /team sabo billiards|sẽ liên hệ/i.test(reply);
      const handoffText = alreadyHasHandoff
        ? reply
        : `${reply}\n\n— Team SABO Billiards sẽ liên hệ sớm ạ.`;
      return { text: handoffText, layer: "human-handoff" };
    }

    const modeTag = postQualify ? "consult" : "intake";
    return { text: reply, layer: `${layer}:${getVerticalId(page)}:${modeTag}` };
  } catch (err) {
    logger.error("reply_generation_failed", {
      pageId: page.id,
      error: err.message,
    });
    const fb = fallbackReply(page, profile, meta, text);
    recordReply(page, senderId, text, fb);
    maybeQueueLead(page, senderId, text, postQualify ? "fallback-error:consult" : "fallback-error");
    maybeQueueCompleteLead(page, senderId, text, "fallback-error", profile, meta);
    return { text: fb, layer: postQualify ? "fallback-error:consult" : "fallback-error" };
  }
}

function maybeQueueLead(page, senderId, userText, layer) {
  const shouldQueue =
    detectLeadIntent(userText) ||
    page.tier === "t2" ||
    page.replyStrategy === "human-handoff";

  if (!shouldQueue) return;

  const profile = getLeadProfile(page.id, senderId);
  queueLeadEvent({ page, senderId, userText, replyLayer: layer, profile }).catch((err) => {
    logger.warn("lead_queue_async_failed", { error: err.message });
  });
}

module.exports = { generateReply, maybeQueueLead, ensureSessionProfile };
