/**
 * Smoke test: generateReply via Hermes Gateway API (:8642).
 * Requires: hermes-lab PM2 or `hermes -p lab gateway run`, API_SERVER_KEY.
 */
process.chdir(require("path").join(__dirname, ".."));

process.env.HERMES_ENABLED = "true";
process.env.HERMES_API_URL = process.env.HERMES_API_URL || "http://127.0.0.1:8642";
process.env.HERMES_API_KEY = process.env.HERMES_API_KEY || "brain-hermes-local-2026";
process.env.LLM_PROVIDER = "ollama";
process.env.OLLAMA_ENABLED = "true";

const { bootstrapEnv } = require("../src/config/env-bootstrap");
const { loadPageRegistry, getPage } = require("../src/pages");
const { generateReply } = require("../src/ai/router");
const { probeHermesHealth, sessionKey } = require("../src/ai/hermes-client");
const { clearThread, setLeadProfile, setSessionMeta } = require("../src/session/store");

async function main() {
  await bootstrapEnv();
  loadPageRegistry();

  const ok = await probeHermesHealth();
  if (!ok) {
    console.error("FAIL: Hermes /health not OK at", process.env.HERMES_API_URL);
    console.error("Start: pm2 start ecosystem.config.cjs --only hermes-lab (from hermes/core)");
    process.exit(1);
  }

  const page = getPage("332950393234346");
  const senderId = "test_hermes_smoke";
  clearThread(page.id, senderId);
  setLeadProfile(
    page.id,
    senderId,
    { need: "Làm website", phone: "0961167717", qualified: true, queued: true },
    page.projectSlug,
  );
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

  const sk = sessionKey(page, senderId);
  if (!/^uyen-nhi:messenger:/.test(sk)) {
    console.error("FAIL: session key should be uyen-nhi omnichannel format, got", sk);
    process.exit(1);
  }
  console.log("sessionKey:", sk);

  const { text, layer } = await generateReply(page, senderId, "giá website bao nhiêu?");
  console.log("layer:", layer);
  console.log("reply:", text.slice(0, 500));
  if (!/hermes/.test(layer)) {
    console.error("FAIL: expected hermes in layer");
    process.exit(1);
  }
  if (!/\bem\b/i.test(text)) {
    console.warn("WARN: reply may lack em/anh/chị voice — check soul + Hermes");
  }
  console.log("\nOK: Hermes reply path (Uyển Nhi omnichannel)");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
