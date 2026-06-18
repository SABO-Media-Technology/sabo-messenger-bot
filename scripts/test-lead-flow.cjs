/**
 * Unit test — lead extraction + progressive flow (no LLM / no FB).
 * Usage: npm run test:lead-flow
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
process.env.LEAD_QUEUE_DRY_RUN = "1";

const { loadPageRegistry, getPage } = require("../src/pages");
const { mergeLeadProfile } = require("../src/leads/extract");
const {
  emptyProfile,
  getNextMissingField,
  isLeadComplete,
  buildLeadPromptBlock,
} = require("../src/leads/flow");
const { getPageContract } = require("../src/strategies/page-contracts");
const { getSystemPrompt } = require("../src/responses/prompts");
const { getUyenNhiBlock } = require("../src/personas/uyen-nhi");
const { generateReply } = require("../src/ai/router");
const { clearThread } = require("../src/session/store");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testExtract() {
  let p = emptyProfile();
  p = mergeLeadProfile(p, "Tên tôi là Nguyễn Văn A");
  assert(p.name === "Nguyễn Văn A", "extract name");

  p = mergeLeadProfile(p, "SĐT em 0912345678");
  assert(p.phone === "0912345678", "extract phone");

  p = mergeLeadProfile(p, "Em cần làm website bán hàng cho shop thời trang");
  assert(p.need && p.need.includes("website"), "extract need");
}

function testFlowContract() {
  const page = { projectSlug: "sabo-mt" };
  const contract = getPageContract(page);
  assert(contract.persona === "uyen_nhi", "sabo-mt persona");
  assert(contract.leadFields.includes("name"), "has name field");

  let p = emptyProfile();
  assert(getNextMissingField(p, contract) === "name", "first missing = name");
  p.name = "Lan";
  assert(getNextMissingField(p, contract) === "contact", "second = contact");
  p.phone = "0901234567";
  p.need = "Làm app quản lý";
  assert(isLeadComplete(p, contract) === true, "complete with name+contact+need");
  assert(getNextMissingField(p, contract) === "business_type", "optional field next");
}

function testNoHotlineDump() {
  const { matchTemplate } = require("../src/ai/templates");
  const page = { projectSlug: "ainewbie", tier: "t1" };
  const q = "ngoài học ra thì còn sản phẩm gì nữa không?";
  const hit = matchTemplate(q, page);
  assert(hit, "product question should match template");
  assert(!/0798893333/i.test(hit), "template must not dump hotline");
  assert(/sđt|email|liên hệ/i.test(hit), "template must ask contact");

  const block = buildLeadPromptBlock(page, emptyProfile());
  const sys = getSystemPrompt(page, block);
  assert(!/kết thúc bằng hotline/i.test(sys), "system must not mandate hotline CTA");
  assert(/KHÔNG đưa số hotline/i.test(sys), "lead block must forbid hotline dump");
  assert(/THIẾU.*liên hệ|SĐT hoặc email/i.test(sys), "must inject contact ask");
}

function testPromptHasPersona() {
  const page = { projectSlug: "ainewbie" };
  const block = buildLeadPromptBlock(page, emptyProfile());
  const sys = getSystemPrompt(page, block);
  assert(sys.includes("UYỂN NHI"), "system has Uyển Nhi");
  assert(sys.includes("THIẾU"), "system has missing field hint");
  assert(getUyenNhiBlock().includes("em"), "DNA voice");
  assert(getUyenNhiBlock().includes("THU LEAD"), "DNA has lead capture");
}

async function testMultiTurn() {
  loadPageRegistry();
  const page = getPage("569671719553461"); // AI Newbie VN
  const senderId = "test_lead_flow_multi";
  clearThread(page.id, senderId);

  const turns = [
    { in: "Xin chào", expectLayer: "greeting-intro", check: (t) => /Uyển Nhi/i.test(t) },
    { in: "Em tên Minh", check: (t) => t.length > 10 },
    { in: "0909888777", check: (t) => t.length > 10 },
    { in: "Em muốn học ChatGPT cho công việc marketing", check: (t) => t.length > 10 },
  ];

  for (const turn of turns) {
    const { text, layer } = await generateReply(page, senderId, turn.in);
    if (turn.expectLayer) assert(layer === turn.expectLayer, `layer ${turn.expectLayer}`);
    assert(turn.check(text), `reply ok for: ${turn.in}`);
  }

  console.log("  multi-turn AI Newbie VN: OK");
}

async function main() {
  console.log("\n=== Lead Flow Unit Tests ===\n");
  testExtract();
  console.log("  extract entities: OK");
  testFlowContract();
  console.log("  page contract flow: OK");
  testNoHotlineDump();
  console.log("  no hotline dump on product Q: OK");
  testPromptHasPersona();
  console.log("  persona in system prompt: OK");
  await testMultiTurn();
  console.log("\nAll lead-flow tests passed.\n");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
