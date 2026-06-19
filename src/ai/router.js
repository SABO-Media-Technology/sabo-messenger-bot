const { matchTemplate } = require("./templates");
const { chatCompletion, isLlmConfigured } = require("./llm");
const { isHermesEnabled, chatHermes } = require("./hermes-client");
const {
  inspectCustomerInput,
  inspectCustomerOutput,
  buildCustomerSafeSalesReply,
  isHermesPolicyEnforcementError,
} = require("./customer-safe-guard");
const { fetchRagContext } = require("./rag");
const { getSystemPrompt, getHermesChannelPrompt } = require("../responses/prompts");
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
const { mergeLeadProfile, refusesName, asksForOwnPhone, deniesGivingPhone, isFrustration, hasVerifiedPhone, clearFalsePhone, isChurnIntent, isPageCorrectionIntent } = require("../leads/extract");
const {
  buildLeadPromptBlock,
  isLeadComplete,
  isPostQualify,
  markQualified,
  buildGreetingForSession,
} = require("../leads/flow");
const { getPageContract, getVerticalId } = require("../strategies/page-contracts");
const { fetchMessengerProfile, deriveHonorific, buildHonorificAddress } = require("../facebook/profile");
const { buildPostQualifyFallback, isCasualGreeting, buildChurnReply, buildPageCorrectionReply } = require("../leads/post-qualify-consult");
const { detectSalesIntent, buildDiscoveryReply, buildScopeReply, buildPreferenceReply } = require("../sales/discovery");
const {
  isPricingQuestion,
  isInPhoneCollectionFlow,
  buildPricingHandoffReply,
} = require("../sales/pricing-policy");
const { logger } = require("../utils/logger");

function buildPromptWithRag(basePrompt, ragContext) {
  if (!ragContext) return basePrompt;
  return `${basePrompt}

KIẾN THỨC THAM KHẢO (Brain RAG — ưu tiên nếu liên quan):
${ragContext}`;
}

function buildSalesIntentReply(page, sessionMeta, userText, intent) {
  if (intent === "scope") return buildScopeReply(page, sessionMeta, userText, "web-lead");
  if (intent === "preference") return buildPreferenceReply(page, sessionMeta, userText);
  if (intent === "discovery") return buildDiscoveryReply(page, sessionMeta, userText);
  return null;
}

