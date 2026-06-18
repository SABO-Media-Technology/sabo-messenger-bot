const axios = require("axios");
const { logger } = require("../utils/logger");

const MAX_HISTORY = 8;
const MAX_TOKENS = 400;

function getLlmConfig() {
  if (process.env.GROQ_API_KEY) {
    return {
      provider: "groq",
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }
  return null;
}

function trimHistory(messages) {
  return messages.slice(-MAX_HISTORY);
}

/**
 * Non-streaming chat completion — sync reply for Messenger.
 */
async function chatCompletion(systemPrompt, history, options = {}) {
  const cfg = getLlmConfig();
  if (!cfg) {
    throw new Error("No LLM configured (set GROQ_API_KEY or OPENAI_API_KEY)");
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...trimHistory(history),
  ];

  const temperature = typeof options.temperature === "number" ? options.temperature : 0.5;

  const { data } = await axios.post(
    `${cfg.baseUrl}/chat/completions`,
    {
      model: cfg.model,
      messages,
      max_tokens: MAX_TOKENS,
      temperature,
    },
    {
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    },
  );

  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Empty LLM response");
  }

  logger.debug("llm_ok", { provider: cfg.provider, model: cfg.model, chars: text.length });
  return text;
}

function isLlmConfigured() {
  return Boolean(getLlmConfig());
}

module.exports = { chatCompletion, getLlmConfig, isLlmConfigured, trimHistory };
