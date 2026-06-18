const { HOTLINE } = require("../responses/prompts");

const KEYWORD_REPLIES = [
  {
    // Chỉ khi khách HỎI RÕ hotline / số văn phòng — không match "liên hệ" chung chung
    patterns: [/hotline|số hotline|số điện thoại.*(công ty|sabo|văn phòng)|liên hệ trực tiếp|gọi.*(sabo|văn phòng)/i],
    reply: (page) =>
      `Hotline SABO: ${page.hotline || HOTLINE}. Anh/chị cũng có thể để lại SĐT/email ở đây — team sẽ gọi lại sớm nhất nhé!`,
  },
  {
    patterns: [/giá|bao nhiêu|price|cost|báo giá|quote/i],
    reply: () =>
      `Giá phụ thuộc scope và nhu cầu cụ thể của anh/chị. Để team SABO tư vấn chi tiết và báo giá phù hợp, em xin SĐT hoặc email liên hệ được không ạ?`,
  },
  {
    patterns: [/sản phẩm|dịch vụ|bán gì|làm gì|offer|service/i],
    reply: (page) => {
      if (page.projectSlug === "ainewbie") {
        return `Ngoài nội dung học AI miễn phí, SABO M&T còn hỗ trợ doanh nghiệp: website, app, automation, thiết kế. Anh/chị quan tâm phần nào — em tư vấn ngắn và kết nối team phù hợp. Cho em xin SĐT hoặc email để team liên hệ nhé?`;
      }
      return `SABO hỗ trợ thiết kế, website, app, marketing và chuyển đổi số cho SME. Anh/chị đang cần giải pháp nào — em tư vấn ngắn. Cho em xin SĐT hoặc email liên hệ được không ạ?`;
    },
  },
  {
    patterns: [/địa chỉ|address|ở đâu/i],
    reply: () =>
      `SABO Media & Technology — Vũng Tàu, Việt Nam. Anh/chị cần hẹn gặp trực tiếp hay tư vấn online? Cho em xin SĐT hoặc email để team sắp xếp nhé.`,
  },
  {
    patterns: [/cảm ơn|thank|thanks/i],
    reply: () => `Dạ không có chi! Anh/chị cần hỗ trợ thêm cứ nhắn em nhé.`,
  },
];

/**
 * Layer 0 — instant template match (no LLM).
 */
function matchTemplate(userText, page) {
  const text = (userText || "").trim();
  if (!text) return null;

  for (const rule of KEYWORD_REPLIES) {
    if (rule.patterns.some((re) => re.test(text))) {
      return rule.reply(page);
    }
  }
  return null;
}

module.exports = { matchTemplate, KEYWORD_REPLIES };
