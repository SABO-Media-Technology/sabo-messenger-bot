const { generateReply } = require("../ai/router");
const { sendText } = require("../utils/sender");
const { logger } = require("../utils/logger");

/**
 * Handle incoming text messages — AI router (template / LLM / RAG).
 */
async function handleMessage(page, senderId, message) {
  if (message.is_echo) {
    return;
  }

  const text = message.text || "";
  logger.info("message_received", {
    pageId: page.id,
    projectSlug: page.projectSlug,
    strategy: page.replyStrategy,
    senderId,
    text: text.slice(0, 100),
  });

  const { text: replyText, layer } = await generateReply(page, senderId, text);

  logger.info("message_reply", {
    pageId: page.id,
    senderId,
    layer,
    chars: replyText.length,
  });

  await sendText(page.id, page.accessToken, senderId, replyText);
}

module.exports = { handleMessage };
