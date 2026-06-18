/**
 * Post-qualify consultation helpers — contextual fallback when LLM unavailable.
 * Fallback only; primary path is Groq/OpenAI via router.
 */

const { buildHonorificAddress } = require("../facebook/profile");
const {
  looksLikeConsultationQuestion,
  extractNeedUpdate,
  isNeedPivot,
} = require("./extract");

const PRICING_RE = /giá|bao nhiêu|price|cost|báo giá|quote|ngân sách|budget|\d+\s*tr\b/i;

function isPricingQuestion(text) {
  return PRICING_RE.test(text || "");
}

function pricingBallpark(need) {
  const n = (need || "").toLowerCase();
  if (/app|mobile|ứng dụng/i.test(n)) {
    return "app SME thường từ ~150tr (standalone) hoặc gói vertical 10–30tr setup + 3–10tr/tháng tùy module";
  }
  if (/website|web|trang|landing|bán hàng/i.test(n)) {
    return "website/landing thường 15–50tr tùy số trang, giỏ hàng, tích hợp thanh toán";
  }
  if (/automation|tự động|ai/i.test(n)) {
    return "automation/AI workflow báo theo số quy trình và tích hợp — thường từ vài chục triệu";
  }
  return "dự án chuyển đổi số SME thường 50–150tr (build) hoặc subscription vertical 10–30tr setup";
}

function consultSnippet(need) {
  const n = (need || "").toLowerCase();
  if (/app|mobile|ứng dụng/i.test(n)) {
    return "Với app SME, em gợi ý: (1) xác định 3–5 tính năng lõi, (2) chọn Flutter/React Native + backend Supabase, (3) pilot 4–8 tuần rồi mở rộng module.";
  }
  if (/website|web|trang|landing|bán hàng/i.test(n)) {
    return "Với web bán hàng, em gợi ý: landing giới thiệu + form/Zalo, hoặc web có giỏ hàng + thanh toán — tùy mục tiêu doanh thu vs lead gen.";
  }
  return "Em có thể gợi ý scope và lộ trình triển khai phù hợp quy mô SME — ưu tiên MVP chạy nhanh rồi iterate.";
}

/**
 * Contextual post-qualify fallback — varies by user message intent.
 */
function buildPostQualifyFallback(page, profile, sessionMeta, userText) {
  const address = buildHonorificAddress(sessionMeta);
  const need = (profile.need || "dự án").slice(0, 120);
  const text = (userText || "").trim();

  if (isPricingQuestion(text)) {
    const ballpark = pricingBallpark(need);
    return `Dạ ${address}! Giá ${need} phụ thuộc scope cụ thể — ${ballpark}. Team đã có SĐT của anh/chị, sẽ gọi báo sát sau khi chốt vài câu hỏi (số trang/tính năng, tích hợp). Anh/chị muốn em note thêm điểm nào không ạ?`;
  }

  if (looksLikeConsultationQuestion(text) || /tư vấn|giải thích|như thế nào|là gì/i.test(text)) {
    const tip = consultSnippet(need);
    return `Dạ ${address}! ${tip} Với nhu cầu "${need.slice(0, 60)}", team SABO sẽ liên hệ chi tiết hơn qua SĐT đã lưu — anh/chị cứ hỏi thêm em trả lời tiếp nhé!`;
  }

  if (isNeedPivot(text)) {
    const updated = extractNeedUpdate(text, need) || text.slice(0, 80);
    const tip = /app|mobile/i.test(updated) ? consultSnippet(updated) : consultSnippet(need);
    return `Dạ ${address}, em ghi nhận anh/chị muốn đổi hướng sang: ${updated.slice(0, 80)}. ${tip} Team sẽ cập nhật hồ sơ và liên hệ báo giá phù hợp qua SĐT đã lưu ạ!`;
  }

  const tip = consultSnippet(need);
  return `Dạ ${address}! Về "${need.slice(0, 60)}": ${tip} Anh/chị cần em làm rõ phần nào thêm (giá, timeline, tính năng) ạ?`;
}

function buildPostQualifyPricingHint() {
  return `
BÁO GIÁ SAU QUALIFY (khi khách hỏi giá):
- Đưa ballpark + yếu tố ảnh hưởng giá — KHÔNG chỉ nói "team sẽ gọi".
- Website/landing: ~15–50tr tùy trang, giỏ hàng, thanh toán.
- App SME standalone: ~150tr+; vertical subscription: setup 10–30tr + 3–10tr/tháng.
- Build pioneer dự án: ~50–150tr tùy scope.
- Kết: team đã có SĐT → báo sát sau call ngắn, nhưng vẫn cho khách cảm giác được tư vấn ngay.`.trim();
}

module.exports = {
  isPricingQuestion,
  buildPostQualifyFallback,
  buildPostQualifyPricingHint,
  pricingBallpark,
  consultSnippet,
};
