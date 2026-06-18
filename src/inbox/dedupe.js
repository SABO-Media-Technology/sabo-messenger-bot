/**
 * Message idempotency — webhook + poller share one store.
 * In-memory (fast) + optional Supabase (survives Render cold start).
 */
const axios = require("axios");
const { logger } = require("../utils/logger");
const { hydrateThread, getHistory } = require("../session/store");

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SEEN = 5000;

const seenMessageIds = new Set();

function isPersistConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

async function supabaseRest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const base = url.replace(/\/$/, "");
  return axios({
    url: `${base}/rest/v1/${path}`,
    method: options.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
    },
    params: options.params,
    data: options.body,
    timeout: 8000,
    validateStatus: () => true,
  });
}

function pruneMemory() {
  if (seenMessageIds.size <= MAX_SEEN) return;
  const drop = seenMessageIds.size - MAX_SEEN;
  let i = 0;
  for (const mid of seenMessageIds) {
    seenMessageIds.delete(mid);
    if (++i >= drop) break;
  }
}

function hasSeenMessageId(id) {
  return Boolean(id && seenMessageIds.has(id));
}

function rememberMessageId(id) {
  if (!id) return;
  seenMessageIds.add(id);
  pruneMemory();
}

async function isPersistedMid(mid) {
  if (!mid || !isPersistConfigured()) return false;

  const since = new Date(Date.now() - TTL_MS).toISOString();
  const res = await supabaseRest("messenger_processed_mids", {
    params: {
      message_id: `eq.${mid}`,
      processed_at: `gte.${since}`,
      select: "message_id",
      limit: 1,
    },
  });

  if (!res || res.status < 200 || res.status >= 300) return false;
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.length > 0;
}

async function persistMid(mid, pageId, psid) {
  if (!mid || !isPersistConfigured()) return;

  const res = await supabaseRest("messenger_processed_mids", {
    method: "POST",
    prefer: "resolution=ignore-duplicates,return=minimal",
    params: { on_conflict: "message_id" },
    body: {
      message_id: mid,
      page_id: pageId,
      psid: psid || null,
      processed_at: new Date().toISOString(),
    },
  });

  if (res && res.status >= 400 && res.status !== 409) {
    logger.warn("dedupe_persist_failed", { mid, status: res.status });
  }
}

/**
 * Returns true if this mid was already handled (memory or Supabase, last 24h).
 */
async function isMessageProcessed(mid) {
  if (!mid) return false;
  if (seenMessageIds.has(mid)) return true;
  const persisted = await isPersistedMid(mid);
  if (persisted) seenMessageIds.add(mid);
  return persisted;
}

/**
 * Claim mid before processing. Returns false if already claimed/processed.
 */
async function claimMessage(mid, pageId, psid) {
  if (!mid) return true;

  if (seenMessageIds.has(mid)) return false;

  const persisted = await isPersistedMid(mid);
  if (persisted) {
    seenMessageIds.add(mid);
    return false;
  }

  seenMessageIds.add(mid);
  pruneMemory();
  await persistMid(mid, pageId, psid);
  return true;
}

/**
 * Poller safety: skip if session already has assistant reply to this exact user text.
 */
async function sessionAlreadyReplied(page, senderId, userText) {
  await hydrateThread(page.id, senderId, page.projectSlug);
  const history = getHistory(page.id, senderId);
  if (history.length < 2) return false;

  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  if (last.role !== "assistant" || prev.role !== "user") return false;

  return prev.content.trim() === String(userText || "").trim();
}

function dedupeStats() {
  return {
    seenInMemory: seenMessageIds.size,
    persistConfigured: isPersistConfigured(),
    ttlHours: TTL_MS / (60 * 60 * 1000),
  };
}

module.exports = {
  claimMessage,
  isMessageProcessed,
  hasSeenMessageId,
  rememberMessageId,
  sessionAlreadyReplied,
  dedupeStats,
};
