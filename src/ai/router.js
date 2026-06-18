const { matchTemplate } = require("./templates");
const { chatCompletion, isLlmConfigured } = require("./llm");
const { fetchRagContext } = require("./rag");
const { getSystemPrompt, HOTLINE } = require("../responses/prompts");
const { getReplyText } = require("../responses/greeting");
const { detectLeadIntent } = require("./intent");
const { getHistory, appendTurn } = require("../session/store");
const { queueLeadEvent } = require("../leads/queue");
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
    `Cảm ơn bạn đã nhắn tin ${page.name}! SABO sẽ phản hồi sớm. Hotline: ${page.hotline || HOTLINE}.`
  );
}

/**
 * Main reply pipeline — Layer 0 template → Layer 1/2 LLM (+ RAG) → fallback.
 */
async function generateReply(page, senderId, userText) {
  const text = (userText || "").trim();
  if (!text) {
    return { text: fallbackReply(page), layer: "fallback-empty" };
  }

  // Layer 0
  const templateHit = matchTemplate(text, page);
  if (templateHit) {
    maybeQueueLead(page, senderId, text, "template");
    return { text: templateHit, layer: "template" };
  }

  if (!isLlmConfigured()) {
    const fb = fallbackReply(page);
    maybeQueueLead(page, senderId, text, "fallback-no-llm");
    return { text: fb, layer: "fallback-no-llm" };
  }

  const history = getHistory(page.id, senderId);
  const basePrompt = getSystemPrompt(page);
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

    if (page.replyStrategy === "human-handoff" && page.tier === "t2") {
      const hotline = page.hotline || HOTLINE;
      const alreadyHasHandoff = /hotline|liên hệ trực tiếp|team sabo billiards/i.test(reply);
      const text = alreadyHasHandoff
        ? reply
        : `${reply}\n\n— Team SABO Billiards sẽ liên hệ trực tiếp. Hotline: ${hotline}.`;
      return { text, layer: "human-handoff" };
    }

    return { text: reply, layer };
  } catch (err) {
    logger.error("reply_generation_failed", {
      pageId: page.id,
      error: err.message,
    });
    const fb = fallbackReply(page);
    maybeQueueLead(page, senderId, text, "fallback-error");
    return { text: fb, layer: "fallback-error" };
  }
}

function maybeQueueLead(page, senderId, userText, layer) {
  const shouldQueue =
    detectLeadIntent(userText) ||
    page.tier === "t2" ||
    page.replyStrategy === "human-handoff";

  if (!shouldQueue) return;

  queueLeadEvent({ page, senderId, userText, replyLayer: layer }).catch((err) => {
    logger.warn("lead_queue_async_failed", { error: err.message });
  });
}

module.exports = { generateReply, maybeQueueLead };
