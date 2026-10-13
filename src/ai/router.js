/**
 * Thin bot router — input → safe? → pricing? → phone-recall? → LLM(prompt+history) → output safe? → send
 */
const { chatCompletion, isLlmConfigured } = require("./llm");
const { isHermesEnabled, chatHermes } = require("./hermes-client");
const { chatDify, isDifyEnabled, selectDifyAppToken } = require("./dify-client");
const {
  inspectCustomerInput,
  inspectCustomerOutput,
  buildCustomerSafeSalesReply,
  isHermesPolicyEnforcementError,
} = require("./customer-safe-guard");
const { fetchRagContext } = require("./rag");
const { buildSystemPrompt, buildPhoneRecallReply } = require("./prompt-builder");
const { getReplyText } = require("../responses/greeting");
const {
  getHistory,
  appendTurn,
  getLeadProfile,
  setLeadProfile,
  getSessionMeta,
  setSessionMeta,
  hydrateThread,
} = require("../session/store");
const { detectLeadIntent } = require("./intent");
const { queueLeadEvent } = require("../leads/queue");
const {
  mergeLeadProfile,
  refusesName,
  asksForOwnPhone,
  deniesGivingPhone,
  clearFalsePhone,
  hasVerifiedPhone,
} = require("../leads/extract");
const { detectServicesQuestion, buildDiscoveryReply } = require("../sales/discovery");
const { buildPostQualifyFallback } = require("../leads/post-qualify-consult");
const {
  isLeadComplete,
  markQualified,
  buildGreetingForSession,
  isPostQualify,
} = require("../leads/flow");
const { getPageContract, getVerticalId } = require("../strategies/page-contracts");
const { fetchMessengerProfile, deriveHonorific } = require("../facebook/profile");
const {
  isPricingQuestion,
  isInPhoneCollectionFlow,
  buildPricingHandoffReply,
} = require("../sales/pricing-policy");
const { logger } = require("../utils/logger");

function isGreetingLike(text) {
  return /^(xin chào|chào|hello|hi|hey|alo|dạ|shop ơi)\b/i.test((text || "").trim());
}

function isGetStartedLike(text) {
  return /tìm hiểu thêm|bắt đầu|get started/i.test(text || "");
}

function fallbackReply(page, profile, sessionMeta, userText) {
  const text = (userText || "").trim();

  if (text && detectServicesQuestion(text)) {
    return buildDiscoveryReply(page, sessionMeta || {}, text);
  }

  if (profile && hasVerifiedPhone(profile)) {
    if (text) {
      const contextual = buildPostQualifyFallback(page, profile, sessionMeta || {}, text);
      if (contextual && !/cho em xin sđt|cho em xin email/i.test(contextual)) {
        return contextual;
      }
    }
    return `Cảm ơn anh/chị đã nhắn tin ${page.name}! Team SABO đã có SĐT — sẽ liên hệ báo sát hơn ạ.`;
  }

  return (
    getReplyText(page.id) ||
    `Cảm ơn anh/chị đã nhắn tin ${page.name}! Em ghi nhận rồi — cho em xin SĐT hoặc Zalo để team SABO liên hệ sớm nhé?`
  );
}

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

function syncLead(page, senderId, userText, sessionMeta) {
  let meta = sessionMeta || getSessionMeta(page.id, senderId);
  if (refusesName(userText)) {
    meta = { ...meta, nameRefused: true };
    setSessionMeta(page.id, senderId, meta, page.projectSlug);
  }

  const contract = getPageContract(page);
  let prev = clearFalsePhone(getLeadProfile(page.id, senderId));

  if (deniesGivingPhone(userText)) {
    prev = { ...prev, phone: null, qualified: false, queued: false };
  }

  const merged = markQualified(mergeLeadProfile(prev, userText), contract, meta);
  if (meta.profileName && !merged.name && !meta.nameRefused) {
    merged.name = meta.profileName;
  }
  setLeadProfile(page.id, senderId, merged, page.projectSlug);
  return { profile: merged, sessionMeta: meta };
}

