const crypto = require("crypto");
const axios = require("axios");
const { logger } = require("./logger");

const SEND_DEDUPE_MS = 30_000;
const recentSends = new Map();

function sendDedupeKey(recipientId, text) {
  const hash = crypto.createHash("sha1").update(String(text || "")).digest("hex").slice(0, 16);
  return `${recipientId}:${hash}`;
}

function shouldSkipDuplicateSend(recipientId, text) {
  const key = sendDedupeKey(recipientId, text);
  const now = Date.now();
  const last = recentSends.get(key);
  if (last && now - last < SEND_DEDUPE_MS) return true;
  recentSends.set(key, now);
  if (recentSends.size > 2000) {
    for (const [k, ts] of recentSends) {
      if (now - ts > SEND_DEDUPE_MS) recentSends.delete(k);
    }
  }
  return false;
}
const {
  getGreetingText,
  getPersistentMenu,
  getGetStartedPayload,
} = require("../responses/greeting");

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Send a text message via Send API.
 */
async function sendText(pageId, accessToken, recipientId, text) {
  if (shouldSkipDuplicateSend(recipientId, text)) {
    logger.info("message_send_deduped", { pageId, recipientId, chars: (text || "").length });
    return { deduped: true };
  }

  const url = `${GRAPH_BASE}/${pageId}/messages`;
  const body = {
    messaging_type: "RESPONSE",
    recipient: { id: recipientId },
    message: { text },
  };

  const { data } = await axios.post(url, body, {
    params: { access_token: accessToken },
  });
  logger.info("message_sent", { pageId, recipientId, messageId: data.message_id });
  return data;
}

/**
 * Set Get Started button for a page.
 */
async function setGetStarted(pageId, accessToken) {
  const url = `${GRAPH_BASE}/me/messenger_profile`;
  const payload = getGetStartedPayload();
  const body = {
    get_started: { payload },
  };

  const { data } = await axios.post(url, body, {
    params: { access_token: accessToken },
  });
  logger.info("get_started_set", { pageId });
  return data;
}

/**
 * Ice breakers replace deprecated greeting on Graph API v21+.
 */
function buildIceBreakers(pageId) {
  const greetingText = getGreetingText(pageId).replace(/\{\{user_first_name\}\}/g, "bạn");
  return [
    {
      locale: "default",
      call_to_actions: [
        {
          question: greetingText.slice(0, 80),
          payload: "GET_STARTED",
        },
        {
          question: "💬 Tư vấn dịch vụ",
          payload: "REQUEST_CONSULT",
        },
      ],
    },
  ];
}

/**
 * Set persistent menu for a page.
 */
async function setPersistentMenu(pageId, accessToken) {
  const url = `${GRAPH_BASE}/me/messenger_profile`;
  const menu = getPersistentMenu();
  const body = {
    persistent_menu: [menu],
  };

  const { data } = await axios.post(url, body, {
    params: { access_token: accessToken },
  });
  logger.info("persistent_menu_set", { pageId });
  return data;
}

/**
 * Run full Messenger Profile setup for one page.
 */
async function setupPageProfile(page) {
  const { id: pageId, name, accessToken } = page;
  if (!accessToken) {
    return {
      pageId,
      name,
      success: false,
      error: "Missing access token",
    };
  }

  try {
    const url = `${GRAPH_BASE}/me/messenger_profile`;
    const body = {
      get_started: { payload: getGetStartedPayload() },
      persistent_menu: [getPersistentMenu()],
      ice_breakers: buildIceBreakers(pageId),
    };
    await axios.post(url, body, {
      params: { access_token: accessToken },
    });
    logger.info("messenger_profile_set", { pageId, name });
    return { pageId, name, success: true };
  } catch (err) {
    const fbError = err.response?.data?.error;
    logger.error("setup_page_failed", {
      pageId,
      name,
      error: fbError || err.message,
    });
    return {
      pageId,
      name,
      success: false,
      error: fbError?.message || err.message,
    };
  }
}

/**
 * Setup all pages that have access tokens configured.
 */
async function setupAllPages(pages) {
  const results = [];
  for (const page of pages) {
    results.push(await setupPageProfile(page));
  }
  return results;
}

module.exports = {
  sendText,
  setGetStarted,
  setPersistentMenu,
  setupPageProfile,
  setupAllPages,
  shouldSkipDuplicateSend,
  sendDedupeKey,
};
