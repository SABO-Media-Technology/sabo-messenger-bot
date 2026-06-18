/**
 * One real lead insert + Telegram notify (smoke test).
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));

const { bootstrapEnv } = require("../src/config/env-bootstrap");
const { loadPageRegistry } = require("../src/pages");
const { queueLeadEvent } = require("../src/leads/queue");

async function main() {
  await bootstrapEnv();
  loadPageRegistry();
  const pages = require("../src/pages").getAllPages();
  const page = pages.find((p) => p.slug === "SABO_MEDIA") || pages[0];
  if (!page) {
    console.error("No page in registry");
    process.exit(1);
  }

  const result = await queueLeadEvent({
    page,
    senderId: `smoke_test_${Date.now()}`,
    userText: "[SMOKE TEST] Messenger bot lead queue — có thể xóa",
    replyLayer: "smoke-test",
  });

  console.log("Lead queue result:", result);
  process.exit(result.stored ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
