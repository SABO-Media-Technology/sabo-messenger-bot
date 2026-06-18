const { trimHistory } = require("../ai/llm");

const MAX_THREADS = 5000;
const TTL_MS = 24 * 60 * 60 * 1000;

/** @type {Map<string, { messages: Array<{role:string,content:string}>, updatedAt: number }>} */
const threads = new Map();

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

function getHistory(pageId, senderId) {
  const key = threadKey(pageId, senderId);
  const entry = threads.get(key);
  if (!entry) return [];
  if (Date.now() - entry.updatedAt > TTL_MS) {
    threads.delete(key);
    return [];
  }
  return [...entry.messages];
}

function appendTurn(pageId, senderId, userText, assistantText) {
  prune();
  const key = threadKey(pageId, senderId);
  const entry = threads.get(key) || { messages: [], updatedAt: Date.now() };
  entry.messages.push({ role: "user", content: userText });
  entry.messages.push({ role: "assistant", content: assistantText });
  entry.messages = trimHistory(entry.messages);
  entry.updatedAt = Date.now();
  threads.set(key, entry);
}

function clearThread(pageId, senderId) {
  threads.delete(threadKey(pageId, senderId));
}

function stats() {
  return { activeThreads: threads.size };
}

module.exports = { getHistory, appendTurn, clearThread, stats };
