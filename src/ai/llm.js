const axios = require("axios");
const { logger } = require("../utils/logger");

const MAX_HISTORY = 10;
const MAX_TOKENS = 520;
const OLLAMA_TIMEOUT_MS = 90000;
const CLOUD_TIMEOUT_MS = 20000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/$/, "");
}

function getOllamaConfig() {
  const explicitUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL);
  const wantsOllama =
    process.env.LLM_PROVIDER === "ollama" ||
    process.env.OLLAMA_ENABLED === "true" ||
    Boolean(explicitUrl);

  if (!wantsOllama) return null;

  if (process.env.NODE_ENV === "production" && !explicitUrl) {
    return null;
  }

  const baseUrl = explicitUrl || "http://127.0.0.1:11434/v1";
  return {
    provider: "ollama",
    apiKey: process.env.OLLAMA_API_KEY || "ollama",
    baseUrl,
    model: process.env.OLLAMA_MODEL || "qwen3.5:9b",
    timeoutMs: OLLAMA_TIMEOUT_MS,
  };
}

function listLlmProviders() {
  const forced = (process.env.LLM_PROVIDER || "auto").toLowerCase();
  const ollama = getOllamaConfig();
  const groq = process.env.GROQ_API_KEY
    ? {
        provider: "groq",
        apiKey: process.env.GROQ_API_KEY,
        baseUrl: "https://api.groq.com/openai/v1",
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        timeoutMs: CLOUD_TIMEOUT_MS,
      }
    : null;
  const openai = process.env.OPENAI_API_KEY
    ? {
        provider: "openai",
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: normalizeBaseUrl(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        timeoutMs: CLOUD_TIMEOUT_MS,
      }
    : null;

  if (forced === "ollama") return ollama ? [ollama] : [];
  if (forced === "groq") return groq ? [groq] : [];
  if (forced === "openai") return openai ? [openai] : [];

  const chain = [];
  if (ollama) chain.push(ollama);
  if (groq) chain.push(groq);
  if (openai) chain.push(openai);
  return chain;
}

/** Primary provider for /health. */
function getLlmConfig() {
  return listLlmProviders()[0] || null;
}

function trimHistory(messages) {
  return messages.slice(-MAX_HISTORY);
}

function isRetryable(err) {
  const status = err.response?.status;
  return (
    status === 429 ||
    status === 503 ||
    status === 502 ||
    status === 500 ||
    err.code === "ECONNABORTED" ||
    err.code === "ETIMEDOUT" ||
    err.code === "ECONNREFUSED" ||
    err.code === "ENOTFOUND"
  );
}

async function callOllamaNative(cfg, systemPrompt, history, options) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...trimHistory(history),
  ];
  const temperature = typeof options.temperature === "number" ? options.temperature : 0.5;
  const base = normalizeBaseUrl(cfg.baseUrl).replace(/\/v1$/, "");

  const { data } = await axios.post(
    `${base}/api/chat`,
    {
      model: cfg.model,
      messages,
      stream: false,
      think: false,
      options: {
        temperature,
        num_predict: MAX_TOKENS,
      },
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: cfg.timeoutMs || OLLAMA_TIMEOUT_MS,
    },
  );

  const text = data.message?.content?.trim();
  if (!text) {
    throw new Error("Empty Ollama response");
  }

  logger.info("llm_ok", { provider: cfg.provider, model: cfg.model, chars: text.length });
  return text;
}

async function callProvider(cfg, systemPrompt, history, options) {
  if (cfg.provider === "ollama") {
    return callOllamaNative(cfg, systemPrompt, history, options);
  }

  const messages = [{ role: "system", content: systemPrompt }, ...trimHistory(history)];
  const temperature = typeof options.temperature === "number" ? options.temperature : 0.5;

  const { data } = await axios.post(
    `${cfg.baseUrl}/chat/completions`,
    {
      model: cfg.model,
      messages,
      max_tokens: MAX_TOKENS,
      temperature,
      stream: false,
    },
    {
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: cfg.timeoutMs || CLOUD_TIMEOUT_MS,
    },
  );

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty LLM response");
  }

  logger.info("llm_ok", { provider: cfg.provider, model: cfg.model, chars: text.length });
  return text;
}

/**
 * Chat completion — Ollama (local) → Groq → OpenAI failover.
 */
async function chatCompletion(systemPrompt, history, options = {}) {
  const providers = listLlmProviders();
  if (!providers.length) {
    throw new Error(
      "No LLM configured (set OLLAMA_BASE_URL / OLLAMA_ENABLED, GROQ_API_KEY, or OPENAI_API_KEY)",
    );
  }

  let lastErr = null;

  for (let i = 0; i < providers.length; i++) {
    const cfg = providers[i];
    const retries = cfg.provider === "ollama" ? 1 : 2;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await callProvider(cfg, systemPrompt, history, options);
      } catch (err) {
        lastErr = err;
        const status = err.response?.status;
        logger.warn("llm_attempt_failed", {
          provider: cfg.provider,
          attempt,
          status: status || err.code,
          message: err.message?.slice(0, 160),
        });

        if (isRetryable(err) && attempt < retries - 1) {
          await sleep(800 + attempt * 500);
          continue;
        }

        const hasNext = i < providers.length - 1;
        if (hasNext) {
          logger.warn("llm_failover", {
            from: cfg.provider,
            to: providers[i + 1].provider,
            status: status || err.code,
          });
          break;
        }

        throw err;
      }
    }
  }

  throw lastErr || new Error("LLM failed");
}

function isLlmConfigured() {
  return listLlmProviders().length > 0;
}

module.exports = {
  chatCompletion,
  getLlmConfig,
  listLlmProviders,
  isLlmConfigured,
  trimHistory,
};
