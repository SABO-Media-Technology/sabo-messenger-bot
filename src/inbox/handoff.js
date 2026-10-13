/**
 * Human Handoff Manager — Pauses bot automation when human agent / admin enters the conversation
 * or when the user explicitly requests to speak with a human.
 */

const { logger } = require("../utils/logger");

// In-memory registry: `${pageId}:${customerId}` -> { expiresAt: number, reason: string }
const handoffRegistry = new Map();

const HUMAN_REQUEST_KEYWORDS = [
  "gặp admin",
  "gặp người thật",
  "gặp nhân viên",
  "gặp tư vấn viên",
  "nói chuyện với người",
  "gặp chủ quán",
  "chuyển máy",
  "tổng đài viên",
  "cần người hỗ trợ",
  "admin ơi",
  "cho gặp admin",
  "cho gặp người thật",
];

function getHandoffKey(pageId, customerId) {
  return `${pageId}:${customerId}`;
}

/**
 * Check if the user text expresses an explicit intent to talk to a human
 */
function isHumanRequest(text) {
  if (!text) return false;
  const normalized = text.toLowerCase().trim();
  return HUMAN_REQUEST_KEYWORDS.some((kw) => normalized.includes(kw));
}

/**
 * Activate human handoff for a given conversation
 * @param {string} pageId
 * @param {string} customerId
 * @param {number} minutes Duration in minutes (default: 30)
 * @param {string} reason Reason for handoff (e.g. "admin_reply", "user_requested")
 */
function activateHumanHandoff(pageId, customerId, minutes = 30, reason = "admin_reply") {
  const key = getHandoffKey(pageId, customerId);
  const expiresAt = Date.now() + minutes * 60 * 1000;
  handoffRegistry.set(key, { expiresAt, reason });
  logger.info("human_handoff_activated", { pageId, customerId, minutes, reason, expiresAt });
}

/**
 * Check if human handoff is currently active for this user
 */
function isHumanHandoffActive(pageId, customerId) {
  const key = getHandoffKey(pageId, customerId);
  const entry = handoffRegistry.get(key);
  if (!entry) return false;

  const now = Date.now();
  if (now > entry.expiresAt) {
    handoffRegistry.delete(key);
    logger.info("human_handoff_expired", { pageId, customerId });
    return false;
  }

  return true;
}

/**
 * Release handoff early (e.g. if admin re-enables bot)
 */
function clearHumanHandoff(pageId, customerId) {
  const key = getHandoffKey(pageId, customerId);
  handoffRegistry.delete(key);
  logger.info("human_handoff_cleared", { pageId, customerId });
}

module.exports = {
  isHumanRequest,
  activateHumanHandoff,
  isHumanHandoffActive,
  clearHumanHandoff,
};
