/**
 * Pricing policy smoke tests — no invented VND in customer replies.
 * Usage: npm run test:pricing-policy
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
process.env.LEAD_QUEUE_DRY_RUN = "1";
process.env.HERMES_ENABLED = "false";

const { loadPageRegistry, getPage } = require("../src/pages");
const { generateReply } = require("../src/ai/router");
const { clearThread, setLeadProfile, setSessionMeta } = require("../src/session/store");
const { emptyProfile } = require("../src/leads/flow");
const {
  isPricingQuestion,
  containsVndPricePattern,
  buildPricingHandoffReply,
} = require("../src/sales/pricing-policy");
const { buildPostQualifyFallback } = require("../src/leads/post-qualify-consult");
const { buildDiscoveryReply } = require("../src/sales/discovery");

const PAGE_ID = "332950393234346";
const VND_LEAK = /\d[\d.,]*\s*(?:đ|đồng|triệu|tr\/|k\/)|\d[\d.,]*\s*tr\b|500\.?\d{3}|Gói\s+(?:Basic|Advanced)/i;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertNoVnd(text, label) {
  assert(!containsVndPricePattern(text), `${label}: must not contain VND price patterns — got: ${text.slice(0, 160)}`);
  assert(!VND_LEAK.test(text), `${label}: must not leak VND numbers — got: ${text.slice(0, 160)}`);
}

function testDetection() {
  assert(isPricingQuestion("giá làm website bao nhiêu"), "website price question");
  assert(isPricingQuestion("bảng giá content AI quán bida"), "content pricing table");
  assert(isPricingQuestion("giá cả như nào"), "giá cả");
  assert(!isPricingQuestion("0961167717"), "phone-only not pricing");
}

function testHandoffReply() {
  const page = { projectSlug: "sabo-mt", id: "test" };
  const meta = { honorific: "anh/chị", profileName: "CEO" };

  const noPhone = buildPricingHandoffReply(page, emptyProfile(), meta);
  assertNoVnd(noPhone, "handoff without phone");
  assert(/zalo|sđt/i.test(noPhone), "handoff without phone asks Zalo/SĐT");
  assert(/báo giá chi tiết/i.test(noPhone), "handoff mentions official quote via Zalo");

  const withPhone = buildPricingHandoffReply(
    page,
    { ...emptyProfile(), phone: "0961167717" },
    meta,
  );
  assertNoVnd(withPhone, "handoff with phone");
  assert(/zalo|sđt|liên hệ/i.test(withPhone), "handoff with phone references saved contact");
}

function testDiscoveryNoPrices() {
  const page = { projectSlug: "sabo-mt", id: "test" };
  const meta = { honorific: "anh/chị" };
  const reply = buildDiscoveryReply(page, meta, "có dịch vụ gì thú vị không");
  assertNoVnd(reply, "discovery reply");
  assert(!/15[–-]50/.test(reply), "discovery must not mention 15-50tr");
}

function testPostQualifyPricingHandoff() {
  const page = { projectSlug: "sabo-mt" };
  const profile = {
    ...emptyProfile(),
    need: "content AI quán bida",
    phone: "0961167717",
    qualified: true,
  };
  const meta = { honorific: "anh/chị" };
  const reply = buildPostQualifyFallback(page, profile, meta, "giá cả như nào");
  assertNoVnd(reply, "post-qualify pricing");
  assert(reply.length < 280, "post-qualify pricing must be short handoff, not essay");
  assert(!/Gói Basic|500\.000/i.test(reply), "no invented packages");
}

async function testRouterLayers() {
  loadPageRegistry();
  const page = getPage(PAGE_ID);

  const cases = [
    { senderId: "test_pricing_web", text: "giá làm website bao nhiêu", needContact: true },
    { senderId: "test_pricing_content", text: "bảng giá content AI quán bida", needContact: true },
  ];

  for (const c of cases) {
    clearThread(page.id, c.senderId);
    setLeadProfile(page.id, c.senderId, emptyProfile(), page.projectSlug);
    setSessionMeta(page.id, c.senderId, { honorific: "anh/chị", fbProfileFetched: true }, page.projectSlug);

    const { text, layer } = await generateReply(page, c.senderId, c.text);
    assert(layer === "pricing-handoff", `expected pricing-handoff for "${c.text}", got ${layer}`);
    assertNoVnd(text, `router ${c.text}`);
    if (c.needContact) {
      assert(/zalo|sđt/i.test(text), `router must ask Zalo/SĐT for "${c.text}"`);
    }
  }

  clearThread(page.id, "test_pricing_qualified");
  setLeadProfile(
    page.id,
    "test_pricing_qualified",
    { ...emptyProfile(), need: "website", phone: "0961167717", qualified: true },
    page.projectSlug,
  );
  setSessionMeta(
    page.id,
    "test_pricing_qualified",
    { honorific: "anh/chị", fbProfileFetched: true },
    page.projectSlug,
  );
  const { text: pqText, layer: pqLayer } = await generateReply(
    page,
    "test_pricing_qualified",
    "giá cả như nào",
  );
  assert(pqLayer === "pricing-handoff", `post-qualify pricing layer, got ${pqLayer}`);
  assertNoVnd(pqText, "post-qualify router pricing");
  assert(/zalo|sđt|liên hệ/i.test(pqText), "qualified pricing references saved contact");
}

async function main() {
  console.log("test:pricing-policy");
  testDetection();
  console.log("  isPricingQuestion: OK");
  testHandoffReply();
  console.log("  buildPricingHandoffReply: OK");
  testDiscoveryNoPrices();
  console.log("  discovery without prices: OK");
  testPostQualifyPricingHandoff();
  console.log("  post-qualify pricing handoff: OK");
  await testRouterLayers();
  console.log("  router pricing-handoff layer: OK");
  console.log("\nAll pricing policy tests passed.\n");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
