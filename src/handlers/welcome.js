const { generateReply } = require("../ai/router");
const { sendText } = require("../utils/sender");
const { logger } = require("../utils/logger");
const { getGetStartedPayload } = require("../responses/greeting");
const { HOTLINE } = require("../responses/prompts");

const POSTBACK_REPLIES = {
  CALL_SUPPORT: `Bạn có thể gọi hotline ${HOTLINE} để được hỗ trợ nhanh nhất. Cảm ơn bạn!`,
  REQUEST_CONSULT: `Cảm ơn bạn! Đội ngũ SABO sẽ liên hệ tư vấn sớm nhất. Hotline: ${HOTLINE}`,
};

/**
 * Handle postback events (Get Started, Persistent Menu).
 */
async function handlePostback(page, senderId, payload) {
  const getStartedPayload = getGetStartedPayload();

  if (payload === getStartedPayload) {
    const { text, layer } = await generateReply(
      page,
      senderId,
      "Xin chào, tôi muốn tìm hiểu thêm",
    );
    logger.info("get_started_triggered", { pageId: page.id, senderId, layer });
    await sendText(page.id, page.accessToken, senderId, text);
    return;
  }

  if (POSTBACK_REPLIES[payload]) {
    logger.info("postback_handled", { pageId: page.id, senderId, payload });
    await sendText(page.id, page.accessToken, senderId, POSTBACK_REPLIES[payload]);
    return;
  }

  const { text, layer } = await generateReply(page, senderId, payload);
  logger.info("unknown_postback", { pageId: page.id, senderId, payload, layer });
  await sendText(page.id, page.accessToken, senderId, text);
}

module.exports = { handlePostback, POSTBACK_REPLIES };
