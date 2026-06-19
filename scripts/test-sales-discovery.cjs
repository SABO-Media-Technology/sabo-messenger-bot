/**
 * Sales discovery smoke test — discovery module + thin router (no sales-discovery layer).
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
  buildPreferenceReply,
} = require("../src/sales/discovery");
const { generateReply } = require("../src/ai/router");
const { clearThread } = require("../src/session/store");
const { buildSystemPrompt } = require("../src/ai/prompt-builder");

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
  assert(!/^Với app, em thường tư vấn pilot MVP/i.test(reply), "must NOT open with pilot MVP essay");
  assert(!/pilot MVP/i.test(reply.slice(0, 80)), "first ~80 chars must not mention pilot MVP");
  assert(!/cần em làm rõ phần nào/i.test(reply), "no weak qualify closer");
  assert(/\?/.test(reply), "must end with engaging question");

  return reply;
}

async function testThinRouter() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_sales_discovery_script";
  clearThread(page.id, senderId);

  const prompt = buildSystemPrompt({
    page,
    sessionMeta: { honorific: "anh/chị" },
    leadProfile: { need: null, phone: null },
  });
  assert(/discovery|dịch vụ thú vị|SABO/i.test(prompt), "prompt must include discovery guidance");

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const { text, layer } = await generateReply(page, senderId, DISCOVERY_QUESTION);
    assert(layer === "sales-discovery", `services question must use sales-discovery layer — got ${layer}`);
    assert(/website|lead|SABOHUB|bot|automation/i.test(text), `must list services: ${text.slice(0, 120)}`);
    assert(!/cho em xin sđt hoặc email/i.test(text), "discovery must not ask SĐT/email");
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }
}

function testPreferenceIntent() {
  const pref = "ưu tiên web thu lead";
  assert(detectSalesIntent(pref) === "preference", "preference intent for web thu lead");
  const page = { projectSlug: "sabo-mt", id: "test", replyStrategy: "sabo-mt" };
  const meta = { honorific: "anh/chị" };
  const reply = buildPreferenceReply(page, meta, pref);
  assert(/trang|landing|form|zalo|tuần/i.test(reply), `preference reply concrete: ${reply.slice(0, 120)}`);
  assert(!/cảm ơn anh\/chị đã nhắn tin/i.test(reply), "preference must not be generic fallback");
}

async function testRouterPreference() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_sales_preference_script";
  clearThread(page.id, senderId);

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const { layer } = await generateReply(page, senderId, "ưu tiên web thu lead");
    assert(
      layer === "fallback-no-llm" || /^llm/.test(layer),
      `thin router: preference via LLM/fallback — got ${layer}`,
    );
    assert(layer !== "sales-preference", "sales-preference handler must be bypassed");
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }
}

async function main() {
  console.log("test:sales-discovery");
  testIntent();
  console.log("  intent detection: OK");
  testPreferenceIntent();
  console.log("  preference intent: OK");

  const templateReply = testReplyContent();
  console.log("  buildDiscoveryReply: OK");

  await testThinRouter();
  console.log("  router sales-discovery rule: OK");

  await testRouterPreference();
  console.log("  thin router (no sales-preference layer): OK");

  console.log("\n--- Example reply (CEO review) ---");
  console.log(`Q: ${DISCOVERY_QUESTION}`);
  console.log(`A (template): ${templateReply}`);
  console.log("\nPASS");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
