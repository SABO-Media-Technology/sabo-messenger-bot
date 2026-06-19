/**
 * Unit test — lead extraction + progressive flow + vertical segmentation + session memory.
 * Usage: npm run test:lead-flow
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
process.env.LEAD_QUEUE_DRY_RUN = "1";

const { loadPageRegistry, getPage } = require("../src/pages");
const { mergeLeadProfile, looksLikeConsultationQuestion } = require("../src/leads/extract");
const {
  emptyProfile,
  getNextMissingField,
  isLeadComplete,
  isPostQualify,
  buildLeadPromptBlock,
  buildPostQualifyBlock,
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
const { clearThread, setSessionMeta, setLeadProfile, getLeadProfile } = require("../src/session/store");
const { refusesName } = require("../src/leads/extract");
const { buildGreetingForSession, shouldSkipNameField } = require("../src/leads/flow");
const { matchTemplate } = require("../src/ai/templates");
const { buildPostQualifyFallback } = require("../src/leads/post-qualify-consult");
const { detectSalesIntent, buildDiscoveryReply, isDiscoveryQuestion } = require("../src/sales/discovery");
const { extractNeedUpdate } = require("../src/leads/extract");
const { getHistory } = require("../src/session/store");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testSalesDiscoveryIntent() {
  assert(isDiscoveryQuestion("có dịch vụ công nghệ nào thú vị không?"), "discovery detect");
  assert(isDiscoveryQuestion("bên em làm gì được"), "discovery làm gì");
  assert(!isDiscoveryQuestion("giá website bao nhiêu"), "pricing not discovery");
  assert(detectSalesIntent("giá website bao nhiêu") === "pricing", "pricing intent");

  const page = { projectSlug: "sabo-mt" };
  const meta = { honorific: "anh/chị" };
  const reply = buildDiscoveryReply(page, meta, "có dịch vụ công nghệ nào thú vị không?");
  assert(/website|lead|SABOHUB|bot|automation|chatbot/i.test(reply), "discovery mentions concrete services");
  assert(!/^Với app, em thường tư vấn pilot MVP/i.test(reply), "no app MVP opener");
  assert(!/cần em làm rõ phần nào/i.test(reply), "no weak qualify closer");
  assert(/\?/.test(reply), "ends with engaging question");

  const postQualifyReply = buildPostQualifyFallback(
    page,
    { ...emptyProfile(), need: "Làm app mobile", phone: "0909", qualified: true },
    meta,
    "có dịch vụ công nghệ nào thú vị không?",
  );
  assert(!/Với app, em thường tư vấn pilot MVP/i.test(postQualifyReply), "post-qualify discovery not app MVP");
  assert(/website|lead|SABOHUB|bot|automation|chatbot/i.test(postQualifyReply), "post-qualify discovery has ideas");
  console.log("  sales discovery intent + reply: OK");
}

async function testSalesDiscoveryRouter() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_sales_discovery";
  clearThread(page.id, senderId);

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const { layer } = await generateReply(page, senderId, "có dịch vụ công nghệ nào thú vị không?");
    assert(
      layer === "fallback-no-llm" || /^llm/.test(layer),
      `thin router: discovery via LLM/fallback, not sales-discovery — got ${layer}`,
    );
    assert(layer !== "sales-discovery", "sales-discovery handler must be bypassed");
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }
  console.log("  sales discovery router: OK");
}

function testPostQualifyFallbackVaries() {
  const page = { projectSlug: "sabo-mt" };
  const profile = {
    ...emptyProfile(),
    need: "Làm website bán hàng",
    phone: "0961167717",
    qualified: true,
  };
  const meta = { honorific: "anh/chị" };

  const consultReply = buildPostQualifyFallback(
    page,
    profile,
    meta,
    "mày không tư vấn sơ về trang web à?",
  );
  const pricingReply = buildPostQualifyFallback(page, profile, meta, "giá cả như nào ?");
  const greetReply = buildPostQualifyFallback(page, profile, meta, "xin chào");

  assert(consultReply !== pricingReply, "post-qualify fallback must vary by intent");
  assert(/zalo|sđt|báo giá chi tiết|scope/i.test(pricingReply), "pricing reply is handoff without VND");
  assert(!/\d[\d.,]*\s*tr\b|15[–-]50|500\.?\d{3}/i.test(pricingReply), "pricing reply must not leak VND");
  assert(/web|landing|giỏ|form/i.test(consultReply), "consult reply mentions web advice");
  assert(!/\(1\)|\(2\)|\(3\)/.test(consultReply), "no numbered list in consult fallback");
  assert(/chào|dạ|ạ/i.test(greetReply), "greeting reply is casual");
  assert(!/xác định 3–5 tính năng/.test(greetReply), "greeting must not repeat app essay");
  assert(!/Về "/.test(greetReply), "greeting must not use stale need quote opener");

  const q1 = buildPostQualifyFallback(page, { ...profile, need: "Làm app mobile" }, meta, "app làm bao lâu");
  const q2 = buildPostQualifyFallback(page, { ...profile, need: "Làm app mobile" }, meta, "giá app thế nào");
  const q3 = buildPostQualifyFallback(page, { ...profile, need: "Làm app mobile" }, meta, "có làm được không");
  const unique = new Set([q1, q2, q3]);
  assert(unique.size >= 2, "different post-qualify questions should not all be identical");
}

function testPostQualifyGreetingNoStaleQuote() {
  const page = { projectSlug: "sabo-mt" };
  const profile = {
    ...emptyProfile(),
    need: "giờ tôi lại thích làm app rồi",
    phone: "0961167717",
    qualified: true,
  };
  const meta = { honorific: "anh/chị" };
  const reply = buildPostQualifyFallback(page, profile, meta, "xin chào");
  assert(!/giờ tôi lại thích làm app/i.test(reply), "greeting must not quote stale need pivot");
  assert(/hỗ trợ|tư vấn|nhắn|hỏi/i.test(reply), "greeting offers continued help");
  console.log("  post-qualify greeting no stale quote: OK");
}

function testNeedUpdateOnPivot() {
  const updated = extractNeedUpdate("giờ tôi lại thích làm app rồi", "Làm website bán hàng");
  assert(updated && /app/i.test(updated), "need updates on pivot to app");
}

async function testPostQualifyGreetingNoRepeatEssay() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_post_qualify_greeting";
  clearThread(page.id, senderId);

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    setLeadProfile(
      page.id,
      senderId,
      {
        ...emptyProfile(),
        need: "Làm website bán hàng",
        phone: "0961167717",
        qualified: true,
        queued: true,
      },
      page.projectSlug,
    );
    setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

    const { text: pivotText } = await generateReply(
      page,
      senderId,
      "giờ tôi lại thích làm app rồi",
    );
    const profileAfterPivot = getLeadProfile(page.id, senderId);
    assert(/app/i.test(profileAfterPivot.need || ""), "pivot updates lead need to app");

    const { text: greetText, layer } = await generateReply(page, senderId, "xin chào");
    assert(/chào|dạ|ạ|cảm ơn/i.test(greetText), "greeting is casual");
    assert(!/\(1\)|\(2\)|\(3\)/.test(greetText), "greeting has no numbered list");
    assert(!/xác định 3–5 tính năng/.test(greetText), "greeting must not repeat app essay");
    assert(
      layer === "greeting" ||
        layer === "post-qualify-casual" ||
        layer.includes("llm") ||
        layer.includes("fallback") ||
        layer.includes("consult"),
      `expected greeting/casual/LLM/fallback layer, got ${layer}`,
    );
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }

  console.log("  post-qualify greeting no essay repeat: OK");
}

async function testPostQualifyPricingNotIdentical() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_post_qualify_pricing";
  clearThread(page.id, senderId);

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    setLeadProfile(
      page.id,
      senderId,
      {
        ...emptyProfile(),
        need: "Làm website bán hàng",
        phone: "0961167717",
        qualified: true,
        queued: true,
      },
      page.projectSlug,
    );
    setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true });

    const { text: consultText } = await generateReply(
      page,
      senderId,
      "mày không tư vấn sơ về trang web à?",
    );
    const { text: pricingText } = await generateReply(page, senderId, "giá cả như nào ?");

    assert(consultText !== pricingText, "post-qualify turns must not repeat identical text");
    assert(/zalo|sđt|báo giá chi tiết|scope/i.test(pricingText), "pricing turn is handoff without VND");
    assert(!/\d[\d.,]*\s*tr\b|15[–-]50/i.test(pricingText), "pricing turn must not leak ballpark");
    assert(!/xin tên|cho em.*tên/i.test(pricingText), "no re-ask name after qualify");

    const history = getHistory(page.id, senderId);
    assert(history.length >= 2, "history records both post-qualify turns");
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
  }

  console.log("  post-qualify pricing ≠ consult (no LLM): OK");
}

function testExtract() {
  let p = emptyProfile();
  p = mergeLeadProfile(p, "Tên tôi là Nguyễn Văn A");
  assert(p.name === "Nguyễn Văn A", "extract name");

  p = mergeLeadProfile(p, "SĐT em 0912345678");
  assert(p.phone === "0912345678", "extract phone");

  p = mergeLeadProfile(p, "Em cần làm website bán hàng cho shop thời trang");
  assert(p.need && p.need.includes("website"), "extract need");

  assert(looksLikeConsultationQuestion("mày không tư vấn sơ về trang web à?"), "consult question detect");
  const noName = mergeLeadProfile(emptyProfile(), "mày không tư vấn sơ về trang web à?");
  assert(!noName.name, "consult question must not become name");
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
  assert(isPostQualify(p, contract), "post-qualify when complete");
  assert(!isPostQualify({ ...p, phone: null, qualified: true }, contract), "no post-qualify without phone");
  assert(getNextMissingField(p, contract, {}, { intakeOnly: false }) === "business_type", "optional field when intakeOnly=false");
}

function testPostQualifyPromptBlock() {
  const page = { projectSlug: "sabo-mt" };
  const profile = {
    ...emptyProfile(),
    name: "Nhi",
    phone: "0961167717",
    need: "Làm website bán hàng",
    qualified: true,
  };
  const block = buildLeadPromptBlock(page, profile, { firstName: "Nhi", profileName: "Nhi" });
  assert(block.includes("CHẾ ĐỘ TƯ VẤN SAU QUALIFY"), "has post-qualify block");
  assert(!block.includes("THIẾU: tên"), "no missing name in post-qualify");
  assert(!block.includes("THIẾU (chỉ hỏi"), "no intake missing field in post-qualify");
  assert(buildPostQualifyBlock(profile).includes("KHÔNG hỏi lại tên"), "post-qualify forbids re-ask name");
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

function testNameRefusalAndFbProfile() {
  assert(refusesName("tao không muốn cho mày biết tên"), "detect name refusal");

  const page = { projectSlug: "sabo-mt" };
  const meta = { profileName: "Trần Minh", firstName: "Minh", nameRefused: true };
  const greeting = buildGreetingForSession(page, meta);
  assert(!/xin tên|cho em.*tên/i.test(greeting), "greeting no ask name when refused");
  assert(/anh\/chị/i.test(greeting), "uses anh/chị");

  const block = buildLeadPromptBlock(page, emptyProfile(), meta);
  assert(block.includes("KHÔNG hỏi"), "lead block forbids ask name");
  assert(!block.includes("THIẾU: tên"), "no missing name field");
}

function testProductInquiryTemplate() {
  const hit = matchTemplate("ngoài học ra thì còn sản phẩm gì", { projectSlug: "ainewbie" });
  assert(hit && /sđt|zalo/i.test(hit), "product inquiry asks contact");
  assert(!hit.includes("0798893333"), "no hotline dump");

  const budget = matchTemplate("ngân sách 100k làm web được không", { projectSlug: "sabo-mt" });
  assert(budget && !/0798893333/.test(budget), "budget question no hotline");
}

function testTemplateSkipsIntakeWhenQualified() {
  const page = { projectSlug: "sabo-mt" };
  const profile = {
    ...emptyProfile(),
    need: "website",
    phone: "0961167717",
    qualified: true,
  };
  const hit = matchTemplate("bên em có làm app không", page, { profile, postQualify: true });
  assert(hit === null, "qualified lead skips intake template — LLM consults instead");
}

function testBilliardsNoHotlineGreeting() {
  const page = { projectSlug: "sabo-billiards" };
  const contract = getPageContract(page);
  assert(!contract.greetingIntro.includes("0798893333"), "billiards greeting no hotline");
  assert(contract.persona === "venue", "billiards venue persona");
  assert(!/xin tên/i.test(contract.greetingIntro), "billiards greeting no ask name");
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

async function testNameRefusalReply() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_name_refusal";
  clearThread(page.id, senderId);
  setSessionMeta(page.id, senderId, {
    profileName: "Nguyễn Test",
    firstName: "Test",
    fbProfileFetched: true,
    nameRefused: false,
  });

  const { text } = await generateReply(page, senderId, "tao không muốn cho mày biết tên");
  assert(!/xin tên|cho em.*tên|không thể thấy tên/i.test(text), "no ask name on refusal");
  assert(/anh\/chị/i.test(text), "uses anh/chị on refusal");
  console.log("  name refusal + FB profile: OK");
}

async function testSaboMtPostQualifyMultiTurn() {
  loadPageRegistry();
  const page = getPage("332950393234346");
  const senderId = "test_sabo_mt_post_qualify";
  clearThread(page.id, senderId);

  const turns = [
    { in: "Em cần làm website bán hàng", checkProfile: (p) => Boolean(p.need) },
    { in: "nhi", checkProfile: (p) => p.name === "nhi" },
    { in: "0961167717", checkProfile: (p) => p.phone === "0961167717" && p.qualified },
    {
      in: "mày không tư vấn sơ về trang web à?",
      checkReply: (t) =>
        !/xin tên|cho em.*tên|tên là gì|không thể thấy tên/i.test(t) &&
        !/ngành|lĩnh vực kinh doanh/i.test(t),
    },
  ];

  for (const turn of turns) {
    const { text } = await generateReply(page, senderId, turn.in);
    const profile = getLeadProfile(page.id, senderId);
    if (turn.checkProfile) assert(turn.checkProfile(profile), `profile after: ${turn.in}`);
    if (turn.checkReply) assert(turn.checkReply(text), `reply must consult, not re-intake: ${text.slice(0, 120)}`);
  }

  console.log("  SABO M&T post-qualify multi-turn: OK");
}

async function testMultiTurnAinewbie() {
  loadPageRegistry();
  const page = getPage("569671719553461");
  const senderId = "test_lead_flow_multi";
  clearThread(page.id, senderId);

  const turns = [
    { in: "Xin chào", expectLayer: "greeting", check: (t) => /Uyển Nhi/i.test(t) },
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
  console.log("\n=== Lead Flow + Vertical + Session Memory Tests ===\n");
  testExtract();
  console.log("  extract entities: OK");
  testFlowContract();
  console.log("  page contract flow: OK");
  testPostQualifyPromptBlock();
  console.log("  post-qualify prompt block: OK");
  testPostQualifyFallbackVaries();
  console.log("  post-qualify fallback varies by intent: OK");
  testSalesDiscoveryIntent();
  testPostQualifyGreetingNoStaleQuote();
  testNeedUpdateOnPivot();
  console.log("  need pivot web→app: OK");
  testVerticalMapping();
  testNameRefusalAndFbProfile();
  console.log("  FB profile + name refusal rules: OK");
  testProductInquiryTemplate();
  console.log("  product inquiry / budget no hotline: OK");
  testTemplateSkipsIntakeWhenQualified();
  console.log("  template skips intake when qualified: OK");
  testBilliardsNoHotlineGreeting();
  console.log("  billiards no-hotline greeting: OK");
  testVerticalTemplates();
  console.log("  vertical templates: OK");
  testPromptHasPersonaAndVertical();
  console.log("  persona + vertical in system prompt: OK");

  await testNameRefusalReply();
  await testSalesDiscoveryRouter();
  await testSaboMtPostQualifyMultiTurn();
  await testPostQualifyPricingNotIdentical();
  await testPostQualifyGreetingNoRepeatEssay();
  await testMultiTurnAinewbie();

  console.log("\nAll lead-flow tests passed.\n");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
