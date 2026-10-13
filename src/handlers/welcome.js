const { generateReply } = require("../ai/router");
const { sendText } = require("../utils/sender");
const { logger } = require("../utils/logger");
const { getGetStartedPayload } = require("../responses/greeting");
const { getHotline } = require("../hotline");

const POSTBACK_REPLIES = {
  // Hotline theo từng trang (bida: 0961 167 717, khác: 0798893333)
  CALL_SUPPORT: (page) => `Bạn có thể gọi hotline ${getHotline(page)} để được hỗ trợ nhanh nhất. Cảm ơn bạn!`,
  REQUEST_CONSULT: `Cảm ơn anh/chị! Để team SABO tư vấn sớm nhất, anh/chị cho em xin tên và SĐT hoặc email liên hệ nhé?`,
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
    const reply = POSTBACK_REPLIES[payload];
    const replyText = typeof reply === "function" ? reply(page) : reply;
    await sendText(page.id, page.accessToken, senderId, replyText);
    return;
  }

  const { text, layer } = await generateReply(page, senderId, payload);
  logger.info("unknown_postback", { pageId: page.id, senderId, payload, layer });
  await sendText(page.id, page.accessToken, senderId, text);
}

module.exports = { handlePostback, POSTBACK_REPLIES };
