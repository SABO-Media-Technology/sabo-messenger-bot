/**
 * Greeting text, auto-reply, and Persistent Menu config per page.
 * Chat greeting (Uyển Nhi) via page-contracts in router — getGreetingForPage().
 */

const DEFAULT_REPLY =
  "Cảm ơn anh/chị đã nhắn tin! Team SABO sẽ phản hồi sớm. Cho em xin SĐT hoặc email liên hệ để hỗ trợ nhanh hơn nhé?";

const DEFAULT_GREETING =
  "Xin chào {{user_first_name}}! Cảm ơn bạn đã liên hệ SABO. Chúng tôi sẽ phản hồi sớm nhất.";

/** Per-page overrides — only set fields you want to differ from default */
const PAGE_OVERRIDES = {
  "840807759121010": {
    greeting:
      "Chào {{user_first_name}}! Em là Uyển Nhi — SABO Design. Cho em xin tên đầy đủ để xưng hô nhé?",
  },
  "827460493786896": {
    greeting: "Xin chào {{user_first_name}}! SABO Web — thiết kế website giá tốt, chuẩn SEO.",
  },
  "890435434143231": {
    greeting: "Xin chào {{user_first_name}}! SABO Agency — giải pháp marketing & sáng tạo.",
  },
  "852828551244183": {
    greeting: "Xin chào {{user_first_name}}! SABO APP — thiết kế app chuyên nghiệp.",
  },
  "789401597597854": {
    greeting: "Xin chào {{user_first_name}}! Chào mừng đến SABO HUB — nền tảng quản lý doanh nghiệp.",
  },
  "618738001318577": {
    greeting: "Xin chào {{user_first_name}}! Chào mừng đến AI Art Newbie.",
  },
  "519070237965883": {
    greeting: "Xin chào {{user_first_name}}! BĐS Vũng Tàu — tư vấn bất động sản uy tín.",
  },
  "569652129566651": {
    greeting: "Xin chào {{user_first_name}}! App Quản lý Giải Đấu Billiards.",
  },
  "569671719553461": {
    greeting:
      "Chào {{user_first_name}}! Em là Uyển Nhi từ AI Newbie VN. Cho em xin tên để xưng hô nhé?",
  },
  "332950393234346": {
    greeting:
      "Chào {{user_first_name}}! Em là Uyển Nhi — SABO Media & Technology. Cho em xin tên để xưng hô nhé?",
  },
  "118356497898536": {
    greeting: "Xin chào {{user_first_name}}! SABO Billiards Vũng Tàu — hệ sinh thái billiards.",
  },
};

const PERSISTENT_MENU = {
  locale: "default",
  composer_input_disabled: false,
  call_to_actions: [
    {
      type: "postback",
      title: "📞 Gọi ngay",
      payload: "CALL_SUPPORT",
    },
    {
      type: "web_url",
      title: "🌐 Website SABO",
      url: "https://sabo.com.vn",
    },
    {
      type: "postback",
      title: "💬 Tư vấn",
      payload: "REQUEST_CONSULT",
    },
  ],
};

const GET_STARTED_PAYLOAD = "GET_STARTED";

function getReplyText(pageId) {
  const override = PAGE_OVERRIDES[pageId];
  return override?.reply || DEFAULT_REPLY;
}

function getGreetingText(pageId) {
  const override = PAGE_OVERRIDES[pageId];
  return override?.greeting || DEFAULT_GREETING;
}

function getPersistentMenu() {
  return PERSISTENT_MENU;
}

function getGetStartedPayload() {
  return GET_STARTED_PAYLOAD;
}

module.exports = {
  DEFAULT_REPLY,
  DEFAULT_GREETING,
  PAGE_OVERRIDES,
  getReplyText,
  getGreetingText,
  getPersistentMenu,
  getGetStartedPayload,
};
