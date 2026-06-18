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

  const { text, layer } = await generateReply(page, senderId, "tao đã gửi số dt cho mày đâu");
  assert(layer === "phone-denial", `expected phone-denial, got ${layer}`);
  assert(/xin lỗi|nhầm/i.test(text), `must apologize: ${text}`);
  assert(/xin.*sđt|xin.*zalo/i.test(text), `must ask phone: ${text}`);

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

  const { text, layer } = await generateReply(page, senderId, "ok, gợi scope đi");
  assert(layer === "sales-scope", `expected sales-scope, got ${layer}`);
  assert(/trang|landing|form|zalo|tuần/i.test(text), `router scope concrete: ${text}`);
  assert(!/có gì thắc mắc về dự án/i.test(text), "must not be generic greeting");

  console.log("  scope request web-lead: OK");
}

function testPhoneValidation() {
  assert(isValidPhone("0961167717"), "valid VN mobile");
  assert(!isValidPhone("12345"), "invalid short");
  assert(!isValidPhone(""), "empty");
  console.log("  phone validation: OK");
}

async function main() {
  console.log("\n=== Conversation Regression Tests ===\n");
  testPhoneValidation();
  await testNoPhoneNoFalseClaim();
  await testAskOwnPhoneNoPhone();
  await testAskOwnPhoneWithPhone();
  await testPhoneDenial();
  await testScopeRequest();
  console.log("\nAll conversation regression tests passed.\n");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
