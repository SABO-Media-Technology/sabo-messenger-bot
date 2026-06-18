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

const TEST_CASES = [
  { label: "greeting", text: "Xin chào shop ơi" },
  { label: "pricing", text: "Làm website giá bao nhiêu vậy?" },
  { label: "lead-intent", text: "Tôi muốn tư vấn gấp, gọi cho tôi nhé 0912345678" },
  { label: "product-inquiry", text: "ngoài học ra thì còn sản phẩm gì nữa không?" },
];

function scoreReply(reply, page, testCase) {
  const issues = [];
  const text = reply.text || "";
  const lower = text.toLowerCase();

  if (text.length < 20) issues.push("quá ngắn");
  if (text.length > 600) issues.push("quá dài (>600)");
  if (text.includes("##") || text.includes("###")) issues.push("có markdown heading");
  if (/tôi là (một )?ai|chatbot/i.test(text)) issues.push("tự nhận AI");

  if (testCase.label === "pricing" && page.tier !== "t2") {
    if (/0798893333|hotline.*gọi|gọi.*0798/i.test(text)) {
      issues.push("không được đẩy hotline khi hỏi giá");
    }
    if (!/sđt|email|liên hệ|cho em|xin/i.test(text)) {
      issues.push("thiếu hỏi contact khi hỏi giá");
    }
  }

  if (page.projectSlug === "sabo-mt" && testCase.label === "lead-intent") {
    if (!/tư vấn|liên hệ|hotline|sabo/i.test(lower)) issues.push("lead intent yếu");
  }

  if (page.projectSlug === "vungtau" && testCase.label === "pricing") {
    if (!/bất động|vũng tàu|vungtau/i.test(lower)) issues.push("thiếu ngữ cảnh BĐS");
  }

  if (testCase.label === "product-inquiry" && page.projectSlug === "ainewbie") {
    if (/0798893333|gọi.*hotline|liên hệ qua sđt/i.test(lower)) {
      issues.push("đẩy hotline thay vì thu lead");
    }
    if (!/sđt|email|liên hệ|cho em|xin/i.test(lower)) {
      issues.push("thiếu hỏi contact khi hỏi sản phẩm");
    }
    if (!/sabo|website|app|automation|doanh nghiệp/i.test(lower)) {
      issues.push("thiếu giới thiệu sản phẩm SABO");
    }
  }

  return { ok: issues.length === 0, issues };
}

async function main() {
  await bootstrapEnv();
  loadPageRegistry();

  const llm = getLlmConfig();
  console.log("\n=== Messenger Bot Reply Quality Test ===\n");
  console.log(`LLM: ${llm ? `${llm.provider}/${llm.model}` : "NONE — sẽ fallback"}`);
  console.log(`Lead queue: ${isLeadQueueConfigured() ? "yes" : "no"}`);
  console.log(`Pages: ${getAllPages().length}\n`);

  const pages = getAllPages();
  const summary = { pass: 0, warn: 0, fail: 0, noToken: 0 };

  for (const page of pages) {
    console.log(`--- ${page.name} (${page.projectSlug} / ${page.replyStrategy}) ---`);
    if (!page.accessToken) {
      console.log("  ⚠ SKIP send API — chưa có page token");
      summary.noToken++;
    }

    for (const tc of TEST_CASES) {
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
