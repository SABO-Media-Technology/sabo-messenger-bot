const axios = require("axios");
const { logger } = require("./logger");
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
 * Set greeting text for a page.
 */
async function setGreeting(pageId, accessToken) {
  const url = `${GRAPH_BASE}/me/messenger_profile`;
  const greetingText = getGreetingText(pageId);
  const body = {
    greeting: [
      {
        locale: "default",
        text: greetingText,
      },
    ],
  };

  const { data } = await axios.post(url, body, {
    params: { access_token: accessToken },
  });
  logger.info("greeting_set", { pageId });
  return data;
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
    await setGetStarted(pageId, accessToken);
    await setGreeting(pageId, accessToken);
    await setPersistentMenu(pageId, accessToken);
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
  setGreeting,
  setPersistentMenu,
  setupPageProfile,
  setupAllPages,
};
