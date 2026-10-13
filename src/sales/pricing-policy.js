/**
 * CEO pricing policy — never invent VND amounts in Messenger chat.
 * Hand off to SABO team via Zalo/SĐT for official quotes.
 */
const { buildHonorificAddress } = require("../facebook/profile");
const { hasVerifiedPhone, extractPhone, extractZalo } = require("../leads/extract");
const { getPageContract } = require("../strategies/page-contracts");
const { pickOpener, hashSeed } = require("../responses/variation");

const PRICING_RE =
  /giá|giá cả|bảng giá|bao nhiêu|price|cost|báo giá|quote|ngân sách|budget|chi phí|mức giá|tốn bao nhiêu|đắt không|mắc không/i;

/** Output guard — block customer replies that leak VND/package pricing */
const VND_PRICE_OUTPUT_PATTERNS = [
  /\d[\d.,]*\s*(?:đ|đồng|triệu|tr\/|k\/)/i,
  /\d[\d.,]*\s*tr\b/i,
  /\d[\d.,]*\s*k\b/i,
  /Gói\s+(?:Basic|Advanced|Pro|Premium|Starter|Enterprise|Standard)/i,
  /(?:setup|gói|package)\s+\d[\d.,]*/i,
  /~\s*\d+[\d.,–-]*\s*tr/i,
  /15[–-]50\s*tr/i,
  /500\.?\d{3}/i,
  /đồng\s*\/\s*hình/i,
];

function isPricingQuestion(text) {
  return PRICING_RE.test(text || "");
}

function containsVndPricePattern(text) {
  return Boolean(findPatternHit(text, VND_PRICE_OUTPUT_PATTERNS));
}

function findPatternHit(text, patterns) {
  const body = String(text || "");
  for (const re of patterns) {
    if (re.test(body)) return re.source;
  }
  return null;
}

/**
 * Skip pricing handoff when user is submitting contact info (not asking price).
 */
function isInPhoneCollectionFlow(userText, profile, page, sessionMeta) {
  const text = (userText || "").trim();
  if (!text) return false;
  if (isPricingQuestion(text)) return false;

  const phone = extractPhone(text);
  const zalo = extractZalo(text);
  if (phone || zalo) return true;

  if (/^(zalo|sđt|sdt|phone)\s*[:\s]?\s*0\d/i.test(text) && text.length < 40) {
    return true;
  }

  const contract = getPageContract(page);
  const { getNextMissingField } = require("../leads/flow");
  const next = getNextMissingField(profile, contract, sessionMeta);
  return next === "contact" && /^(0\d{9,10}|zalo)/i.test(text);
}

