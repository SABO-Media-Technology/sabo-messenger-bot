/**
 * Idempotency test — double webhook delivery must produce only one reply.
 * Usage: npm run test:dedupe
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
process.env.LEAD_QUEUE_DRY_RUN = "1";

const { loadPageRegistry, getPage } = require("../src/pages");
const { claimMessage, isMessageProcessed, sessionAlreadyReplied } = require("../src/inbox/dedupe");
const { clearThread, appendTurn } = require("../src/session/store");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function testDoubleClaim() {
  const mid = `test_mid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const pageId = "118356497898536";
  const psid = "test_dedupe_psid";

  const first = await claimMessage(mid, pageId, psid);
  const second = await claimMessage(mid, pageId, psid);
  const processed = await isMessageProcessed(mid);

  assert(first === true, "first claim should succeed");
  assert(second === false, "second claim should be rejected");
  assert(processed === true, "mid should be marked processed");
}

async function testSessionAlreadyReplied() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_session_dedupe";
  const userText = "giá website bao nhiêu?";

  clearThread(page.id, senderId);
  appendTurn(page.id, senderId, userText, "Dạ anh/chị! Giá tùy scope...", page.projectSlug);

  const skipped = await sessionAlreadyReplied(page, senderId, userText);
  assert(skipped === true, "session should show reply already sent for same user text");

  const notSkipped = await sessionAlreadyReplied(page, senderId, "câu hỏi khác hoàn toàn");
  assert(notSkipped === false, "different user text should not be skipped");
}

async function testPollerSkipsWhenSessionReplied() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_poller_skip";
  const userText = "poller skip test message";
  const mid = `poller_skip_${Date.now()}`;

  clearThread(page.id, senderId);
  appendTurn(page.id, senderId, userText, "already replied", page.projectSlug);

  const skip = await sessionAlreadyReplied(page, senderId, userText);
  assert(skip === true, "poller should skip when session has reply");

  const claimed = await claimMessage(mid, page.id, senderId);
  assert(claimed === true, "fresh mid should claim");
  const dup = await claimMessage(mid, page.id, senderId);
  assert(dup === false, "duplicate mid blocked");
}

async function main() {
  const { bootstrapEnv } = require("../src/config/env-bootstrap");
  await bootstrapEnv();
  loadPageRegistry();

  await testDoubleClaim();
  console.log("OK: double claim rejected");
  await testSessionAlreadyReplied();
  console.log("OK: session already-replied skip");
  await testPollerSkipsWhenSessionReplied();
  console.log("OK: poller session-replay skip + mid dedupe");
  console.log("\nAll dedupe tests passed.");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
