/**
 * Regression tests from real Messenger conversation failures (SABO Media page).
 * Usage: node scripts/test-conversation-regression.cjs
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
process.env.LEAD_QUEUE_DRY_RUN = "1";

const { loadPageRegistry, getPage } = require("../src/pages");
const { emptyProfile } = require("../src/leads/flow");
const { generateReply } = require("../src/ai/router");
const { clearThread, setLeadProfile, setSessionMeta, getLeadProfile } = require("../src/session/store");
const { buildPostQualifyFallback } = require("../src/leads/post-qualify-consult");
const { buildScopeReply } = require("../src/sales/discovery");
const { isPostQualify } = require("../src/leads/flow");
const { getPageContract } = require("../src/strategies/page-contracts");
const {
  asksForOwnPhone,
  deniesGivingPhone,
  isValidPhone,
} = require("../src/leads/extract");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const NO_PHONE_CLAIM = /đã có sđt|team sẽ gọi|team sabo đã có/i;

async function testNoPhoneNoFalseClaim() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "regression_no_phone";
  clearThread(page.id, senderId);

  setLeadProfile(
    page.id,
    senderId,
    { ...emptyProfile(), need: "Làm website bán hàng", qualified: true },
    page.projectSlug,
  );
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const contract = getPageContract(page);
    const profile = getLeadProfile(page.id, senderId);
    assert(!isPostQualify(profile, contract), "qualified flag alone must not trigger post-qualify");

    const fallback = buildPostQualifyFallback(
      page,
      profile,
      { honorific: "anh/chị" },
      "mày không tư vấn sơ về trang web à?",
    );
    assert(!NO_PHONE_CLAIM.test(fallback), `fallback must not claim SĐT: ${fallback}`);

    const { text } = await generateReply(page, senderId, "m có trả lời được gì đâu");
    assert(!NO_PHONE_CLAIM.test(text), `frustration reply must not claim SĐT: ${text}`);
    assert(/xin lỗi|scope|sđt|zalo/i.test(text), "frustration should offer help or ask SĐT");
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }

  console.log("  no phone → no false SĐT claim: OK");
}

async function testAskOwnPhoneNoPhone() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "regression_ask_phone";
  clearThread(page.id, senderId);

  setLeadProfile(
    page.id,
    senderId,
    { ...emptyProfile(), need: "website" },
    page.projectSlug,
  );
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

  assert(asksForOwnPhone("số điện thoại của tôi là gì?"), "detect phone recall question");

  const { text, layer } = await generateReply(page, senderId, "số điện thoại của tôi là gì?");
  assert(layer === "phone-recall", `expected phone-recall, got ${layer}`);
  assert(/chưa lưu|chưa có|xin.*sđt|xin.*zalo/i.test(text), `must ask for SĐT: ${text}`);
  assert(!/đã có sđt/i.test(text), "must not claim has SĐT");

  console.log("  ask own phone (none stored): OK");
}

async function testAskOwnPhoneWithPhone() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "regression_ask_phone_yes";
  clearThread(page.id, senderId);

  setLeadProfile(
    page.id,
    senderId,
    { ...emptyProfile(), need: "website", phone: "0961167717", qualified: true },
    page.projectSlug,
  );
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

  const { text, layer } = await generateReply(page, senderId, "số điện thoại của tôi là gì?");
  assert(layer === "phone-recall", `expected phone-recall, got ${layer}`);
  assert(/0961167717/.test(text), `must echo phone: ${text}`);

  console.log("  ask own phone (stored): OK");
}

async function testPhoneDenial() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "regression_phone_deny";
  clearThread(page.id, senderId);

  setLeadProfile(
    page.id,
    senderId,
    { ...emptyProfile(), need: "website", phone: "0900000000", qualified: true },
    page.projectSlug,
  );
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

  assert(deniesGivingPhone("tao đã gửi số dt cho mày đâu"), "detect phone denial");

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const { layer } = await generateReply(page, senderId, "tao đã gửi số dt cho mày đâu");
    assert(layer === "fallback-no-llm" || /^llm/.test(layer), `phone denial via LLM/fallback, got ${layer}`);
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }

  const profile = getLeadProfile(page.id, senderId);
  assert(!profile.phone, "phone must be cleared after denial");
  assert(!profile.qualified, "qualified must be cleared after denial");

  console.log("  phone denial clears false data: OK");
}

async function testScopeRequest() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "regression_scope";
  clearThread(page.id, senderId);

  setLeadProfile(
    page.id,
    senderId,
    { ...emptyProfile(), need: "Làm website bán hàng" },
    page.projectSlug,
  );
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

  const scopeDirect = buildScopeReply(page, { honorific: "anh/chị" }, "ok, gợi scope đi", "web-lead");
  assert(/trang|landing|form|zalo|tuần/i.test(scopeDirect), `scope reply concrete: ${scopeDirect}`);
  assert(!/^chào.*có gì thắc mắc/i.test(scopeDirect), "scope must not be generic greeting");

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const { layer } = await generateReply(page, senderId, "ok, gợi scope đi");
    assert(
      layer === "fallback-no-llm" || /^llm/.test(layer),
      `scope via prompt/LLM path, not sales-scope handler — got ${layer}`,
    );
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }

  console.log("  scope request web-lead: OK");
}

function testPhoneValidation() {
  assert(isValidPhone("0961167717"), "valid VN mobile");
  assert(!isValidPhone("12345"), "invalid short");
  assert(!isValidPhone(""), "empty");
  console.log("  phone validation: OK");
}

const { detectServicesQuestion } = require("../src/sales/discovery");

const ASK_CONTACT = /cho em xin sđt|cho em xin email|xin sđt hoặc email/i;
const SERVICES_KW = /website|lead|sabohub|bot|automation|sabo m&t|dịch vụ/i;

async function testServicesWithPhone() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "regression_services_with_phone";
  clearThread(page.id, senderId);

  const question = "bên bạn có những dịch vụ gì ?";
  assert(detectServicesQuestion(question), "CEO question must detect as services");

  setLeadProfile(
    page.id,
    senderId,
    { ...emptyProfile(), phone: "0961167717", qualified: true, need: "Làm website" },
    page.projectSlug,
  );
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  process.env.GROQ_API_KEY = "test-key-stub";
  process.env.OPENAI_API_KEY = "test-key-stub";

  const llmPath = require.resolve("../src/ai/llm");
  const routerPath = require.resolve("../src/ai/router");
  const llm = require(llmPath);
  const origChat = llm.chatCompletion;
  llm.chatCompletion = async () => {
    throw new Error("LLM stub fail 429");
  };
  delete require.cache[routerPath];
  const { generateReply } = require(routerPath);

  try {
    const { text, layer } = await generateReply(page, senderId, question);
    assert(layer === "sales-discovery", `expected sales-discovery, got ${layer}`);
    assert(SERVICES_KW.test(text), `must list services: ${text.slice(0, 160)}`);
    assert(!ASK_CONTACT.test(text), `must NOT ask SĐT when has phone: ${text}`);
  } finally {
    llm.chatCompletion = origChat;
    delete require.cache[routerPath];
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    else delete process.env.GROQ_API_KEY;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
    else delete process.env.OPENAI_API_KEY;
  }

  console.log("  services + phone (LLM fail): OK");
}

async function testFallbackNoReaskPhone() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "regression_fallback_has_phone";
  clearThread(page.id, senderId);

  setLeadProfile(
    page.id,
    senderId,
    { ...emptyProfile(), phone: "0961167717", qualified: true, need: "Làm website" },
    page.projectSlug,
  );
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const { text, layer } = await generateReply(page, senderId, "ok em hiểu rồi");
    assert(layer === "fallback-no-llm", `expected fallback-no-llm, got ${layer}`);
    assert(!ASK_CONTACT.test(text), `fallback with phone must not re-ask contact: ${text}`);
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }

  console.log("  fallback-no-llm + phone: OK");
}

async function testBilliardsNoAgencyScopeLeak() {
  loadPageRegistry();
  const page = getPage("569652129566651"); // App Quản lý Giải Đấu Billiards
  assert(page, "App Billiards page must exist");

  const testTexts = [
    "Em nghe rồi ạ",
    "Tư vấn giúp em",
    "App này như thế nào",
    "Cho anh hỏi dịch vụ",
    "Gợi scope giúp em",
  ];

  const profile = { ...emptyProfile(), phone: "0961167717", qualified: true, need: "quản lý giải" };
  const meta = { honorific: "anh/chị", profileName: "Long Sang", fbProfileFetched: true };

  const LEAK_PATTERNS = /quy mô sme|bản chạy nhanh rồi iterate|muốn em gợi scope cụ thể|gợi scope và lộ trình phù hợp|web bán hàng|full giỏ hàng/i;

  const { buildPreferenceReply } = require("../src/sales/discovery");
  const { buildPricingHandoffReply, buildPricingPolicyPromptBlock } = require("../src/sales/pricing-policy");
  const { buildSystemPrompt } = require("../src/ai/prompt-builder");
  const { selectDifyAppToken } = require("../src/ai/dify-client");

  const billiardsPageIds = [
    "569652129566651",
    "118356497898536",
    "719273174600166",
    "981040798421726",
    "1284910878042165",
  ];

  for (const pid of billiardsPageIds) {
    const bPage = getPage(pid);
    if (!bPage) continue;

    for (const t of testTexts) {
      const fallback = buildPostQualifyFallback(bPage, profile, meta, t);
      assert(!LEAK_PATTERNS.test(fallback), `Page ${pid} leaked SME agency copy on input "${t}": ${fallback}`);
      assert(/bida|billiards|giải|sabo arena|đặt bàn|clb/i.test(fallback), `Page ${pid} must retain billiards context: ${fallback}`);

      const scopeReply = buildScopeReply(bPage, meta, t, "web-lead");
      assert(!LEAK_PATTERNS.test(scopeReply), `Page ${pid} scope reply leaked SME agency copy: ${scopeReply}`);
      assert(/billiards|bida|sabo arena|giải/i.test(scopeReply), `Page ${pid} scope reply must retain billiards context: ${scopeReply}`);

      const prefReply = buildPreferenceReply(bPage, meta, "app bida");
      assert(!LEAK_PATTERNS.test(prefReply), `Page ${pid} preference reply leaked SME agency copy: ${prefReply}`);
      assert(!/flutter|supabase|4–8 tuần|pilot 4–6/i.test(prefReply), `Page ${pid} must not leak agency stack: ${prefReply}`);
      assert(/sabo arena|bida|giải/i.test(prefReply), `Page ${pid} preference reply must be Arena bida: ${prefReply}`);
    }

    // Test pricing reply
    const pricingReply = buildPricingHandoffReply(bPage, profile, meta);
    assert(!/giá phụ thuộc scope/i.test(pricingReply), `Page ${pid} pricing reply must not say scope: ${pricingReply}`);
    assert(/miễn phí|299k|club pro|sabo arena/i.test(pricingReply), `Page ${pid} pricing reply must mention Arena/Club Pro: ${pricingReply}`);

    // Test Dify App token
    const difyNormal = selectDifyAppToken(bPage, "hướng dẫn tải app");
    assert(difyNormal.botKey === "arena", `Page ${pid} normal inquiry must route to arena dify bot, got: ${difyNormal.botKey}`);
    const difyB2B = selectDifyAppToken(bPage, "tôi muốn mua gói pro mở clb bida");
    assert(difyB2B.botKey === "arena_b2b", `Page ${pid} B2B inquiry must route to arena_b2b dify bot, got: ${difyB2B.botKey}`);

    // Test System Prompt
    const sysPrompt = buildSystemPrompt({ page: bPage, sessionMeta: meta, leadProfile: profile });
    assert(!/phù hợp quy mô sme/i.test(sysPrompt), `Page ${pid} system prompt must NOT instruct "phù hợp quy mô SME"`);
    assert(!/làm rõ scope/i.test(sysPrompt), `Page ${pid} system prompt must NOT contain "làm rõ scope"`);
    assert(!/giá tùy scope/i.test(sysPrompt), `Page ${pid} system prompt must NOT contain "giá tùy scope"`);
    assert(!/ưu tiên bản chạy nhanh rồi iterate/i.test(sysPrompt), `Page ${pid} system prompt must NOT contain iterate copy`);
    assert(sysPrompt.includes("UYỂN NHI — Đại sứ hỗ trợ cộng đồng cơ thủ và CLB Bida SABO ARENA"), `Page ${pid} must use Uyển Nhi Arena persona`);
  }

  const { buildVerticalBehaviorBlock } = require("../src/ai/prompt-builder");
  const verticalBlock = buildVerticalBehaviorBlock(page);
  assert(verticalBlock.includes("HÀNH VI BIDA"), "Billiards prompt must use billiards behavior block, not fall back to sabo-mt");
  assert(!verticalBlock.includes("HÀNH VI SABO M&T"), "Billiards prompt must NOT contain sabo-mt behavior block");

  console.log("  billiards persona isolation (zero SME agency copy leak): OK");
}

async function main() {
  console.log("\n=== Conversation Regression Tests ===\n");
  testPhoneValidation();
  await testNoPhoneNoFalseClaim();
  await testAskOwnPhoneNoPhone();
  await testAskOwnPhoneWithPhone();
  await testPhoneDenial();
  await testScopeRequest();
  await testServicesWithPhone();
  await testFallbackNoReaskPhone();
  await testBilliardsNoAgencyScopeLeak();
  console.log("\nAll conversation regression tests passed.\n");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
