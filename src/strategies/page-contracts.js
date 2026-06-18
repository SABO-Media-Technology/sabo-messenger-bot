/**
 * Per-page bot contract — goal, persona, lead fields.
 * Aligned with sabo-mt-website chat-lead-flow (Uyển Nhi survey spirit).
 */

const HOTLINE = "0798893333";

/** @typedef {'name'|'contact'|'business_type'|'need'|'timeline'|'budget'} LeadField */

/**
 * @type {Record<string, {
 *   goal: string,
 *   persona: 'uyen_nhi'|'generic',
 *   leadFields: LeadField[],
 *   greetingIntro: string,
 * }>}
 */
const PAGE_CONTRACTS = {
  "sabo-mt": {
    goal: "Qualify lead cho dịch vụ chuyển đổi số SABO M&T (thiết kế, web, app, automation).",
    persona: "uyen_nhi",
    leadFields: ["name", "contact", "business_type", "need", "timeline", "budget"],
    greetingIntro:
      "Chào anh/chị! Em là Uyển Nhi — trợ lý SABO Media & Technology. Em có thể giúp kiểm tra nhanh phần nào trong doanh nghiệp có thể tự động hóa. Cho em xin tên để xưng hô nhé?",
  },
  ainewbie: {
    goal: "Hỗ trợ người mới học AI + qualify lead doanh nghiệp cần tư vấn SABO M&T.",
    persona: "uyen_nhi",
    leadFields: ["name", "contact", "need"],
    greetingIntro:
      "Chào anh/chị! Em là Uyển Nhi từ AI Newbie VN. Em hỗ trợ học AI từ cơ bản và kết nối tư vấn dự án doanh nghiệp khi cần. Cho em xin tên để xưng hô nhé?",
  },
  "ai-art": {
    goal: "Hướng dẫn học tạo ảnh AI + chuyển sang SABO Design khi cần dịch vụ chuyên nghiệp.",
    persona: "uyen_nhi",
    leadFields: ["name", "contact", "need"],
    greetingIntro:
      "Chào anh/chị! Em là Uyển Nhi — hỗ trợ cộng đồng AI Art Newbie. Anh/chị cho em xin tên để xưng hô nhé?",
  },
  sabohub: {
    goal: "Giới thiệu SABOHUB Company OS và qualify pilot/demo.",
    persona: "uyen_nhi",
    leadFields: ["name", "contact", "business_type", "need"],
    greetingIntro:
      "Chào anh/chị! Em là Uyển Nhi — tư vấn SABOHUB. Cho em xin tên và ngành kinh doanh của anh/chị nhé?",
  },
  vungtau: {
    goal: "Tư vấn BĐS Vũng Tàu — thu thông tin nhu cầu mua/thuê.",
    persona: "generic",
    leadFields: ["name", "contact", "need", "timeline"],
    greetingIntro:
      `Chào anh/chị! Em hỗ trợ BĐS Vũng Tàu (VT Dream Homes). Cho em xin tên và nhu cầu (mua/thuê, khu vực) nhé? Hotline: ${HOTLINE}.`,
  },
  "sabo-arena": {
    goal: "Tư vấn Sabo Arena / app quản lý giải billiards.",
    persona: "generic",
    leadFields: ["name", "contact", "need"],
    greetingIntro:
      "Chào anh/chị! Em hỗ trợ Sabo Arena — giải đấu & cộng đồng billiards. Cho em xin tên nhé?",
  },
  "sabo-billiards": {
    goal: "Inbox SABO Billiards VT — handoff CEO, thu tên + SĐT.",
    persona: "generic",
    leadFields: ["name", "contact"],
    greetingIntro:
      `Chào anh/chị! Em ghi nhận tin nhắn cho SABO Billiards Vũng Tàu. Team sẽ phản hồi trong giờ làm việc. Cho em xin tên và SĐT nhé? Hotline: ${HOTLINE}.`,
  },
};

const FIELD_LABELS = {
  name: "tên anh/chị",
  contact: "SĐT hoặc email liên hệ",
  business_type: "ngành/lĩnh vực kinh doanh",
  need: "nhu cầu hoặc vấn đề cần giải quyết",
  timeline: "thời gian dự kiến (gấp / tháng này / đang tìm hiểu)",
  budget: "ngân sách dự kiến (chưa rõ / dưới 5tr / 5–15tr / 15tr+)",
};

function getPageContract(page) {
  const key = page?.projectSlug || "sabo-mt";
  return PAGE_CONTRACTS[key] || PAGE_CONTRACTS["sabo-mt"];
}

module.exports = { PAGE_CONTRACTS, FIELD_LABELS, getPageContract };
