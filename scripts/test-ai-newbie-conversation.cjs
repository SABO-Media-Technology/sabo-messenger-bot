/**
 * AI Newbie VN — regression from CEO bad conversation (2026-06-19).
 * Usage: node scripts/test-ai-newbie-conversation.cjs
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
process.env.LEAD_QUEUE_DRY_RUN = "1";

const { loadPageRegistry, getPage } = require("../src/pages");
const { emptyProfile } = require("../src/leads/flow");
const { generateReply } = require("../src/ai/router");
const { clearThread, setLeadProfile, setSessionMeta } = require("../src/session/store");
const { getVerticalId } = require("../src/strategies/page-contracts");
const {
  asksForOwnPhone,
  isChurnIntent,
  isPageCorrectionIntent,
} = require("../src/leads/extract");

const AI_NEWBIE_PAGE_ID = "569671719553461";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const NO_PIVOT = /đổi sang/i;
const NO_FALSE_SDT = /sđt đã lưu|đã có sđt|team sẽ gọi|team sabo đã có/i;
const NO_SME_SCOPE = /scope web|quy mô sme|landing thu lead/i;

async function runConversation() {
  loadPageRegistry();
  const page = getPage(AI_NEWBIE_PAGE_ID);
  assert(page, "AI Newbie page must exist in registry");
  assert(page.projectSlug === "ainewbie", `projectSlug must be ainewbie, got ${page.projectSlug}`);
  assert(page.replyStrategy === "rag-mini", `replyStrategy must be rag-mini, got ${page.replyStrategy}`);

  const verticalId = getVerticalId(page);
  assert(verticalId === "ai-education", `vertical must be ai-education, got ${verticalId}`);

  const senderId = "ceo_ai_newbie_regression";
  clearThread(page.id, senderId);
  setLeadProfile(page.id, senderId, { ...emptyProfile() }, page.projectSlug);
  setSessionMeta(page.id, senderId, { honorific: "anh/chị", fbProfileFetched: true }, page.projectSlug);

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  const savedHermes = process.env.HERMES_REPLY_ENABLED;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.HERMES_REPLY_ENABLED;

  const messages = [
    "thì khoảng bao nhiêu",
    "tôi không làm nữa",
    "bạn có số dt của tôi chưa?",
    "nhưng mà page của bạn là về khóa học AI mà",
  ];

  const outputs = [];

  try {
    for (const msg of messages) {
      const { text, layer } = await generateReply(page, senderId, msg);
      outputs.push({ msg, text, layer });
    }

    console.log("\n=== AI Newbie VN — CEO conversation replay ===\n");
    for (const row of outputs) {
      console.log(`USER: ${row.msg}`);
      console.log(`BOT [${row.layer}]: ${row.text}\n`);
    }

    // Message 1 — pricing handoff, course tone
    assert(outputs[0].layer === "pricing-handoff", `msg1 layer: ${outputs[0].layer}`);
    assert(/học|khóa|lộ trình|tư vấn/i.test(outputs[0].text), `msg1 course tone: ${outputs[0].text}`);
    assert(!/\d+\s*tr\b/i.test(outputs[0].text), "msg1 must not invent VND");

    // Message 2 — churn close
    assert(isChurnIntent("tôi không làm nữa"), "churn intent detect");
    assert(outputs[1].layer === "churn-close", `msg2 layer: ${outputs[1].layer}`);
    assert(!NO_PIVOT.test(outputs[1].text), `msg2 must not pivot: ${outputs[1].text}`);
    assert(!NO_FALSE_SDT.test(outputs[1].text), `msg2 must not claim SĐT: ${outputs[1].text}`);
    assert(!NO_SME_SCOPE.test(outputs[1].text), `msg2 must not SME scope: ${outputs[1].text}`);

    // Message 3 — phone recall
    assert(asksForOwnPhone("bạn có số dt của tôi chưa?"), "phone recall detect");
    assert(outputs[2].layer === "phone-recall", `msg3 layer: ${outputs[2].layer}`);
    assert(/chưa lưu|chưa có/i.test(outputs[2].text), `msg3 must say not stored: ${outputs[2].text}`);
    assert(!NO_FALSE_SDT.test(outputs[2].text), `msg3 must not claim SĐT: ${outputs[2].text}`);

    // Message 4 — page correction
    assert(isPageCorrectionIntent("nhưng mà page của bạn là về khóa học AI mà"), "page correction detect");
    assert(outputs[3].layer === "page-correction", `msg4 layer: ${outputs[3].layer}`);
    assert(/khóa học|học ai|chatgpt|lộ trình/i.test(outputs[3].text), `msg4 course focus: ${outputs[3].text}`);
    assert(!NO_SME_SCOPE.test(outputs[3].text), `msg4 must not SME scope: ${outputs[3].text}`);
  } finally {
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
    if (savedHermes) process.env.HERMES_REPLY_ENABLED = savedHermes;
  }

  console.log("All AI Newbie conversation tests passed.\n");
  return outputs;
}

runConversation().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
