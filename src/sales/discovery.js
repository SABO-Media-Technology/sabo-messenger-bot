/**
 * Sales discovery layer — intent detection + inspiring service replies (Uyển Nhi voice).
 */
const { buildHonorificAddress } = require("../facebook/profile");
const { getVerticalId } = require("../strategies/page-contracts");
const { pickOffers } = require("./sabo-mt-catalog");
const { hashSeed, pickOpener } = require("../responses/variation");

const PRICING_RE = /giá|bao nhiêu|price|cost|báo giá|quote|ngân sách|budget|\d+\s*tr\b/i;

function isPricingQuestion(text) {
  return PRICING_RE.test(text || "");
}

const DISCOVERY_PATTERNS = [
  /dịch vụ.*(thú vị|hay|gì|nào)/i,
  /công nghệ.*(thú vị|hay|gì|nào)/i,
  /(thú vị|hay ho).*(dịch vụ|công nghệ|làm)/i,
  /bên (em|sabo|anh|chị).*(làm gì|dịch vụ gì|offer|tư vấn gì)/i,
  /(có|làm) (gì|được gì|dịch vụ gì)/i,
  /tư vấn (gì|những gì|dịch vụ)/i,
  /(giới thiệu|kể).*(dịch vụ|sabo|bên em)/i,
  /muốn (tìm hiểu|biết).*(dịch vụ|sabo|làm gì)/i,
  /bán (gì|dịch vụ gì)/i,
  /sabo (làm|có) (gì|dịch vụ)/i,
];

const SCOPE_PATTERNS = [
  /scope|phạm vi|bao gồm|gồm những gì|quy trình|timeline|bao lâu|mất bao lâu/i,
  /gợi\s*scope|cho\s*scope|scope\s*(đi|web|luôn|nhé)|đề\s*xuất\s*scope/i,
];

const OBJECTION_PATTERNS = [
  /(đắt|mắc|tốn|không tin|scam|lừa|uy tín|review|đánh giá)/i,
  /(nghĩ lại|chưa chắc| không cần| thôi| bỏ)/i,
];

const GREETING_ONLY =
  /^(xin chào|chào|hello|hi|hey|alo|dạ|shop ơi)\b/i;

/**
 * @returns {'discovery'|'pricing'|'scope'|'greeting'|'objection'|null}
 */
function detectSalesIntent(text) {
  const t = (text || "").trim();
  if (!t) return null;
  if (GREETING_ONLY.test(t) && t.length < 20) return "greeting";
  if (isPricingQuestion(t)) return "pricing";
  if (OBJECTION_PATTERNS.some((re) => re.test(t))) return "objection";
  if (SCOPE_PATTERNS.some((re) => re.test(t))) return "scope";
  if (DISCOVERY_PATTERNS.some((re) => re.test(t))) return "discovery";
  return null;
}

function isDiscoveryQuestion(text) {
  return detectSalesIntent(text) === "discovery";
}

function formatOfferLine(offer, idx) {
  const price = offer.priceHint ? ` (${offer.priceHint})` : "";
  return `${offer.name}${price} — ${offer.outcome}`;
}

const QUALIFY_QUESTIONS = [
  "Anh/chị đang kinh doanh ngành gì để em gợi hướng sát nhất ạ?",
  "Anh/chị muốn tăng lead hay gom vận hành trước — em chỉ đúng gói nhé?",
  "Doanh nghiệp anh/chị đang bí chỗ nào nhất — thu khách hay quản nội bộ ạ?",
  "Anh/chị ưu tiên web thu lead, app quản lý hay bot trả lời inbox trước ạ?",
];

