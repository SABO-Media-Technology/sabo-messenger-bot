/**
 * Local multi-turn CEO conversation replay (SABO Media 332950393234346).
 * Thin-bot: discovery/scope/preference via LLM+prompt, not sales-* handler layers.
 * Usage: node --use-system-ca scripts/test-conversation-local.cjs
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
require("dotenv").config();
process.env.LEAD_QUEUE_DRY_RUN = "1";
process.env.HERMES_ENABLED = "false";

const { bootstrapEnv } = require("../src/config/env-bootstrap");
const { loadPageRegistry, getPage } = require("../src/pages");
const {
  clearThread,
  setLeadProfile,
  setSessionMeta,
  getLeadProfile,
  emptySessionMeta,
} = require("../src/session/store");
const { emptyProfile } = require("../src/leads/flow");

const llmPath = require.resolve("../src/ai/llm");
const routerPath = require.resolve("../src/ai/router");

function loadRouterWithLlmStub(stubFn) {
  const llm = require(llmPath);
  llm.isLlmConfigured = () => true;
  llm.chatCompletion = stubFn;
  delete require.cache[routerPath];
  return require(routerPath);
}

const PAGE_ID = "332950393234346";
const SENDER_ID = "local_conv_332950393234346_ceo";

const TURNS = [
  "có dịch vụ công nghệ nào thú vị không",
  "ưu tiên web thu lead",
  "số điện thoại của tôi là gì ?",
  "tao đã gửi số dt cho mày đâu mà mày kêu có sdt rồi ?",
  "ok, gợi scope đi",
  "m có trả lời được gì đâu mà hỏi",
];

const FALSE_SDT = /đã có\s*sđt|đã có\s*sdt|team\s*sabo\s*đã có|team đã có sđt/i;
const SCOPE_KW = /trang|landing|form|zalo|tuần|scope|hosting|ssl/i;
const ASK_PHONE = /chưa lưu|chưa có|xin.*sđt|xin.*zalo|chua luu|chua co/i;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function stubLlmForCeoConversation() {
  return loadRouterWithLlmStub(async (systemPrompt, messages) => {
    const user = messages[messages.length - 1]?.content || "";
    assert(/discovery|dịch vụ thú vị|SABO/i.test(systemPrompt), "prompt must include discovery guidance");

    if (/thú vị/i.test(user)) {
      return "Dạ anh/chị! SABO hay làm website thu lead, SABOHUB quản lý doanh nghiệp và bot Messenger tự động. Anh/chị ưu tiên web, app hay automation trước ạ?";
    }
    if (/ưu tiên web/i.test(user)) {
      return "Dạ em gợi scope web thu lead: landing 1 trang, form liên hệ, nút Zalo, hosting + SSL — thường ~1–2 tuần. Anh/chị có brand/logo sẵn chưa ạ?";
    }
    if (/gợi scope/i.test(user)) {
      return "Dạ scope gồm: trang landing, form thu lead, tích hợp Zalo, hosting + SSL. Anh/chị muốn thêm blog hay chỉ 1 trang thu lead ạ?";
    }
    if (/trả lời được gì/i.test(user)) {
      return "Dạ em xin lỗi ạ — em có thể gợi scope web, quy trình làm việc, hoặc xin SĐT/Zalo để team báo giá. Anh/chị muốn em giúp phần nào ạ?";
    }
    if (/đã gửi số/i.test(user)) {
      return "Dạ em xin lỗi ạ — em chưa lưu SĐT của anh/chị. Anh/chị cho em xin lại SĐT hoặc Zalo nhé?";
    }
    return "Dạ em nghe ạ.";
  });
}

async function main() {
  await bootstrapEnv();
  loadPageRegistry();
  const page = getPage(PAGE_ID);
  assert(page, "Page not found: " + PAGE_ID);

  clearThread(page.id, SENDER_ID);
  setLeadProfile(page.id, SENDER_ID, emptyProfile(), page.projectSlug);
  setSessionMeta(
    page.id,
    SENDER_ID,
    { ...emptySessionMeta(), fbProfileFetched: true, honorific: "anh/chị" },
    page.projectSlug,
  );

  const savedGroq = process.env.GROQ_API_KEY;
  const savedOpenai = process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const { generateReply } = stubLlmForCeoConversation();
  const results = [];

  try {
    for (let i = 0; i < TURNS.length; i++) {
      const userMsg = TURNS[i];
      const { text, layer } = await generateReply(page, SENDER_ID, userMsg);
      const profile = getLeadProfile(page.id, SENDER_ID);
      results.push({ turn: i + 1, userMsg, layer, reply: text, phone: profile.phone });

      console.log("");
      console.log("--- Luot " + (i + 1) + " ---");
      console.log("Khach: " + userMsg);
      console.log("Layer: " + layer);
      console.log("Bot: " + text);
      if (profile.phone) console.log("(profile.phone sau luot: " + profile.phone + ")");

      if (i === 0) {
        assert(/^llm/.test(layer), "Luot 1: discovery via LLM+prompt, got " + layer);
        assert(/website|lead|sabohub|bot/i.test(text), "Luot 1: phai goi dich vu cu the");
      }
      if (i === 1) {
        assert(/^llm/.test(layer), "Luot 2: preference via LLM+prompt, got " + layer);
        assert(SCOPE_KW.test(text), "Luot 2: phai goi scope web cu the");
        assert(layer !== "sales-preference" && layer !== "sales-scope", "no sales-* handler layers");
      }
      if (i >= 1) {
        assert(!FALSE_SDT.test(text), "Luot " + (i + 1) + ": khong duoc noi da co SDT khi chua co phone");
      }
      if (i === 2) {
        assert(layer === "phone-recall", "Luot 3: phone-recall layer");
        assert(ASK_PHONE.test(text), "Luot 3: phai hoi SDT hoac noi chua luu");
        assert(!FALSE_SDT.test(text), "Luot 3: khong duoc claim da co SDT");
      }
      if (i === 4) {
        assert(/^llm/.test(layer), "Luot 5: scope via LLM+prompt");
        assert(SCOPE_KW.test(text), "Luot 5: phai goi scope web cu the");
      }
    }
  } finally {
    delete require.cache[routerPath];
    if (savedGroq) process.env.GROQ_API_KEY = savedGroq;
    else delete process.env.GROQ_API_KEY;
    if (savedOpenai) process.env.OPENAI_API_KEY = savedOpenai;
    else delete process.env.OPENAI_API_KEY;
  }

  console.log("");
  console.log("=== BANG HOI THOAI (CEO) ===");
  console.log("");
  for (const r of results) {
    console.log("L" + r.turn + " | Khach: " + r.userMsg);
    console.log("    | Layer: " + r.layer);
    console.log("    | Bot: " + r.reply);
    console.log("");
  }

  console.log("Tat ca assert OK.");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