function recordReply(page, senderId, userText, replyText) {
  appendTurn(page.id, senderId, userText, replyText, page.projectSlug);
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

async function generateReply(page, senderId, userText) {
  const text = (userText || "").trim();
  if (!text) {
    return { text: fallbackReply(page, null, null, ""), layer: "fallback-empty" };
  }

  const inputGuard = inspectCustomerInput(text);
  if (inputGuard.blocked) {
    const safeReply = buildCustomerSafeSalesReply(page, "intake");
    recordReply(page, senderId, text, safeReply);
    logger.warn("customer_safe_input_blocked", {
      pageId: page.id,
      senderId,
      reason: inputGuard.reason,
    });
    return { text: safeReply, layer: "customer-safe-input-blocked" };
  }

  await hydrateThread(page.id, senderId, page.projectSlug);
  const sessionMeta = await ensureSessionProfile(page, senderId);
  const { profile, sessionMeta: meta } = syncLead(page, senderId, text, sessionMeta);
  const contract = getPageContract(page);
  const postQualify = isPostQualify(profile, contract, meta);

  if (asksForOwnPhone(text) && !deniesGivingPhone(text)) {
    const phoneReply = buildPhoneRecallReply(page, profile, meta);
    recordReply(page, senderId, text, phoneReply);
    maybeQueueLead(page, senderId, text, "phone-recall");
    return { text: phoneReply, layer: "phone-recall" };
  }

  if (isPricingQuestion(text) && !isInPhoneCollectionFlow(text, profile, page, meta)) {
    const pricingReply = buildPricingHandoffReply(page, profile, meta);
    recordReply(page, senderId, text, pricingReply);
    maybeQueueLead(page, senderId, text, "pricing-handoff");
    maybeQueueCompleteLead(page, senderId, text, "pricing-handoff", profile, meta);
    return { text: pricingReply, layer: "pricing-handoff" };
  }

  if (detectServicesQuestion(text)) {
    const discoveryReply = buildDiscoveryReply(page, meta, text);
    recordReply(page, senderId, text, discoveryReply);
    maybeQueueLead(page, senderId, text, "sales-discovery");
    maybeQueueCompleteLead(page, senderId, text, "sales-discovery", profile, meta);
    return { text: discoveryReply, layer: "sales-discovery" };
  }

  const history = getHistory(page.id, senderId);
  if ((isGreetingLike(text) || isGetStartedLike(text)) && history.length === 0) {
    const greeting = buildGreetingForSession(page, meta);
    recordReply(page, senderId, text, greeting);
    maybeQueueLead(page, senderId, text, "greeting");
    return { text: greeting, layer: "greeting" };
  }

  if (!isLlmConfigured() && !isHermesEnabled()) {
    const fb = fallbackReply(page, profile, meta, text);
    recordReply(page, senderId, text, fb);
    maybeQueueLead(page, senderId, text, "fallback-no-llm");
    maybeQueueCompleteLead(page, senderId, text, "fallback-no-llm", profile, meta);
    return { text: fb, layer: "fallback-no-llm" };
  }

  const replyMode = (process.env.CUSTOMER_REPLY_MODE || "dify").toLowerCase();

  // If set explicitly to intake-only, use fixed safe template
  if (replyMode === "intake-only") {
    const intake = buildCustomerSafeSalesReply(page, "intake");
    recordReply(page, senderId, text, intake);
    maybeQueueLead(page, senderId, text, "intake-only");
    maybeQueueCompleteLead(page, senderId, text, "intake-only", profile, meta);
    return { text: intake, layer: `intake-only:${getVerticalId(page)}` };
  }

  let ragContext = null;
  if (
    page.replyStrategy === "rag-mini" ||
    page.replyStrategy === "sabo-mt" ||
    page.replyStrategy === "human-handoff"
  ) {
    ragContext = await fetchRagContext(text, page);
  }

  const systemPrompt = buildSystemPrompt({ page, sessionMeta: meta, leadProfile: profile, ragContext });
  let layer = ragContext ? `${page.replyStrategy}+rag` : page.replyStrategy;
  let reply;
  let replyVia = "llm";

  try {
    // 1. Primary Knowledge Brain: Dify (SSoT Vertex AI Datasets)
    if (replyMode === "dify" && isDifyEnabled()) {
      try {
        const botTarget = selectDifyAppToken(page, text);
        const convId = meta.difyConversations?.[botTarget.botKey] || null;

        const difyRes = await chatDify({
          page,
          senderId,
          userText: text,
          conversationId: convId,
        });
        if (difyRes?.answer) {
          reply = difyRes.answer;
          replyVia = "dify";
          layer = `dify:${difyRes.domain}`;
          if (difyRes.conversationId) {
            meta.difyConversations = meta.difyConversations || {};
            meta.difyConversations[difyRes.botKey] = difyRes.conversationId;
            setSessionMeta(page.id, senderId, meta, page.projectSlug);
          }
        }
      } catch (difyErr) {
        logger.warn("dify_chat_failover", { pageId: page.id, error: difyErr.message });
      }
    }

    // 2. Secondary: Hermes Gateway
    if (!reply && isHermesEnabled()) {
      try {
        reply = await chatHermes({
          page,
          senderId,
          systemPrompt,
          history,
          userText: text,
          temperature: postQualify ? 0.72 : 0.55,
        });
        replyVia = "hermes";
        layer = `hermes-${layer}`;
      } catch (hermesErr) {
        logger.warn("hermes_failover", { pageId: page.id, error: hermesErr.message });
        if (isHermesPolicyEnforcementError(hermesErr)) {
          reply = buildCustomerSafeSalesReply(page, postQualify ? "consult" : "intake");
          replyVia = "safe";
          layer = "customer-safe-hermes-policy";
        }
      }
    }

    // 3. Fallback: Direct LLM (Ollama / Groq / OpenAI)
    if (!reply && isLlmConfigured()) {
      reply = await chatCompletion(
        systemPrompt,
        [...history, { role: "user", content: text }],
        { temperature: postQualify ? 0.72 : 0.55 },
      );
    }

    const outputGuard = inspectCustomerOutput(reply);
    if (outputGuard.blocked) {
      logger.warn("customer_safe_output_blocked", {
        pageId: page.id,
        senderId,
        reason: outputGuard.reason,
      });
      reply = buildCustomerSafeSalesReply(page, postQualify ? "consult" : "intake");
      replyVia = "safe";
      layer = `customer-safe-output-blocked:${getVerticalId(page)}:safe`;
    }

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
    return { text: reply, layer: `${layer}:${getVerticalId(page)}:${modeTag}:${replyVia}` };
  } catch (err) {
    logger.error("reply_generation_failed", {
      pageId: page.id,
      error: err.message,
    });
    const fb = fallbackReply(page, profile, meta, text);
    recordReply(page, senderId, text, fb);
    maybeQueueLead(page, senderId, text, "fallback-error");
    maybeQueueCompleteLead(page, senderId, text, "fallback-error", profile, meta);
    return { text: fb, layer: "fallback-error" };
  }
}

module.exports = { generateReply, maybeQueueLead, ensureSessionProfile };
