/**
 * Sales discovery smoke test — open-ended service questions must NOT open with app MVP essay.
 * Usage: npm run test:sales-discovery
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
process.env.LEAD_QUEUE_DRY_RUN = "1";

const { loadPageRegistry, getPage } = require("../src/pages");
const {
  detectSalesIntent,
  isDiscoveryQuestion,
  buildDiscoveryReply,
} = require("../src/sales/discovery");
const { generateReply } = require("../src/ai/router");
const { clearThread } = require("../src/session/store");

const DISCOVERY_QUESTION = "có dịch vụ công nghệ nào thú vị không?";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testIntent() {
  assert(isDiscoveryQuestion(DISCOVERY_QUESTION), "discovery question detected");
  assert(detectSalesIntent(DISCOVERY_QUESTION) === "discovery", "intent is discovery");
  assert(detectSalesIntent("giá website bao nhiêu") === "pricing", "pricing not discovery");
}

function testReplyContent() {
  const page = { projectSlug: "sabo-mt", id: "test", replyStrategy: "sabo-mt" };
  const meta = { honorific: "anh/chị", profileName: "CEO Test" };
  const reply = buildDiscoveryReply(page, meta, DISCOVERY_QUESTION);

  assert(
    /website|lead|SABOHUB|bot|automation|chatbot|Automation/i.test(reply),
    `reply must mention concrete SABO services, got: ${reply.slice(0, 120)}`,
  );
  assert(
    !/^Với app, em thường tư vấn pilot MVP/i.test(reply),
    "must NOT open with pilot MVP essay",
  );
  assert(!/pilot MVP/i.test(reply.slice(0, 80)), "first ~80 chars must not mention pilot MVP");
  assert(!/cần em làm rõ phần nào/i.test(reply), "no weak qualify closer");
  assert(/\?/.test(reply), "must end with engaging question");

  return reply;
}

async function testRouter() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_sales_discovery_script";
  clearThread(page.id, senderId);

  const { text, layer } = await generateReply(page, senderId, DISCOVERY_QUESTION);
  assert(layer === "sales-discovery", `expected sales-discovery layer, got ${layer}`);
  assert(
    /website|lead|SABOHUB|bot|automation|chatbot|Automation/i.test(text),
    "router reply must mention concrete services",
  );
  assert(!/^Với app, em thường tư vấn pilot MVP/i.test(text), "router must not open with app MVP");

  return text;
}

async function main() {
  console.log("test:sales-discovery");
  testIntent();
  console.log("  intent detection: OK");

  const templateReply = testReplyContent();
  console.log("  buildDiscoveryReply: OK");

  const routerReply = await testRouter();
  console.log("  router layer sales-discovery: OK");

  console.log("\n--- Example reply (CEO review) ---");
  console.log(`Q: ${DISCOVERY_QUESTION}`);
  console.log(`A (template): ${templateReply}`);
  console.log(`A (router):   ${routerReply}`);
  console.log("\nPASS");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
