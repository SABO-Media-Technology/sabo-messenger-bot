/**
 * Hermes Gateway API Server client (OpenAI-compatible).
 * SSoT: hermes/core/gateway/platforms/api_server.py — default :8642
 */
const axios = require("axios");
const { logger } = require("../utils/logger");
const { trimHistory } = require("./llm");

const DEFAULT_URL = "http://127.0.0.1:8642";
const DEFAULT_MODEL = "hermes-agent";
const TIMEOUT_MS = 120000;

function normalizeBase(url) {
  return String(url || DEFAULT_URL)
    .trim()
    .replace(/\/$/, "");
}

function isHermesEnabled() {
  return process.env.HERMES_ENABLED === "true";
}

function getHermesConfig() {
  if (!isHermesEnabled()) return null;
  return {
    baseUrl: normalizeBase(process.env.HERMES_API_URL || DEFAULT_URL),
    apiKey: process.env.HERMES_API_KEY || process.env.API_SERVER_KEY || "",
    model: process.env.HERMES_MODEL || DEFAULT_MODEL,
  };
}

function sessionKey(page, senderId) {
  const vertical = page.projectSlug || "sabo-mt";
  return `uyen-nhi:messenger:${vertical}:${page.id}:${senderId}`;
}

function channelMetadata(page) {
  return {
    agent: "uyen-nhi",
    channel: "facebook_messenger",
    policy: "customer_safe",
    pageId: page.id,
    pageName: page.name || "",
    vertical: page.projectSlug || "sabo-mt",
    replyStrategy: page.replyStrategy || "",
  };
}

async function probeHermesHealth() {
  const cfg = getHermesConfig();
  if (!cfg) return false;
  try {
    const headers = {};
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
    const { data } = await axios.get(`${cfg.baseUrl}/health`, { headers, timeout: 5000 });
    return data?.status === "ok" || data?.platform === "hermes-agent";
  } catch {
    return false;
  }
}

/**
 * Chat via Hermes agent (tools, memory, Ollama backend configured in Hermes).
 */
async function chatHermes({ page, senderId, systemPrompt, history, userText, temperature = 0.55 }) {
  const cfg = getHermesConfig();
  if (!cfg) {
    throw new Error("Hermes not enabled");
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...trimHistory(history),
    { role: "user", content: userText },
  ];

  const headers = {
    "Content-Type": "application/json",
    "X-Hermes-Session-Key": sessionKey(page, senderId),
    "X-Hermes-Channel": "facebook_messenger",
    "X-Hermes-Agent": "uyen-nhi",
    "X-Hermes-Policy": "customer_safe",
    "X-Hermes-Page-Id": String(page.id || ""),
  };
  if (cfg.apiKey) {
    headers.Authorization = `Bearer ${cfg.apiKey}`;
  }

  const { data } = await axios.post(
    `${cfg.baseUrl}/v1/chat/completions`,
    {
      model: cfg.model,
      messages,
      metadata: channelMetadata(page),
      max_tokens: 520,
      temperature,
      stream: false,
    },
    { headers, timeout: TIMEOUT_MS },
  );

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty Hermes response");
  }

  logger.info("hermes_ok", {
    model: cfg.model,
    sessionKey: sessionKey(page, senderId),
    channel: channelMetadata(page),
    chars: text.length,
  });
  return text;
}

module.exports = {
  isHermesEnabled,
  getHermesConfig,
  probeHermesHealth,
  chatHermes,
  sessionKey,
  channelMetadata,
};
