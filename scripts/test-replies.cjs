/**

 * Quality test — 11 pages × sample messages. Không gọi Travis, không gửi FB thật.

 * Usage: npm run test:replies

 */

const path = require("path");



process.chdir(path.join(__dirname, ".."));



require("dotenv").config();

process.env.LEAD_QUEUE_DRY_RUN = "1";



const { bootstrapEnv } = require("../src/config/env-bootstrap");

const { loadPageRegistry, getAllPages } = require("../src/pages");

const { generateReply } = require("../src/ai/router");

const { getLlmConfig } = require("../src/ai/llm");

const { isLeadQueueConfigured } = require("../src/leads/queue");

const { getVerticalId } = require("../src/strategies/page-contracts");

const { matchTemplate } = require("../src/ai/templates");



const TEST_CASES = [

  { label: "greeting", text: "Xin chào shop ơi" },

  { label: "pricing", text: "Làm website giá bao nhiêu vậy?" },

  { label: "lead-intent", text: "Tôi muốn tư vấn gấp, gọi cho tôi nhé 0912345678" },

];



const VERTICAL_CASES = {

  "billiards-ops": { label: "book-table", text: "Cho em đặt bàn tối nay được không?" },

  "sabo-mt-services": { label: "services", text: "Bên em có làm app quản lý không?" },

  "ai-education": { label: "learn-ai", text: "Em mới học ChatGPT, bắt đầu từ đâu?" },

  "real-estate": { label: "property", text: "Có căn nào gần biển Vũng Tàu không?" },

  platform: { label: "demo", text: "SABOHUB dùng thử được không?" },

};



function scoreReply(reply, page, testCase) {

  const issues = [];

  const text = reply.text || "";

  const lower = text.toLowerCase();

  const vertical = getVerticalId(page);



  if (text.length < 20) issues.push("quá ngắn");

  if (text.length > 600) issues.push("quá dài (>600)");

  if (text.includes("##") || text.includes("###")) issues.push("có markdown heading");

  if (/tôi là (một )?ai|chatbot/i.test(text)) issues.push("tự nhận AI");

  if (/xin tên|cho em.*tên|không thể thấy tên/i.test(lower) && !/xin tên.*facebook/i.test(lower)) {
    issues.push("hỏi tên robotically");
  }



  // No unsolicited hotline dump (except explicit hotline template)

  if (

    reply.layer !== "template" &&

    /0798893333|0961\s?167\s?717/.test(text) &&

    !/hotline|số hotline/i.test(testCase.text || "")

  ) {

    issues.push("dump hotline không được hỏi");

  }



  if (testCase.label === "pricing" || testCase.label === "services" || testCase.label === "demo") {
    if (!/sđt|email|zalo|liên hệ|xin|cho em|dịch vụ nào|loại|quan tâm/i.test(lower)) {
      issues.push("thiếu qualify hoặc CTA contact");
    }
  }



  if (vertical === "billiards-ops" && testCase.label === "book-table") {

    if (!/đặt bàn|giải|sđt|tên/i.test(lower)) issues.push("thiếu ngữ cảnh bida/lead");

  }



  if (vertical === "real-estate" && testCase.label === "property") {

    if (!/bất động|vũng tàu|nhà|đất|khu/i.test(lower)) issues.push("thiếu ngữ cảnh BĐS");

  }



  if (vertical === "ai-education" && testCase.label === "learn-ai") {

    if (!/học|chatgpt|ai/i.test(lower)) issues.push("thiếu ngữ cảnh học AI");

  }



  return { ok: issues.length === 0, issues };

}



function testVerticalTemplates() {

  const samples = [

    { page: { projectSlug: "sabo-billiards" }, text: "Đặt bàn tối nay", expect: /đặt bàn|sđt/i },

    { page: { projectSlug: "sabo-mt" }, text: "Giá làm web", expect: /dịch vụ|website|scope|giá/i },

    { page: { projectSlug: "ainewbie" }, text: "Bán dịch vụ gì", expect: /sabo|sđt|zalo|email/i },

    { page: { projectSlug: "ainewbie" }, text: "ngoài học ra thì còn sản phẩm gì nữa không", expect: /sabo|sđt|zalo|email/i },

    { page: { projectSlug: "vungtau" }, text: "Giá nhà Vũng Tàu", expect: /khu|sđt/i },

    { page: { projectSlug: "sabohub" }, text: "Demo SABOHUB", expect: /demo|sđt/i },

  ];

  for (const s of samples) {

    const hit = matchTemplate(s.text, s.page);

    if (!hit || !s.expect.test(hit)) {

      throw new Error(`vertical template miss: ${s.page.projectSlug} / ${s.text}`);

    }

  }

  console.log("  vertical templates (5 verticals): OK");

}



async function main() {

  await bootstrapEnv();

  loadPageRegistry();



  const llm = getLlmConfig();

  console.log("\n=== Messenger Bot Reply Quality Test ===\n");

  console.log(`LLM: ${llm ? `${llm.provider}/${llm.model}` : "NONE — sẽ fallback"}`);

  console.log(`Lead queue: ${isLeadQueueConfigured() ? "yes" : "no"}`);

  console.log(`Pages: ${getAllPages().length}\n`);



  testVerticalTemplates();



  const pages = getAllPages();

  const summary = { pass: 0, warn: 0, fail: 0, noToken: 0 };

  const seenVerticals = new Set();



  for (const page of pages) {

    const vertical = getVerticalId(page);

    console.log(`--- ${page.name} (${page.projectSlug} / ${vertical}) ---`);

    if (!page.accessToken) {

      console.log("  ⚠ SKIP send API — chưa có page token");

      summary.noToken++;

    }



    const cases = [...TEST_CASES];

    const vCase = VERTICAL_CASES[vertical];

    if (vCase && !seenVerticals.has(vertical)) {

      cases.push(vCase);

      seenVerticals.add(vertical);

    }



    for (const tc of cases) {

      const senderId = `test_${page.slug}_${tc.label}`;

      try {

        const reply = await generateReply(page, senderId, tc.text);

        const scored = scoreReply(reply, page, tc);

        const icon = scored.ok ? "OK" : "WARN";

        if (scored.ok) summary.pass++;

        else summary.warn++;



        console.log(`  [${icon}] [${tc.label}] layer=${reply.layer}`);

        console.log(`     Q: ${tc.text}`);

        console.log(`     A: ${reply.text.slice(0, 220)}${reply.text.length > 220 ? "..." : ""}`);

        if (!scored.ok) console.log(`     Issues: ${scored.issues.join(", ")}`);

      } catch (err) {

        summary.fail++;

        console.log(`  [FAIL] [${tc.label}] ERROR: ${err.message}`);

      }

    }

    console.log("");

  }



  console.log("=== Summary ===");

  console.log(`Pass: ${summary.pass} | Warn: ${summary.warn} | Fail: ${summary.fail} | No token: ${summary.noToken}`);

  process.exit(summary.fail > 0 ? 1 : 0);

}



main().catch((err) => {

  console.error(err);

  process.exit(1);

});


