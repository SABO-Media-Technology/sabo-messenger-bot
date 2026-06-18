/**
 * Poll Page inbox when webhooks don't fire (Meta Dev mode: only app roles get webhooks).
 * Also covers Render cold-start misses. Dedup by message id (memory + Supabase 24h).
 */
const axios = require("axios");
const { getPagesWithToken } = require("../pages");
const { handleMessage } = require("../handlers/message");
const { logger } = require("../utils/logger");
const {
  claimMessage,
  isMessageProcessed,
  sessionAlreadyReplied,
  hasSeenMessageId,
  rememberMessageId,
  dedupeStats,
} = require("./dedupe");

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const DEFAULT_INTERVAL_MS = 45_000;
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

let pollInFlight = false;
let timer = null;

function isEnabled() {
  const raw = process.env.INBOX_POLLER_ENABLED;
  if (raw === "0" || raw === "false") return false;
  return true;
}

function intervalMs() {
  const n = Number(process.env.INBOX_POLL_INTERVAL_MS);
  return Number.isFinite(n) && n >= 15_000 ? n : DEFAULT_INTERVAL_MS;
}

function parseGraphTime(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

async function fetchRecentConversations(page) {
  const { data } = await axios.get(`${GRAPH_BASE}/${page.id}/conversations`, {
    params: {
      access_token: page.accessToken,
      fields: "updated_time",
      limit: 25,
    },
    timeout: 20_000,
  });

  return (data.data || []).filter((c) => parseGraphTime(c.updated_time) >= Date.now() - LOOKBACK_MS);
}

async function fetchLatestUserMessage(page, conversationId) {
  const { data } = await axios.get(`${GRAPH_BASE}/${conversationId}/messages`, {
    params: {
      access_token: page.accessToken,
      fields: "id,message,from,created_time",
      limit: 3,
    },
    timeout: 20_000,
  });

  const messages = data.data || [];
  const latest = messages[0];
  if (!latest) return null;

  const fromId = latest.from?.id;
  if (!fromId || fromId === page.id) return null;

  const text = (latest.message || "").trim();
  if (!text) return null;

  return {
    id: latest.id,
    senderId: fromId,
    text,
    createdTime: latest.created_time,
  };
}

async function pollPage(page) {
  const conversations = await fetchRecentConversations(page);
  let replied = 0;

  for (const conv of conversations) {
    const latest = await fetchLatestUserMessage(page, conv.id);
    if (!latest) continue;

    if (await isMessageProcessed(latest.id)) continue;

    if (await sessionAlreadyReplied(page, latest.senderId, latest.text)) {
      rememberMessageId(latest.id);
      logger.info("poller_session_skip", {
        pageId: page.id,
        messageId: latest.id,
        senderId: latest.senderId,
      });
      continue;
    }

    const claimed = await claimMessage(latest.id, page.id, latest.senderId);
    if (!claimed) continue;

    logger.info("poller_reply", {
      pageId: page.id,
      pageName: page.name,
      senderId: latest.senderId,
      messageId: latest.id,
      text: latest.text.slice(0, 80),
    });

    await handleMessage(page, latest.senderId, { text: latest.text, mid: latest.id });
    replied++;
  }

  return replied;
}

async function pollOnce() {
  if (pollInFlight) return { skipped: true };
  pollInFlight = true;
  let totalReplied = 0;

  try {
    const pages = getPagesWithToken();
    for (const page of pages) {
      try {
        totalReplied += await pollPage(page);
      } catch (err) {
        const fb = err.response?.data?.error;
        logger.error("poller_page_failed", {
          pageId: page.id,
          name: page.name,
          error: fb?.message || err.message,
        });
      }
    }
    if (totalReplied > 0) {
      logger.info("poller_cycle_done", { replied: totalReplied });
    }
    return { replied: totalReplied };
  } finally {
    pollInFlight = false;
  }
}

function startInboxPoller() {
  if (!isEnabled()) {
    logger.info("inbox_poller_disabled");
    return;
  }

  const ms = intervalMs();
  logger.info("inbox_poller_started", { intervalMs: ms, dedupe: dedupeStats() });

  void pollOnce();
  timer = setInterval(() => {
    void pollOnce();
  }, ms);
  if (timer.unref) timer.unref();
}

function stopInboxPoller() {
  if (timer) clearInterval(timer);
  timer = null;
}

function pollerStats() {
  return {
    enabled: isEnabled(),
    intervalMs: intervalMs(),
    dedupe: dedupeStats(),
    inFlight: pollInFlight,
  };
}

module.exports = {
  startInboxPoller,
  stopInboxPoller,
  pollOnce,
  pollerStats,
  rememberMessageId,
  hasSeenMessageId,
};