function fallbackReply(page, profile, sessionMeta, userText = "") {
  const salesIntent = detectSalesIntent(userText);
  const salesReply = buildSalesIntentReply(page, sessionMeta, userText, salesIntent);
  if (salesReply) return salesReply;

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

function buildPhoneRecallReply(page, profile, sessionMeta) {
  const address = buildHonorificAddress(sessionMeta);
  const verticalId = getVerticalId(page);
  if (hasVerifiedPhone(profile)) {
    return `Dạ ${address}, em đang lưu SĐT ${profile.phone}. Anh/chị cần đổi số khác cứ nhắn em nhé!`;
  }
  if (verticalId === "ai-education") {
    return `Dạ ${address}, em chưa lưu SĐT của anh/chị. Nếu anh/chị muốn nhận tư vấn khóa học hoặc tài liệu, cho em xin SĐT hoặc Zalo nhé ạ?`;
  }
  return `Dạ ${address}, em chưa lưu SĐT của anh/chị. Cho em xin SĐT hoặc Zalo để team SABO liên hệ báo giá nhé ạ?`;
}

function buildPhoneDenialReply(page, sessionMeta) {
  const address = buildHonorificAddress(sessionMeta);
  const verticalId = getVerticalId(page);
  if (verticalId === "ai-education") {
    return `Dạ em xin lỗi ${address} — em nhầm, em chưa có SĐT của anh/chị. Cho em xin SĐT hoặc Zalo nếu anh/chị muốn nhận tư vấn khóa học nhé ạ?`;
  }
  return `Dạ em xin lỗi ${address} — em nhầm, em chưa có SĐT của anh/chị. Cho em xin SĐT hoặc Zalo để team liên hệ nhé ạ?`;
}

function buildFrustrationReply(page, profile, sessionMeta, userText) {
  const address = buildHonorificAddress(sessionMeta);
  const verticalId = getVerticalId(page);
  if (verticalId === "ai-education") {
    if (hasVerifiedPhone(profile)) {
      return `Dạ em xin lỗi ${address} — để em trả lời cụ thể hơn. Anh/chị muốn em gợi lộ trình học AI, giải thích ChatGPT, hay team gửi tài liệu qua Zalo/SĐT ạ?`;
    }
    return `Dạ em xin lỗi ${address} — em chưa lưu SĐT nên chưa hỗ trợ sát được. Anh/chị muốn em gợi lộ trình học AI trước, hay cho em xin SĐT/Zalo để gửi tài liệu ạ?`;
  }
  if (hasVerifiedPhone(profile)) {
    return `Dạ em xin lỗi ${address} — để em trả lời cụ thể hơn. Anh/chị muốn em gợi scope web, giải thích quy trình, hay team gửi báo giá qua Zalo/SĐT ạ?`;
  }
  return `Dạ em xin lỗi ${address} — em chưa lưu SĐT nên chưa báo giá sát được. Cho em xin SĐT/Zalo, hoặc anh/chị muốn em gợi scope web trước cũng được ạ?`;
}

function updateLeadFromMessage(page, senderId, userText, sessionMeta) {
  let meta = sessionMeta || getSessionMeta(page.id, senderId);
  if (refusesName(userText)) {
    meta = { ...meta, nameRefused: true };
    setSessionMeta(page.id, senderId, meta, page.projectSlug);
  }

  const contract = getPageContract(page);
  let prev = getLeadProfile(page.id, senderId);
  prev = clearFalsePhone(prev);

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
  const { profile, sessionMeta: meta } = updateLeadFromMessage(page, senderId, text, sessionMeta);
  const contract = getPageContract(page);
  const postQualify = isPostQualify(profile, contract, meta);
  const leadBlock = buildLeadPromptBlock(page, profile, meta);
  const tplCtx = templateContext(page, profile, meta);

  // Phone recall — ground truth from profile
  if (asksForOwnPhone(text)) {
    const phoneReply = buildPhoneRecallReply(page, profile, meta);
    recordReply(page, senderId, text, phoneReply);
    return { text: phoneReply, layer: "phone-recall" };
  }

  // User denies ever giving phone — clear false data, apologize
  if (deniesGivingPhone(text)) {
    const cleared = { ...profile, phone: null, qualified: false, queued: false };
    setLeadProfile(page.id, senderId, cleared, page.projectSlug);
    const denialReply = buildPhoneDenialReply(page, meta);
    recordReply(page, senderId, text, denialReply);
    return { text: denialReply, layer: "phone-denial" };
  }

  // Churn / disinterest — polite close, no scope essay
  if (isChurnIntent(text)) {
    const churnReply = buildChurnReply(page, meta, text);
    recordReply(page, senderId, text, churnReply);
    return { text: churnReply, layer: "churn-close" };
  }

  // User corrects page vertical — acknowledge + pivot to page contract
  if (isPageCorrectionIntent(text)) {
    const correctionReply = buildPageCorrectionReply(page, meta, text);
    recordReply(page, senderId, text, correctionReply);
    return { text: correctionReply, layer: "page-correction" };
  }

  // Frustration — apologize, offer concrete help
  if (isFrustration(text)) {
    const frustrationReply = buildFrustrationReply(page, profile, meta, text);
    recordReply(page, senderId, text, frustrationReply);
    return { text: frustrationReply, layer: "frustration-recovery" };
  }

  // Pricing handoff — no invented VND amounts (CEO policy)
  if (
    isPricingQuestion(text) &&
    !isInPhoneCollectionFlow(text, profile, page, meta)
  ) {
    const pricingReply = buildPricingHandoffReply(page, profile, meta);
    recordReply(page, senderId, text, pricingReply);
    maybeQueueLead(page, senderId, text, "pricing-handoff");
    return { text: pricingReply, layer: "pricing-handoff" };
  }

  // Scope request — concrete deliverables, not greeting
  const salesIntent = detectSalesIntent(text);
  if (salesIntent === "scope") {
    const scopeReply = buildScopeReply(page, meta, text, "web-lead");
    recordReply(page, senderId, text, scopeReply);
    maybeQueueLead(page, senderId, text, "sales-scope");
    return { text: scopeReply, layer: "sales-scope" };
  }

  // Vertical preference — e.g. "ưu tiên web thu lead" (no LLM needed)
  if (salesIntent === "preference") {
    const prefReply = buildPreferenceReply(page, meta, text);
    recordReply(page, senderId, text, prefReply);
    maybeQueueLead(page, senderId, text, "sales-preference");
    return { text: prefReply, layer: "sales-preference" };
  }

  // Uyển Nhi greeting on first contact / get started
  if (isGreetingLike(text) || isGetStartedLike(text)) {
    const history = getHistory(page.id, senderId);
    if (history.length === 0) {
      const greeting = buildGreetingForSession(page, meta);
      recordReply(page, senderId, text, greeting);
      maybeQueueLead(page, senderId, text, "greeting-intro");
      return { text: greeting, layer: "greeting-intro" };
    }
    if (postQualify && isCasualGreeting(text)) {
      const casual = buildPostQualifyFallback(page, profile, meta, text);
      recordReply(page, senderId, text, casual);
      return { text: casual, layer: "post-qualify-casual" };
    }
  }

  // Sales discovery — inspiring service ideas (not MVP/process essay)
  if (salesIntent === "discovery") {
    const discoveryReply = buildDiscoveryReply(page, meta, text);
    recordReply(page, senderId, text, discoveryReply);
    maybeQueueLead(page, senderId, text, "sales-discovery");
    return { text: discoveryReply, layer: "sales-discovery" };
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

  if (!isLlmConfigured() && !isHermesEnabled()) {
    const fb = fallbackReply(page, profile, meta, text);
    recordReply(page, senderId, text, fb);
    maybeQueueLead(page, senderId, text, postQualify ? "fallback-no-llm:consult" : "fallback-no-llm");
    maybeQueueCompleteLead(page, senderId, text, "fallback-no-llm", profile, meta);
    return { text: fb, layer: postQualify ? "fallback-no-llm:consult" : "fallback-no-llm" };
  }

  const history = getHistory(page.id, senderId);
  let llmSystemPrompt = getSystemPrompt(page, leadBlock);
  let hermesSystemPrompt = getHermesChannelPrompt(page, leadBlock);
  let layer = page.replyStrategy;

  try {
    if (page.replyStrategy === "rag-mini" || page.replyStrategy === "human-handoff") {
      const ragContext = await fetchRagContext(text, page);
      llmSystemPrompt = buildPromptWithRag(llmSystemPrompt, ragContext);
      hermesSystemPrompt = buildPromptWithRag(hermesSystemPrompt, ragContext);
      layer = ragContext ? "rag-mini" : "mini";
    } else if (page.replyStrategy === "sabo-mt") {
      const ragContext = await fetchRagContext(text, page);
      if (ragContext) {
        llmSystemPrompt = buildPromptWithRag(llmSystemPrompt, ragContext);
        hermesSystemPrompt = buildPromptWithRag(hermesSystemPrompt, ragContext);
        layer = "sabo-mt+rag";
      } else {
        layer = "sabo-mt";
      }
    }

    let reply;
    let replyVia = "llm";

    if (isHermesEnabled()) {
      try {
        reply = await chatHermes({
          page,
          senderId,
          systemPrompt: hermesSystemPrompt,
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

    if (!reply) {
      reply = await chatCompletion(
        llmSystemPrompt,
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
      const intentFallback = buildSalesIntentReply(page, meta, text, detectSalesIntent(text));
      reply = intentFallback || buildCustomerSafeSalesReply(page, postQualify ? "consult" : "intake");
      replyVia = intentFallback ? "sales-fallback" : "safe";
      layer = intentFallback ? `sales-intent-${detectSalesIntent(text)}` : "customer-safe-output-blocked";
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
