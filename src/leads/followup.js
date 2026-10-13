/**
 * Follow-up Engine — Ghosting Recovery.
 * Automatically sends a gentle, natural check-in after 15 minutes of customer inactivity.
 */

const { logger } = require("../utils/logger");
const { sendText } = require("../utils/sender");
const { isHumanHandoffActive } = require("../inbox/handoff");

// Map: senderId -> { page, lastInteractionTime, userText, botText, followUpSent: boolean, leadCaptured: boolean }
const activeConversations = new Map();

const INACTIVITY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FOLLOWUP_WINDOW_MS = 120 * 60 * 1000; // 2 hours max window

/**
 * Record an interaction between user and bot
 */
function recordInteraction(page, senderId, userText, botText) {
  const existing = activeConversations.get(senderId) || {};
  activeConversations.set(senderId, {
    page,
    lastInteractionTime: Date.now(),
    userText,
    botText,
    followUpSent: existing.followUpSent || false,
    leadCaptured: existing.leadCaptured || false,
  });
}

/**
 * Mark a user as having provided a lead (so we don't send follow-up)
 */
function markLeadAcquired(senderId) {
  const conv = activeConversations.get(senderId);
  if (conv) {
    conv.leadCaptured = true;
  }
}

/**
 * Generate humanized follow-up text tailored to page vertical
 */
function getFollowupMessage(page) {
  const slug = (page.slug || "").toLowerCase();
  const projectSlug = (page.projectSlug || "").toLowerCase();

  if (slug.includes("billiard") || projectSlug.includes("arena")) {
    return "Dạ anh ơi, quán mình đang bận khách hả anh? Khi nào rảnh anh nhắn em gửi anh xem qua video TV Mode chiếu giải đấu thực tế tại quán nhé ạ!";
  }

  if (slug.includes("web") || slug.includes("app") || slug.includes("design") || projectSlug.includes("sabo-mt")) {
    return "Dạ anh/chị ơi, nếu bên mình đang bận việc thì khi nào tiện anh/chị cứ nhắn em gửi bảng giải pháp mẫu và demo để mình tham khảo trước nhé ạ!";
  }

  if (slug.includes("ai") || projectSlug.includes("ai")) {
    return "Dạ anh/chị ơi, em vẫn đang trực ở đây nha, khi nào rảnh anh/chị nhắn em hỗ trợ thêm thông tin về tài liệu/khóa học nhé ạ!";
  }

  return "Dạ anh/chị ơi, em vẫn đang ở đây hỗ trợ mình nha, nếu cần em giải đáp thêm thông tin gì anh/chị cứ nhắn em nhé ạ!";
}

/**
 * Periodic scan for inactive conversations needing a follow-up check-in
 */
async function checkAndSendFollowups() {
  const now = Date.now();

  for (const [senderId, conv] of activeConversations.entries()) {
    if (conv.leadCaptured || conv.followUpSent) {
      // Clean up after 4 hours
      if (now - conv.lastInteractionTime > 4 * 60 * 60 * 1000) {
        activeConversations.delete(senderId);
      }
      continue;
    }

    const elapsed = now - conv.lastInteractionTime;

    // Check if within the 15m - 2h window
    if (elapsed >= INACTIVITY_THRESHOLD_MS && elapsed < MAX_FOLLOWUP_WINDOW_MS) {
      // Check if human handoff is currently active
      if (isHumanHandoffActive(conv.page.id, senderId)) {
        continue;
      }

      conv.followUpSent = true;
      const followMsg = getFollowupMessage(conv.page);

      logger.info("ghosting_followup_trigger", {
        pageId: conv.page.id,
        senderId,
        elapsedMinutes: Math.round(elapsed / 60000),
      });

      try {
        await sendText(conv.page.id, conv.page.accessToken, senderId, followMsg);
      } catch (err) {
        logger.warn("ghosting_followup_failed", {
          pageId: conv.page.id,
          senderId,
          error: err.message,
        });
      }
    }
  }
}

let followupInterval = null;

function startFollowupEngine(intervalMs = 60000) {
  if (followupInterval) clearInterval(followupInterval);
  followupInterval = setInterval(checkAndSendFollowups, intervalMs);
  logger.info("followup_engine_started", { intervalMs });
}

module.exports = {
  recordInteraction,
  markLeadAcquired,
  startFollowupEngine,
};
