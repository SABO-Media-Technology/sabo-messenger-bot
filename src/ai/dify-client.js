/**
 * Dify Brain API Client — connects Facebook Messenger to dedicated Dify Knowledge Brains.
 * SSoT: Local Dify Instance (http://127.0.0.1/v1) backed by Vertex AI Gemini 2.5 Flash + text-embedding-004.
 */

const axios = require("axios");
const { logger } = require("../utils/logger");

const DEFAULT_DIFY_URL = "http://127.0.0.1/v1";
const DIFY_TIMEOUT_MS = 30000;

// Default API keys for segregated domain bots
const DIFY_APP_TOKENS = {
  SOLUTIONS: process.env.DIFY_APP_TOKEN_SOLUTIONS || "app-v7CVKZLpq77eruuIix70wIGn",
  ARENA: process.env.DIFY_APP_TOKEN_ARENA || "app-GsUEB0P6cwf3vgYp8Nn5qaXO",
  ARENA_B2B: process.env.DIFY_APP_TOKEN_ARENA_B2B || "app-fd22e02975b4871d79c842be",
  CONTENT: process.env.DIFY_APP_TOKEN_CONTENT || "app-RmkcxuXDYZtYCMZSd0IsAytj",
  EXECUTIVE: process.env.DIFY_APP_TOKEN_EXECUTIVE || "app-YFraSAu4ukVDsh70h2r0Amqo",
};

function normalizeBaseUrl(url) {
  return String(url || DEFAULT_DIFY_URL)
    .trim()
    .replace(/\/$/, "");
}

function isDifyEnabled() {
  return process.env.DIFY_ENABLED !== "false";
}

/**
 * Detect B2B intent for Billiard club owners (Gói PRO / Bảng giá / POS)
 */
function isB2BClubInquiry(text) {
  const normalized = (text || "").toLowerCase();
  const b2bKeywords = [
    "gói pro",
    "bảng giá",
    "báo giá",
    "mua gói",
    "chủ clb",
    "chủ quán",
    "mở clb",
    "kinh doanh bida",
    "quản lý clb",
    "phần mềm bida",
    "pos",
    "hệ thống tính tiền",
    "hợp tác",
    "đăng ký clb",
    "nhượng quyền",
    "phần mềm quản lý",
  ];
  return b2bKeywords.some((kw) => normalized.includes(kw));
}

/**
 * Select the appropriate Dify App Token based on Page identity and user query
 */
function selectDifyAppToken(page, userText) {
  const project = (page.projectSlug || "").toLowerCase();
  const pageId = String(page.id || "");
  const { getVerticalId } = require("../strategies/page-contracts");
  const verticalId = getVerticalId(page);

  if (
    project === "sabo-arena" ||
    project === "sabo-billiards" ||
    pageId === "569652129566651" ||
    pageId === "118356497898536" ||
    verticalId === "billiards-ops"
  ) {
    if (isB2BClubInquiry(userText)) {
      return {
        token: DIFY_APP_TOKENS.ARENA_B2B,
        botName: "SABO ARENA — B2B PRO Sales",
        domain: "sabo-arena-b2b",
        botKey: "arena_b2b",
      };
    }
    return {
      token: DIFY_APP_TOKENS.ARENA,
      botName: "SABO ARENA — Trợ Lý Bida & CLB",
      domain: "sabo-arena",
      botKey: "arena",
    };
  }

  if (project === "ai-art" || project === "ainewbie" || page.id === "618738001318577" || page.id === "569671719553461") {
    return {
      token: DIFY_APP_TOKENS.CONTENT,
      botName: "SABO AI CONTENT — Xưởng Kịch Bản & Media",
      domain: "sabo-ai-content",
      botKey: "content",
    };
  }

  // Default to SABO Solutions (SABO Design, Web, Agency, App, Media, Hub)
  return {
    token: DIFY_APP_TOKENS.SOLUTIONS,
    botName: "SABO SOLUTIONS — Tư Vấn Web/App & Autopilot",
    domain: "sabo-mt",
    botKey: "solutions",
  };
}

/**
 * Send chat message to Dify Chat API
 */
async function chatDify({ page, senderId, userText, conversationId = null }) {
  if (!isDifyEnabled()) {
    throw new Error("Dify is disabled");
  }

  const baseUrl = normalizeBaseUrl(process.env.DIFY_API_URL);
  const { token, botName, domain, botKey } = selectDifyAppToken(page, userText);

  const payload = {
    inputs: {},
    query: userText,
    response_mode: "blocking",
    user: `fb_${page.id}_${senderId}`,
  };

  if (conversationId) {
    payload.conversation_id = conversationId;
  }

  logger.info("dify_chat_request", {
    pageId: page.id,
    pageName: page.name,
    botName,
    domain,
    botKey,
    senderId,
    hasConvId: Boolean(conversationId),
  });

  const { data } = await axios.post(`${baseUrl}/chat-messages`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    timeout: DIFY_TIMEOUT_MS,
  });

  const answer = (data?.answer || "").trim();
  if (!answer) {
    throw new Error("Empty response from Dify");
  }

  logger.info("dify_chat_ok", {
    botName,
    domain,
    botKey,
    chars: answer.length,
    conversationId: data.conversation_id,
  });

  return {
    answer,
    conversationId: data.conversation_id || null,
    domain,
    botName,
    botKey,
  };
}

module.exports = {
  chatDify,
  isDifyEnabled,
  selectDifyAppToken,
  isB2BClubInquiry,
  DIFY_APP_TOKENS,
};
