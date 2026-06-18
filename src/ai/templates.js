const { HOTLINE } = require("../responses/prompts");

const KEYWORD_REPLIES = [
  {
    patterns: [/hotline|gọi|call|phone|số điện thoại|liên hệ/i],
    reply: (page) =>
      `Hotline SABO: ${page.hotline || HOTLINE}. Bạn gọi trực tiếp để được hỗ trợ nhanh nhất nhé!`,
  },
  {
    patterns: [/giá|bao nhiêu|price|cost|báo giá|quote/i],
    reply: (page) => {
      if (page.tier === "t2") {
        return `Giá và ưu đãi do team trực tiếp tư vấn. Vui lòng gọi ${page.hotline || HOTLINE} — SABO sẽ phản hồi sớm nhất.`;
      }
      return `Giá phụ thuộc scope dự án. Để báo giá chính xác, bạn gọi ${page.hotline || HOTLINE} hoặc xem ${page.websiteUrl || "sabo.com.vn"}/contact nhé.`;
    },
  },
  {
    patterns: [/địa chỉ|address|ở đâu|vũng tàu/i],
    reply: () =>
      `SABO Media & Technology — Vũng Tàu, Việt Nam. Chi tiết địa chỉ và hẹn gặp: gọi ${HOTLINE}.`,
  },
  {
    patterns: [/cảm ơn|thank|thanks/i],
    reply: () => `Không có chi! Cần hỗ trợ thêm cứ nhắn hoặc gọi ${HOTLINE} nhé.`,
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