function buildDiscoveryReply(page, sessionMeta, userText = "") {
  const address = buildHonorificAddress(sessionMeta);
  const seed = hashSeed(`${sessionMeta?.profileName || ""}:${userText}`);
  const opener = pickOpener(address, seed);
  const offers = pickOffers(page, 3, seed);
  const verticalId = getVerticalId(page);

  const offerLines = offers.slice(0, 2).map((o) => formatOfferLine(o, 0));
  const qualifyQ = QUALIFY_QUESTIONS[seed % QUALIFY_QUESTIONS.length];

  if (verticalId === "billiards-ops") {
    const lines = [
      `${opener} Bên em có app quản lý giải billiards (bracket, điểm, thông báo) và hỗ trợ đăng ký giải Sabo Arena — quán đỡ tổ thủ công. Anh/chị muốn đặt bàn hay tìm hiểu app giải trước ạ?`,
      `${opener} Em hay gợi quán: (1) đăng ký giải online thay Excel, (2) cộng đồng billiards kéo khách quay lại. Anh/chị quan tâm phần nào ạ?`,
    ];
    return lines[seed % lines.length];
  }

  if (verticalId === "real-estate") {
    return `${opener} Em hay gợi BĐS Vũng Tàu: web listing + form liên hệ để môi giới gọi nhanh, hoặc landing theo dự án cụ thể. Anh/chị đang tìm mua, thuê hay muốn làm kênh online cho môi giới ạ?`;
  }

  if (verticalId === "ai-education") {
    return `${opener} Bên em có lộ trình học AI cơ bản (ChatGPT, ảnh AI) và triển khai bot/automation cho doanh nghiệp khi team sẵn sàng. Anh/chị muốn học cho bản thân hay build cho công ty trước ạ?`;
  }

  const hook =
    seed % 2 === 0
      ? "Nhiều SME inbox nhiều mà chưa giữ được lead, hoặc vận hành rời vài app — em hay gợi:"
      : "Tuỳ pain anh/chị, em hay gợi vài hướng cụ thể:";

  const body = offerLines.join("; ");
  const lines = [
    `${opener} ${hook} ${body}. ${qualifyQ}`,
    `${opener} SABO M&T hay làm ${offers[0].name.toLowerCase()} và ${offers[1].name.toLowerCase()} — ${offers[0].outcome.split("—")[0].trim()}, còn ${offers[1].outcome.split("—")[0].trim()}. ${qualifyQ}`,
  ];
  return lines[seed % lines.length];
}

/** Concrete scope deliverables — web-lead default for SABO M&T */
function buildScopeReply(page, sessionMeta, userText = "", scopeType = "web-lead") {
  const address = buildHonorificAddress(sessionMeta);
  const seed = hashSeed(`${sessionMeta?.profileName || ""}:${userText}:scope`);
  const opener = pickOpener(address, seed);
  const verticalId = getVerticalId(page);

  if (scopeType === "web-lead" || verticalId === "sabo-mt-services") {
    const lines = [
      `${opener} Scope web thu lead thường gồm: trang chủ + giới thiệu dịch vụ, 1 landing thu form, nút Zalo/Messenger, SEO cơ bản. Timeline ballpark 3–6 tuần tùy số trang và tích hợp thanh toán. Anh/chị muốn bắt đầu landing thu lead hay full web bán hàng ạ?`,
      `${opener} Em gợi scope web SME: 3–5 trang (home, dịch vụ, liên hệ), form thu SĐT, kết nối Zalo, hosting + SSL. Làm nhanh ~3–4 tuần, full giỏ hàng ~6–8 tuần. Anh/chị ưu tiên thu lead hay bán online trước ạ?`,
    ];
    return lines[seed % lines.length];
  }

  if (verticalId === "billiards-ops") {
    return `${opener} Scope app giải billiards: đăng ký giải online, bracket tự động, thông báo kết quả — pilot ~4–6 tuần. Anh/chị muốn đặt bàn hay triển khai app giải trước ạ?`;
  }

  return buildDiscoveryReply(page, sessionMeta, userText);
}

/** Prompt block injected into system/Hermes prompts */
function buildSalesDiscoveryPromptBlock() {
  return `
SALES DISCOVERY (câu hỏi mở — "dịch vụ gì", "làm gì được", "có gì thú vị"):
- KHÔNG nhảy vào MVP/process/app trừ khi khách NÓI RÕ muốn app.
- Gợi 2–3 ý tưởng CỤ THỂ theo ngành/pain: web thu lead, SABOHUB vertical, bot/automation inbox, thiết kế/content.
- Mỗi gợi ý = outcome kinh doanh (thu lead, gom vận hành, trả lời nhanh) — KHÔNG essay kỹ thuật.
- Kết bằng MỘT câu hỏi qualify hấp dẫn (ngành, pain, ưu tiên) — KHÔNG "cần em làm rõ phần nào".
- 60–100 từ, giọng sales VN tự nhiên, em/anh/chị.`.trim();
}

module.exports = {
  detectSalesIntent,
  isDiscoveryQuestion,
  buildDiscoveryReply,
  buildScopeReply,
  buildSalesDiscoveryPromptBlock,
  DISCOVERY_PATTERNS,
  SCOPE_PATTERNS,
};
