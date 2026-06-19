/**
 * AI Newbie VN — thin-bot regression (pricing + phone-recall deterministic; churn/page via LLM prompt).
 * Usage: node scripts/test-ai-newbie-conversation.cjs
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
process.env.LEAD_QUEUE_DRY_RUN = "1";

const { loadPageRegistry, getPage } = require("../src/pages");
const { emptyProfile } = require("../src/leads/flow");
const { clearThread, setLeadProfile, setSessionMeta } = require("../src/session/store");
const { getVerticalId } = require("../src/strategies/page-contracts");
const { asksForOwnPhone } = require("../src/leads/extract");
const { buildSystemPrompt, THIN_BEHAVIOR_RULES } = require("../src/ai/prompt-builder");

const llmPath = require.resolve("../src/ai/llm");
const routerPath = require.resolve("../src/ai/router");

function loadRouterWithLlmStub(stubFn) {
  const llm = require(llmPath);
  llm.isLlmConfigured = () => true;
  llm.chatCompletion = stubFn;
  delete require.cache[routerPath];
  return require(routerPath);
}

const AI_NEWBIE_PAGE_ID = "569671719553461";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const NO_PIVOT = /đổi sang/i;
const NO_FALSE_SDT = /sđt đã lưu|đã có sđt|team sẽ gọi|team sabo đã có/i;
const NO_SME_SCOPE = /scope web|quy mô sme|landing thu lead/i;

function stubLlmForAiNewbie() {
  return loadRouterWithLlmStub(async (systemPrompt, messages) => {
    const user = messages[messages.length - 1]?.content || "";
    assert(/ai-education|khóa học|AI Newbie/i.test(systemPrompt), "prompt must be AI education vertical");
    assert(/không làm|tôn trọng|KHÔNG pivot/i.test(THIN_BEHAVIOR_RULES), "thin behavior rules present");
    if (/không làm nữa/i.test(user)) {
      return "Dạ em hiểu ạ — cảm ơn anh/chị đã quan tâm khóa học AI. Sau này cần lộ trình học hay ChatGPT cứ nhắn em nhé!";
    }
    if (/khóa học AI mà/i.test(user)) {
      return "Dạ đúng ạ — AI Newbie VN tập trung khóa học và lộ trình học AI từ cơ bản. Anh/chị muốn em gợi lộ trình ChatGPT hay học tạo ảnh AI ạ?";
    }
    return "Dạ em nghe ạ.";
  });
}

async function runConversation() {
  loadPageRegistry();
  const page = getPage(AI_NEWBIE_PAGE_ID);
  assert(page, "AI Newbie page must exist in registry");
  assert(page.projectSlug === "ainewbie", `projectSlug must be ainewbie, got ${page.projectSlug}`);
  assert(page.replyStrategy === "rag-mini", `replyStrategy must be rag-mini, got ${page.replyStrategy}`);

  const verticalId = getVerticalId(page);
  assert(verticalId === "ai-education", `vertical must be ai-education, got ${verticalId}`);

  const meta = { honorific: "anh/chị", fbProfileFetched: true };
  const prompt = buildSystemPrompt({ page, sessionMeta: meta, leadProfile: emptyProfile() });
  assert(/không làm|tôn trọng/i.test(prompt), "system prompt must include churn guidance");
  assert(/khóa học AI|AI Newbie/i.test(prompt), "system prompt must stay AI education");

  const senderId = "ceo_ai_newbie_regression";
  clearThread(page.id, senderId);
  setLeadProfile(page.id, senderId, { ...emptyProfile() }, page.projectSlug);
  setSessionMeta(page.id, senderId, meta, page.projectSlug);

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  const savedHermes = process.env.HERMES_REPLY_ENABLED;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.HERMES_REPLY_ENABLED;

  const { generateReply } = stubLlmForAiNewbie();

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

    assert(outputs[0].layer === "pricing-handoff", `msg1 layer: ${outputs[0].layer}`);
    assert(/học|khóa|lộ trình|tư vấn/i.test(outputs[0].text), `msg1 course tone: ${outputs[0].text}`);
    assert(!/\d+\s*tr\b/i.test(outputs[0].text), "msg1 must not invent VND");

    assert(/:llm$|^llm/i.test(outputs[1].layer), `msg2 must use LLM not churn-close handler: ${outputs[1].layer}`);
    assert(!NO_PIVOT.test(outputs[1].text), `msg2 must not pivot: ${outputs[1].text}`);
    assert(!NO_FALSE_SDT.test(outputs[1].text), `msg2 must not claim SĐT: ${outputs[1].text}`);
    assert(!NO_SME_SCOPE.test(outputs[1].text), `msg2 must not SME scope: ${outputs[1].text}`);

    assert(asksForOwnPhone("bạn có số dt của tôi chưa?"), "phone recall detect");
    assert(outputs[2].layer === "phone-recall", `msg3 layer: ${outputs[2].layer}`);
    assert(/chưa lưu|chưa có/i.test(outputs[2].text), `msg3 must say not stored: ${outputs[2].text}`);
    assert(!NO_FALSE_SDT.test(outputs[2].text), `msg3 must not claim SĐT: ${outputs[2].text}`);

    assert(/:llm$|^llm/i.test(outputs[3].layer), `msg4 must use LLM: ${outputs[3].layer}`);
    assert(/khóa học|học ai|chatgpt|lộ trình/i.test(outputs[3].text), `msg4 course focus: ${outputs[3].text}`);
    assert(!NO_SME_SCOPE.test(outputs[3].text), `msg4 must not SME scope: ${outputs[3].text}`);
  } finally {
    delete require.cache[routerPath];
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    else delete process.env.GROQ_API_KEY;
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
