/**
 * Smoke test: generateReply via local Ollama (requires Ollama running + qwen3.5:9b).
 * Usage: OLLAMA_ENABLED=true node scripts/test-ollama-reply.cjs
 */
process.chdir(require("path").join(__dirname, ".."));

process.env.LLM_PROVIDER = process.env.LLM_PROVIDER || "ollama";
process.env.OLLAMA_ENABLED = process.env.OLLAMA_ENABLED || "true";
process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";
process.env.OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:9b";
delete process.env.GROQ_API_KEY;
delete process.env.OPENAI_API_KEY;

const { bootstrapEnv } = require("../src/config/env-bootstrap");
const { loadPageRegistry, getPage } = require("../src/pages");
const { generateReply } = require("../src/ai/router");
const { listLlmProviders } = require("../src/ai/llm");
const { clearThread, setLeadProfile, setSessionMeta } = require("../src/session/store");

async function main() {
  await bootstrapEnv();
  loadPageRegistry();

  const chain = listLlmProviders();
  console.log("LLM chain:", chain.map((p) => `${p.provider}/${p.model}`).join(" → ") || "(empty)");
  if (!chain.length || chain[0].provider !== "ollama") {
    console.error("FAIL: Ollama not first provider");
    process.exit(1);
  }

  const page = getPage("332950393234346");
  const senderId = "test_ollama_smoke";
  clearThread(page.id, senderId);
  setLeadProfile(
    page.id,
    senderId,
    {
      need: "Làm website bán hàng",
      phone: "0961167717",
      qualified: true,
      queued: true,
    },
    page.projectSlug,
  );
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

  const { text, layer } = await generateReply(page, senderId, "giá cả như nào ?");
  console.log("\nlayer:", layer);
  console.log("reply:", text.slice(0, 400));
  if (/fallback-error|fallback-no-llm/.test(layer)) {
    console.error("\nFAIL: fell back instead of Ollama");
    process.exit(1);
  }
  if (!/giá|tr\b|scope|tùy|ngân sách/i.test(text)) {
    console.error("\nWARN: reply may not address pricing");
  }
  console.log("\nOK: Ollama reply path");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
