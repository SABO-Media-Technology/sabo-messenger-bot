/**

 * Unit test — lead extraction + progressive flow + vertical segmentation.

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

const {

  getPageContract,

  getVertical,

  getVerticalId,

  VERTICALS,

} = require("../src/strategies/page-contracts");

const { getSystemPrompt } = require("../src/responses/prompts");

const { getUyenNhiBlock } = require("../src/personas/uyen-nhi");

const { generateReply } = require("../src/ai/router");

const { clearThread } = require("../src/session/store");

const { matchTemplate } = require("../src/ai/templates");



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

  assert(contract.vertical === "sabo-mt-services", "sabo-mt vertical");

  assert(contract.leadFields.includes("need"), "has need field");

  assert(contract.leadFields.includes("contact"), "has contact field");



  let p = emptyProfile();

  assert(getNextMissingField(p, contract) === "need", "first missing = need");

  p.need = "Làm website";

  assert(getNextMissingField(p, contract) === "contact", "second = contact");

  p.phone = "0901234567";

  assert(isLeadComplete(p, contract) === true, "complete with need+contact");

  assert(getNextMissingField(p, contract) === "business_type", "optional field next");

}



function testVerticalMapping() {

  const expected = {

    "sabo-mt": "sabo-mt-services",

    "sabo-billiards": "billiards-ops",

    "sabo-arena": "billiards-ops",

    ainewbie: "ai-education",

    "ai-art": "ai-education",

    vungtau: "real-estate",

    sabohub: "platform",

  };

  for (const [slug, vertical] of Object.entries(expected)) {

    assert(getVerticalId({ projectSlug: slug }) === vertical, `vertical ${slug}`);

    assert(VERTICALS[vertical], `vertical def ${vertical}`);

  }

  console.log("  vertical mapping (7 slugs → 5 verticals): OK");

}



function testBilliardsNoHotlineGreeting() {

  const page = { projectSlug: "sabo-billiards" };

  const contract = getPageContract(page);

  assert(!contract.greetingIntro.includes("0798893333"), "billiards greeting no hotline");

  assert(contract.persona === "venue", "billiards venue persona");

}



function testVerticalTemplates() {

  const billiards = matchTemplate("Đặt bàn chiều nay", { projectSlug: "sabo-billiards" });

  assert(billiards && /đặt bàn|sđt/i.test(billiards), "billiards book template");



  const bds = matchTemplate("Giá nhà Vũng Tàu", { projectSlug: "vungtau" });

  assert(bds && /khu|sđt/i.test(bds), "real-estate pricing template");

}



function testPromptHasPersonaAndVertical() {

  const page = { projectSlug: "ainewbie" };

  const block = buildLeadPromptBlock(page, emptyProfile());

  const sys = getSystemPrompt(page, block);

  assert(sys.includes("UYỂN NHI"), "system has Uyển Nhi");

  assert(sys.includes("AI EDUCATION"), "system has vertical block");

  assert(sys.includes("THIẾU"), "system has missing field hint");

  assert(getUyenNhiBlock().includes("em"), "DNA voice");



  const billiardsPage = { projectSlug: "sabo-billiards" };

  const billiardsSys = getSystemPrompt(billiardsPage, "");

  assert(billiardsSys.includes("BILLIARDS OPS"), "billiards vertical in prompt");

  assert(billiardsSys.includes("NHÂN VIÊN"), "venue persona block");

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

  console.log("\n=== Lead Flow + Vertical Tests ===\n");

  testExtract();

  console.log("  extract entities: OK");

  testFlowContract();

  console.log("  page contract flow: OK");

  testVerticalMapping();

  testBilliardsNoHotlineGreeting();

  console.log("  billiards no-hotline greeting: OK");

  testVerticalTemplates();

  console.log("  vertical templates: OK");

  testPromptHasPersonaAndVertical();

  console.log("  persona + vertical in system prompt: OK");

  await testMultiTurn();

  console.log("\nAll lead-flow tests passed.\n");

}



main().catch((err) => {

  console.error("FAIL:", err.message);

  process.exit(1);

});


