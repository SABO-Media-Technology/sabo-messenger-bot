const { trimHistory } = require("../ai/llm");
const { emptyProfile } = require("../leads/flow");
const { loadThread, saveThread } = require("./persist");

const MAX_THREADS = 5000;
const TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, { messages: Array<{role:string,content:string}>, lead: object, meta: object, updatedAt: number, hydrated?: boolean }>} */
const threads = new Map();

function emptySessionMeta() {
  return {
    profileName: null,
    firstName: null,
    honorific: "anh/chị",
    nameRefused: false,
    fbProfileFetched: false,
  };
}

function threadKey(pageId, senderId) {
  return `${pageId}:${senderId}`;
}

function prune() {
  if (threads.size <= MAX_THREADS) return;
  const now = Date.now();
  for (const [key, val] of threads) {
    if (now - val.updatedAt > TTL_MS) threads.delete(key);
  }
  if (threads.size > MAX_THREADS) {
    const oldest = [...threads.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    for (let i = 0; i < oldest.length - MAX_THREADS; i++) {
      threads.delete(oldest[i][0]);
    }
  }
}

function ensureEntry(pageId, senderId) {
  const key = threadKey(pageId, senderId);
  let entry = threads.get(key);
  if (!entry) {
    entry = {
      messages: [],
      lead: emptyProfile(),
      meta: emptySessionMeta(),
      updatedAt: Date.now(),
      hydrated: false,
    };
    threads.set(key, entry);
  }
  if (Date.now() - entry.updatedAt > TTL_MS) {
    entry.messages = [];
    entry.lead = emptyProfile();
    entry.meta = emptySessionMeta();
    entry.hydrated = false;
    entry.updatedAt = Date.now();
  }
  return entry;
}

function touchPersist(pageId, senderId, projectSlug, entry) {
  saveThread(pageId, senderId, projectSlug, {
    messages: entry.messages,
    lead: entry.lead,
    meta: entry.meta,
  });
}

/**
 * Load in-memory session from Supabase on first access (Render cold start safe).
 */
async function hydrateThread(pageId, senderId, projectSlug) {
  const entry = ensureEntry(pageId, senderId);
  if (entry.hydrated) return entry;

  const remote = await loadThread(pageId, senderId);
  entry.hydrated = true;

  if (remote) {
    if (remote.messages?.length) entry.messages = remote.messages;
    if (remote.lead) entry.lead = { ...emptyProfile(), ...remote.lead };
    if (remote.meta) entry.meta = { ...emptySessionMeta(), ...remote.meta };
    entry.updatedAt = Date.now();
  }

  touchPersist(pageId, senderId, projectSlug, entry);
  return entry;
}

function getHistory(pageId, senderId) {
  const entry = threads.get(threadKey(pageId, senderId));
  if (!entry) return [];
  if (Date.now() - entry.updatedAt > TTL_MS) {
    threads.delete(threadKey(pageId, senderId));
    return [];
  }
  return [...entry.messages];
}

function getLeadProfile(pageId, senderId) {
  const entry = threads.get(threadKey(pageId, senderId));
  if (!entry?.lead) return emptyProfile();
  return { ...entry.lead };
}

function getSessionMeta(pageId, senderId) {
  const entry = threads.get(threadKey(pageId, senderId));
  if (!entry?.meta) return emptySessionMeta();
  return { ...entry.meta };
}

function setSessionMeta(pageId, senderId, meta, projectSlug) {
  prune();
  const entry = ensureEntry(pageId, senderId);
  entry.meta = { ...emptySessionMeta(), ...entry.meta, ...meta };
  entry.updatedAt = Date.now();
  entry.hydrated = true;
  touchPersist(pageId, senderId, projectSlug, entry);
  return entry.meta;
}

function setLeadProfile(pageId, senderId, lead, projectSlug) {
  prune();
  const entry = ensureEntry(pageId, senderId);
  entry.lead = { ...lead };
  entry.updatedAt = Date.now();
  entry.hydrated = true;
  touchPersist(pageId, senderId, projectSlug, entry);
  return entry.lead;
}

function appendTurn(pageId, senderId, userText, assistantText, projectSlug) {
  prune();
  const entry = ensureEntry(pageId, senderId);
  entry.messages.push({ role: "user", content: userText });
  entry.messages.push({ role: "assistant", content: assistantText });
  entry.messages = trimHistory(entry.messages);
  entry.updatedAt = Date.now();
  entry.hydrated = true;
  touchPersist(pageId, senderId, projectSlug, entry);
}

function clearThread(pageId, senderId) {
  threads.delete(threadKey(pageId, senderId));
}

function stats() {
  return { activeThreads: threads.size };
}

module.exports = {
  getHistory,
  getLeadProfile,
  setLeadProfile,
  getSessionMeta,
  setSessionMeta,
  emptySessionMeta,
  appendTurn,
  hydrateThread,
  clearThread,
  stats,
};