function buildPricingHandoffReply(page, profile, sessionMeta) {
  const address = buildHonorificAddress(sessionMeta);
  const hasPhone = hasVerifiedPhone(profile);
  const seed = hashSeed(`${sessionMeta?.profileName || ""}:pricing-handoff`);
  const opener = pickOpener(address, seed);
  const { getVerticalId } = require("../strategies/page-contracts");
  const verticalId = getVerticalId(page);

  if (verticalId === "billiards-ops") {
    if (hasPhone) {
      const lines = [
        `${opener} App SABO Arena cơ thủ tải và dùng miễn phí; quán bida có gói Club Pro dùng thử 30 ngày (chính thức 299k/tháng) — team sẽ liên hệ qua Zalo/SĐT anh/chị đã lưu để hướng dẫn chi tiết nhé ạ!`,
        `${opener} Em ghi nhận rồi ạ — lệ phí giải đấu hoặc giá bàn tùy CLB quy định, còn app cơ thủ dùng hoàn toàn miễn phí. Team sẽ liên hệ qua SĐT/Zalo đã lưu để báo sát hơn nhé ạ!`,
      ];
      return lines[seed % lines.length];
    }
    const lines = [
      `${opener} App SABO Arena cơ thủ tải và tham gia giải đấu miễn phí. Quán bida đăng ký gói Club Pro có 30 ngày dùng thử miễn phí (chính thức 299k/tháng tặng 1 triệu SPA/tháng). Cho em xin SĐT hoặc Zalo để team hỗ trợ chi tiết nhé ạ!`,
      `${opener} Dạ cơ thủ dùng app SABO Arena hoàn toàn miễn phí ạ! Nếu quán mình cần tư vấn gói Club Pro tổ chức giải đấu, cho em xin SĐT/Zalo để team tư vấn cụ thể nhé ạ!`,
    ];
    return lines[seed % lines.length];
  }

  if (verticalId === "ai-education") {
    if (hasPhone) {
      const lines = [
        `${opener} Học phí và lộ trình khóa học tùy chương trình — team sẽ gửi chi tiết qua Zalo/SĐT anh/chị đã lưu nhé ạ.`,
        `${opener} Em note rồi ạ — team sẽ liên hệ qua Zalo/SĐT để tư vấn khóa học và học phí chi tiết cho anh/chị nhé ạ.`,
      ];
      return lines[seed % lines.length];
    }
    const lines = [
      `${opener} Học phí và lộ trình khóa học AI tùy chương trình — em không báo mức học phí cụ thể trên Messenger. Cho em xin Zalo hoặc SĐT để team tư vấn chi tiết nhé ạ.`,
      `${opener} Khóa học AI có nhiều hướng (cơ bản, nâng cao, team) — anh/chị cho em xin Zalo/SĐT, team sẽ gửi thông tin học phí qua Zalo nhé.`,
    ];
    return lines[seed % lines.length];
  }

  if (hasPhone) {
    const lines = [
      `${opener} Giá phụ thuộc scope cụ thể — team SABO sẽ gửi báo giá chi tiết qua Zalo/SĐT anh/chị đã lưu nhé ạ.`,
      `${opener} Em note rồi ạ — team sẽ liên hệ qua Zalo/SĐT để gửi báo giá chính thức cho anh/chị nhé ạ.`,
    ];
    return lines[seed % lines.length];
  }

  const lines = [
    `${opener} Giá phụ thuộc scope và nhu cầu cụ thể — em không gửi mức giá cụ thể trên Messenger. Cho em xin Zalo hoặc SĐT để team gửi báo giá chi tiết nhé ạ.`,
    `${opener} Báo giá chính xác cần team xem scope trước ạ. Anh/chị cho em xin Zalo/SĐT, team sẽ gửi báo giá chi tiết qua Zalo nhé.`,
  ];
  return lines[seed % lines.length];
}

function buildPricingPolicyPromptBlock(verticalId = "sabo-mt-services") {
  if (verticalId === "billiards-ops") {
    return `
CHÍNH SÁCH BÁO GIÁ BIDA / SABO ARENA:
- Cơ thủ tải app SABO Arena, xếp hạng ELO, tìm đối thủ: HOÀN TOÀN MIỄN PHÍ.
- Quán bida / CLB: Gói Club Pro dùng thử 30 ngày MIỄN PHÍ (tặng 100.000 điểm SPA vào quỹ thưởng). Giá chính thức: 299.000đ/tháng (cấp 1.000.000 SPA) hoặc 2.990.000đ/năm (cấp 12.000.000 SPA).
- Đặt bàn bida / lệ phí giải đấu: tùy CLB quy định cụ thể.
- TUYỆT ĐỐI KHÔNG dùng từ "scope", "quy mô SME", "timeline báo giá". Xin SĐT/Zalo để hỗ trợ tạo giải hoặc kích hoạt 30 ngày dùng thử Club Pro.`.trim();
  }

  if (verticalId === "ai-education") {
    return `
CHÍNH SÁCH HỌC PHÍ AI NEWBIE:
- Không báo mức học phí cố định trên chat — học phí tùy khóa học và lộ trình.
- Xin SĐT/Zalo để team tư vấn lộ trình và học phí chi tiết.`.trim();
  }

  return `
CHÍNH SÁCH BÁO GIÁ (BẮT BUỘC — CEO policy):
- KHÔNG đưa số tiền cụ thể (VND, triệu, tr, k, đ/hình, gói Basic/Advanced, bảng giá tự bịa).
- KHÔNG liệt kê package kèm giá — pricing phụ thuộc scope thật.
- Khách hỏi giá/báo giá/ngân sách → 2–3 câu: giá tùy scope + xin Zalo/SĐT để team gửi báo giá chi tiết qua Zalo.
- Đã có SĐT/Zalo → "team sẽ liên hệ qua Zalo/SĐT đã lưu để gửi báo giá chi tiết".
- Có thể nói yếu tố ảnh hưởng giá (scope, tính năng, tích hợp) — KHÔNG kèm con số.`.trim();
}

module.exports = {
  PRICING_RE,
  VND_PRICE_OUTPUT_PATTERNS,
  isPricingQuestion,
  containsVndPricePattern,
  isInPhoneCollectionFlow,
  buildPricingHandoffReply,
  buildPricingPolicyPromptBlock,
};
