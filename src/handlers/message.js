const { generateReply } = require("../ai/router");
const { sendText } = require("../utils/sender");
const { logger } = require("../utils/logger");
const { isHumanRequest, activateHumanHandoff, isHumanHandoffActive } = require("../inbox/handoff");
const { recordInteraction, markLeadAcquired } = require("../leads/followup");
const { notifyTelegram } = require("../leads/queue");
const { extractPhone } = require("../leads/extract");

/**
 * Handle incoming text messages — AI router (Dify Brain / LLM / RAG) + Human Handoff + Follow-up.
 */
async function handleMessage(page, senderId, message) {
  if (message.is_echo) {
    return;
  }

  const text = message.text || "";

  // 1. Check if human agent / admin has taken over
  if (isHumanHandoffActive(page.id, senderId)) {
    logger.info("bot_silenced_for_human", {
      pageId: page.id,
      senderId,
      text: text.slice(0, 100),
    });
    return;
  }

  // 2. Check if customer explicitly requests human agent
  if (isHumanRequest(text)) {
    logger.info("human_agent_requested_by_user", { pageId: page.id, senderId, text });
    activateHumanHandoff(page.id, senderId, 60, "user_request");

    const handoffReply = "Dạ em đã báo cho anh Sang và nhân viên phụ trách bên em rồi ạ! Anh/chị đợi bên em một chút xíu, chuyên viên bên em sẽ nhắn lại hỗ trợ trực tiếp cho mình ngay nhé ạ!";
    await sendText(page.id, page.accessToken, senderId, handoffReply);

    // Notify Telegram Admin immediately
    await notifyTelegram(
      `🚨 [YÊU CẦU GẶP NGƯỜI THẬT]\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🏢 Fanpage: ${page.name}\n` +
      `👤 Khách hàng (PSID): ${senderId}\n` +
      `💬 Nội dung: "${text}"\n` +
      `⏳ Bot đã tự động TẠM DỪNG 60 PHÚT để anh vào tiếp quản hội thoại.`
    );
    return;
  }

  logger.info("message_received", {
    pageId: page.id,
    projectSlug: page.projectSlug,
    strategy: page.replyStrategy,
    senderId,
    text: text.slice(0, 100),
  });

  // 3. Normal AI / Dify Brain response
  const { text: replyText, layer } = await generateReply(page, senderId, text);

  logger.info("message_reply", {
    pageId: page.id,
    senderId,
    layer,
    chars: replyText.length,
  });

  await sendText(page.id, page.accessToken, senderId, replyText);

  // 4. Record interaction for Ghosting Recovery Follow-up engine
  recordInteraction(page, senderId, text, replyText);

  // 5. If user provided phone, mark lead acquired
  if (extractPhone(text)) {
    markLeadAcquired(senderId);
  }
}

module.exports = { handleMessage };
