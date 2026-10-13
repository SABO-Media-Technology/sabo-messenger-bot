const axios = require("axios");
const { chatDify } = require("../ai/dify-client");
const { logger } = require("../utils/logger");
const { enqueueLead } = require("../leads/queue");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8699543277:AAHVt2BKusI4efsohp5Nh1M_XnYjI0BZB7c";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "554888288";

let isPolling = false;
let lastUpdateId = 0;
const conversationMap = new Map(); // chatId -> difyConversationId

async function sendTelegramMessage(chatId, text, replyToMessageId = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown"
    };
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }
    await axios.post(`${TELEGRAM_API}/sendMessage`, payload, { timeout: 10000 });
  } catch (err) {
    // If Markdown parsing fails, retry with plain text
    try {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: text
      }, { timeout: 10000 });
    } catch (e) {
      logger.error("telegram_send_fail", { error: e.message, chatId });
    }
  }
}

async function handleTelegramMessage(message) {
  if (!message || !message.text) return;
  const chatId = String(message.chat.id);
  const userText = message.text.trim();
  const userName = [message.from.first_name, message.from.last_name].filter(Boolean).join(" ") || message.from.username || "Khách Telegram";

  logger.info("telegram_message_received", { chatId, userName, text: userText });

  // Handle /start command
  if (userText === "/start") {
    const welcome = `Dạ em chào anh/chị ${userName}! Em là **Uyển Nhi** — trợ lý vận hành và phát triển giải pháp Bida SABO Arena & SABO M&T.\n\nAnh/chị đang quan tâm đến giải đấu bida, ELO, hay cần tư vấn mở CLB bida / làm phần mềm cứ nhắn em hỗ trợ ngay nhé ạ! 🎱✨`;
    await sendTelegramMessage(chatId, welcome);
    return;
  }

  // Founder Executive Commands (Only for Founder Long Sang)
  if (chatId === ADMIN_CHAT_ID) {
    if (userText === "/briefing" || userText === "/status") {
      await sendTelegramMessage(chatId, "⏳ Dạ em đang tổng hợp báo cáo thời gian thực toàn hệ thống gửi Anh ngay ạ...");
      try {
        await axios.post("http://127.0.0.1:3106/api/executive/briefing", {}, { timeout: 15000 });
      } catch (err) {
        await sendTelegramMessage(chatId, "❌ Lỗi kết nối bộ phận tổng hợp: " + err.message);
      }
      return;
    }

    if (userText.startsWith("/marketing") || userText.startsWith("/content")) {
      await sendTelegramMessage(chatId, "🎬 Dạ em đang kích hoạt Dify Content Studio để tạo bài viết đa kênh và nạp vào Postiz. Bài viết sẽ được gửi cho Anh duyệt ngay khi hoàn tất ạ!");
      try {
        await axios.post("http://127.0.0.1:3106/api/marketing/generate", {}, { timeout: 15000 });
      } catch (err) {
        await sendTelegramMessage(chatId, "❌ Lỗi tạo nội dung: " + err.message);
      }
      return;
    }

    if (userText === "/help" || userText === "/menu") {
      const adminHelp = `👑 **LỆNH ĐIỀU HÀNH DÀNH RIÊNG CHO FOUNDER LONG SANG:**\n\n` +
        `• \`/briefing\` hoặc \`/status\`: Báo cáo 360° sức khỏe toàn hệ thống (Leads mới, CRM, Ticket Paperclip, PM2, RAM/Disk).\n` +
        `• \`/marketing\`: Tự động viết bộ nội dung bida viral (TikTok + Facebook + Threads) và xếp lịch vào Postiz.\n` +
        `• Ngoài ra Anh có thể chat bình thường để kiểm tra chất lượng tư vấn của Uyển Nhi bất kỳ lúc nào ạ! 🚀`;
      await sendTelegramMessage(chatId, adminHelp);
      return;
    }
  }

  // Virtual Page identity for SABO Arena
  const mockPage = {
    id: "telegram_bot",
    name: "SABO Arena Telegram",
    projectSlug: "sabo-arena"
  };

  const existingConvId = conversationMap.get(chatId) || null;

  try {
    // Send typing action
    axios.post(`${TELEGRAM_API}/sendChatAction`, { chat_id: chatId, action: "typing" }).catch(() => {});

    const difyRes = await chatDify({
      page: mockPage,
      senderId: chatId,
      userText,
      conversationId: existingConvId
    });

    if (difyRes.conversationId) {
      conversationMap.set(chatId, difyRes.conversationId);
    }

    await sendTelegramMessage(chatId, difyRes.answer, message.message_id);

    // Check for phone/email lead
    const phoneMatch = userText.match(/(?:(?:\+?84)|0)(?:3[2-9]|5[689]|7[06-9]|8[1-9]|9\d)\d{7}/);
    if (phoneMatch) {
      enqueueLead({
        pageId: "telegram_bot",
        pageName: "Telegram @lssystems_bot",
        senderId: chatId,
        customerName: userName,
        userMessage: userText,
        botReply: difyRes.answer,
        confidence: 0.95
      }).catch(err => logger.error("telegram_enqueue_lead_err", { error: err.message }));
    }

  } catch (err) {
    logger.error("telegram_dify_error", { error: err.message });
    await sendTelegramMessage(chatId, "Dạ em xin lỗi, hệ thống đang bận cập nhật dữ liệu một chút. Anh/chị đợi em 1 phút hoặc nhắn hotline 090.898.3478 nhé ạ! 🙏");
  }
}

async function pollUpdates() {
  if (!isPolling) return;

  try {
    const response = await axios.get(`${TELEGRAM_API}/getUpdates`, {
      params: {
        offset: lastUpdateId + 1,
        timeout: 25
      },
      timeout: 30000
    });

    if (response.data && response.data.ok) {
      const updates = response.data.result || [];
      for (const update of updates) {
        lastUpdateId = update.update_id;
        if (update.message) {
          await handleTelegramMessage(update.message);
        }
      }
    }
  } catch (err) {
    if (err.code !== "ECONNABORTED" && err.response?.status !== 502) {
      logger.warn("telegram_polling_error", { error: err.message });
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  if (isPolling) {
    setImmediate(pollUpdates);
  }
}

function startTelegramBot() {
  if (process.env.ENABLE_TELEGRAM_BOT !== "true") {
    logger.info("telegram_bot_disabled", { hint: "Set ENABLE_TELEGRAM_BOT=true to enable Telegram polling" });
    return;
  }
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn("telegram_bot_disabled_no_token");
    return;
  }
  isPolling = true;
  logger.info("telegram_bot_started", { token: TELEGRAM_BOT_TOKEN.slice(0, 10) + "..." });
  pollUpdates();
}

function stopTelegramBot() {
  isPolling = false;
  logger.info("telegram_bot_stopped");
}

module.exports = {
  startTelegramBot,
  stopTelegramBot,
  sendTelegramMessage
};
