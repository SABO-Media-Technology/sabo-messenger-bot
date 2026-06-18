const { matchTemplate } = require("./templates");
const { chatCompletion, isLlmConfigured } = require("./llm");
const { fetchRagContext } = require("./rag");
const { getSystemPrompt } = require("../responses/prompts");
const { getReplyText } = require("../responses/greeting");
const { detectLeadIntent } = require("./intent");
const { getHistory, appendTurn, getLeadProfile, setLeadProfile } = require("../session/store");
const { queueLeadEvent } = require("../leads/queue");
const { mergeLeadProfile } = require("../leads/extract");
const { buildLeadPromptBlock, isLeadComplete, getGreetingForPage } = require("../leads/flow");
const { getPageContract, getVerticalId } = require("../strategies/page-contracts");
const { logger } = require("../utils/logger");

function buildPromptWithRag(basePrompt, ragContext) {
  if (!ragContext) return basePrompt;
  return `${basePrompt}

KIẾN THỨC THAM KHẢO (Brain RAG — ưu tiên nếu liên quan):
${ragContext}`;
}

function fallbackReply(page) {
  return (
    getReplyText(page.id) ||
    `Cảm ơn anh/chị đã nhắn tin ${page.name}! Em ghi nhận rồi — cho em xin SĐT hoặc email để team SABO liên hệ sớm nhé?`
  );
}

function isGreetingLike(text) {
  return /^(xin chào|chào|hello|hi|hey|alo|dạ|shop ơi)/i.test((text || "").trim());
}

function isGetStartedLike(text) {
  return /tìm hiểu thêm|bắt đầu|get started/i.test(text || "");
}

function updateLeadFromMessage(page, senderId, userText) {
  const prev = getLeadProfile(page.id, senderId);
  const merged = mergeLeadProfile(prev, userText);
  setLeadProfile(page.id, senderId, merged);
  return merged;
}

function maybeQueueCompleteLead(page, senderId, userText, layer, profile) {
  const contract = getPageContract(page);
  if (profile.queued) return;
  if (!isLeadComplete(profile, contract) && !detectLeadIntent(userText) && page.tier !== "t2") {
    return;
  }
  if (!isLeadComplete(profile, contract)) return;

  const next = { ...profile, queued: true };
  setLeadProfile(page.id, senderId, next);

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

/**
 * Main reply pipeline — Layer 0 template → Layer 1/2 LLM (+ RAG) → fallback.
 */
async function generateReply(page, senderId, userText) {
  const text = (userText || "").trim();
  if (!text) {
    return { text: fallbackReply(page), layer: "fallback-empty" };
  }

  const profile = updateLeadFromMessage(page, senderId, text);
  const leadBlock = buildLeadPromptBlock(page, profile);

  // Uyển Nhi greeting on first contact / get started
  if (isGreetingLike(text) || isGetStartedLike(text)) {
    const history = getHistory(page.id, senderId);
    if (history.length === 0) {
      const greeting = getGreetingForPage(page);
      appendTurn(page.id, senderId, text, greeting);
      maybeQueueLead(page, senderId, text, "greeting-intro");
      return { text: greeting, layer: "greeting-intro" };
    }
  }

  // Layer 0
  const templateHit = matchTemplate(text, page);
  if (templateHit) {
    maybeQueueLead(page, senderId, text, "template");
    maybeQueueCompleteLead(page, senderId, text, "template", profile);
    return { text: templateHit, layer: "template" };
  }

  if (!isLlmConfigured()) {
    const fb = fallbackReply(page);
    maybeQueueLead(page, senderId, text, "fallback-no-llm");
    maybeQueueCompleteLead(page, senderId, text, "fallback-no-llm", profile);
    return { text: fb, layer: "fallback-no-llm" };
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

    const reply = await chatCompletion(systemPrompt, [
      ...history,
      { role: "user", content: text },
    ]);

    appendTurn(page.id, senderId, text, reply);
    maybeQueueLead(page, senderId, text, layer);
    maybeQueueCompleteLead(page, senderId, text, layer, getLeadProfile(page.id, senderId));

    if (page.replyStrategy === "human-handoff" && page.tier === "t2") {
      const alreadyHasHandoff = /team sabo billiards|sẽ liên hệ/i.test(reply);
      const handoffText = alreadyHasHandoff
        ? reply
        : `${reply}\n\n— Team SABO Billiards sẽ liên hệ sớm ạ.`;
      return { text: handoffText, layer: "human-handoff" };
    }

    return { text: reply, layer: `${layer}:${getVerticalId(page)}` };
  } catch (err) {
    logger.error("reply_generation_failed", {
      pageId: page.id,
      error: err.message,
    });
    const fb = fallbackReply(page);
    maybeQueueLead(page, senderId, text, "fallback-error");
    maybeQueueCompleteLead(page, senderId, text, "fallback-error", profile);
    return { text: fb, layer: "fallback-error" };
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

module.exports = { generateReply, maybeQueueLead };
