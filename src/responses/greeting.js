/**
 * Greeting text, auto-reply, Icebreakers, and Persistent Menu config per page.
 * Strictly follow Uyển Nhi 100% humanized persona.
 */

const DEFAULT_REPLY =
  "Dạ cảm ơn anh/chị đã nhắn tin cho em nha! Em là Uyển Nhi bên SABO. Anh/chị cho em xin số Zalo hoặc SĐT để em hỗ trợ tư vấn chi tiết cho mình nhanh nhất nhé ạ!";

const DEFAULT_GREETING =
  "Dạ em chào anh/chị ạ! Em là Uyển Nhi bên SABO. Anh/chị đang cần em hỗ trợ dịch vụ nào thế ạ?";

/** Per-page overrides for natural Vietnamese Uyển Nhi tone */
const PAGE_OVERRIDES = {
  // SABO Design
  "840807759121010": {
    greeting: "Dạ em chào anh/chị ạ! Em là Uyển Nhi — SABO Design. Anh/chị đang cần thiết kế logo, poster hay bộ nhận diện thương hiệu thế ạ?",
    icebreakers: [
      { question: "🎨 Báo giá thiết kế logo/poster", payload: "Báo giá thiết kế logo/poster" },
      { question: "📁 Xem các mẫu thiết kế đã làm", payload: "Xem các mẫu thiết kế đã làm" },
      { question: "💬 Tư vấn bộ nhận diện thương hiệu", payload: "Tư vấn bộ nhận diện thương hiệu" },
    ],
  },
  // SABO Web
  "827460493786896": {
    greeting: "Dạ em chào anh/chị ạ! Em là Uyển Nhi bên SABO Web. Bên em thiết kế website may đo chuẩn SEO, bảo mật cao và tối ưu chuyển đổi cho doanh nghiệp mình ạ.",
    icebreakers: [
      { question: "🌐 Báo giá làm website chuẩn SEO", payload: "Báo giá làm website chuẩn SEO" },
      { question: "🚀 Xem mẫu website thực tế", payload: "Xem mẫu website thực tế" },
      { question: "📱 Tư vấn làm web app theo yêu cầu", payload: "Tư vấn làm web app theo yêu cầu" },
    ],
  },
  // SABO Agency
  "890435434143231": {
    greeting: "Dạ em chào anh/chị ạ! Em là Uyển Nhi bên SABO Agency. Bên em chuyên giải pháp tăng trưởng marketing và tự động hóa vận hành cho doanh nghiệp.",
    icebreakers: [
      { question: "📈 Giải pháp marketing tăng trưởng", payload: "Giải pháp marketing tăng trưởng" },
      { question: "🤖 Tự động hóa CSKH & Lead", payload: "Tự động hóa CSKH & Lead" },
      { question: "💬 Đặt lịch tư vấn cùng chuyên gia", payload: "Đặt lịch tư vấn cùng chuyên gia" },
    ],
  },
  // SABO App
  "852828551244183": {
    greeting: "Dạ em chào anh/chị ạ! Em là Uyển Nhi bên SABO App. Bên em phát triển ứng dụng di động iOS/Android chuẩn chuyên nghiệp và mượt mà.",
    icebreakers: [
      { question: "📱 Chi phí làm app di động (iOS/Android)", payload: "Chi phí làm app di động (iOS/Android)" },
      { question: "⚡ Xem các app SABO đã triển khai", payload: "Xem các app SABO đã triển khai" },
      { question: "💬 Tư vấn kiến trúc & tính năng app", payload: "Tư vấn kiến trúc & tính năng app" },
    ],
  },
  // SABO HUB
  "789401597597854": {
    greeting: "Dạ em chào anh/chị ạ! Em là Uyển Nhi từ SABO HUB — nền tảng quản trị và hệ điều hành doanh nghiệp all-in-one.",
    icebreakers: [
      { question: "🏢 Trải nghiệm demo SABOHUB", payload: "Trải nghiệm demo SABOHUB" },
      { question: "💼 Quản lý công việc & nhân sự", payload: "Quản lý công việc & nhân sự" },
      { question: "💬 Tư vấn gói triển khai cho SME", payload: "Tư vấn gói triển khai cho SME" },
    ],
  },
  // AI Art Newbie
  "618738001318577": {
    greeting: "Dạ em chào anh/chị ạ! Em là Uyển Nhi bên AI Art Newbie. Anh/chị đang muốn học vẽ AI Midjourney hay sáng tạo ảnh thương mại thế ạ?",
    icebreakers: [
      { question: "🎨 Khóa học Midjourney từ cơ bản", payload: "Khóa học Midjourney từ cơ bản" },
      { question: "🖼️ Cách vẽ ảnh quảng cáo bằng AI", payload: "Cách vẽ ảnh quảng cáo bằng AI" },
      { question: "💬 Tư vấn đăng ký học", payload: "Tư vấn đăng ký học" },
    ],
  },
  // BĐS Vũng Tàu
  "519070237965883": {
    greeting: "Dạ em chào anh/chị ạ! Em là Uyển Nhi bên BĐS Vũng Tàu. Anh/chị đang tìm mua đất, căn hộ nghỉ dưỡng hay ký gửi nhà đất tại TP. Vũng Tàu ạ?",
    icebreakers: [
      { question: "🏖️ Căn hộ biển Vũng Tàu giá tốt", payload: "Căn hộ biển Vũng Tàu giá tốt" },
      { question: "🏡 Nhà phố & đất nền ven biển", payload: "Nhà phố & đất nền ven biển" },
      { question: "📑 Ký gửi mua bán nhà đất", payload: "Ký gửi mua bán nhà đất" },
    ],
  },
  // App Quản lý Giải Đấu Billiards
  "569652129566651": {
    greeting: "Dạ em chào anh em bida ạ! Em là Uyển Nhi bên SABO Arena. Em hỗ trợ về phần mềm quản lý quán, tổ chức giải đấu TV Mode và bảng điểm ELO cơ thủ nè.",
    icebreakers: [
      { question: "🎁 Đăng ký dùng thử PRO 30 ngày", payload: "Đăng ký dùng thử PRO 30 ngày" },
      { question: "📺 Cách cài đặt TV Mode giải đấu", payload: "Cách cài đặt TV Mode giải đấu" },
      { question: "🎱 Tính điểm ELO và tìm kèo giao lưu", payload: "Tính điểm ELO và tìm kèo giao lưu" },
    ],
  },
  // AI Newbie VN
  "569671719553461": {
    greeting: "Dạ em chào anh/chị ạ! Em là Uyển Nhi từ AI Newbie VN. Anh/chị đang muốn học ứng dụng AI vào công việc hay tự động hóa bán hàng ạ?",
    icebreakers: [
      { question: "🤖 Lộ trình học AI cho người mới", payload: "Lộ trình học AI cho người mới" },
      { question: "🎬 Cách làm video ngắn bằng AI", payload: "Cách làm video ngắn bằng AI" },
      { question: "💬 Nhận tài liệu AI miễn phí", payload: "Nhận tài liệu AI miễn phí" },
    ],
  },
  // SABO Media
  "332950393234346": {
    greeting: "Dạ em chào anh/chị ạ! Em là Uyển Nhi bên SABO Media. Bên em chuyên kịch bản video ngắn TikTok/Reels và sản xuất nội dung media cho thương hiệu.",
    icebreakers: [
      { question: "🎬 Kịch bản video TikTok 30s viral", payload: "Kịch bản video TikTok 30s viral" },
      { question: "📹 Gói sản xuất media trọn gói", payload: "Gói sản xuất media trọn gói" },
      { question: "💬 Tư vấn xây kênh thương hiệu", payload: "Tư vấn xây kênh thương hiệu" },
    ],
  },
  // SABO Billiards Vũng Tàu
  "118356497898536": {
    greeting: "Dạ em chào anh em cơ thủ ạ! Em là Uyển Nhi bên CLB SABO Billiards Vũng Tàu. Anh đang cần đặt bàn, đăng ký giải hay tìm bạn dợt cơ thế anh?",
    icebreakers: [
      { question: "🎱 Đặt bàn trước tại CLB", payload: "Đặt bàn trước tại CLB" },
      { question: "🏆 Lịch thi đấu giải bida sắp tới", payload: "Lịch thi đấu giải bida sắp tới" },
      { question: "🍻 Menu nước & ưu đãi giờ chơi", payload: "Menu nước & ưu đãi giờ chơi" },
    ],
  },
};

const PERSISTENT_MENU = {
  locale: "default",
  composer_input_disabled: false,
  call_to_actions: [
    {
      type: "postback",
      title: "📞 Gặp Quản Lý / Admin",
      payload: "gặp admin",
    },
    {
      type: "web_url",
      title: "🌐 Website SABO",
      url: "https://sabo.com.vn",
    },
    {
      type: "postback",
      title: "💬 Tư Vấn Trực Tiếp",
      payload: "Xin chào, tư vấn giúp tôi",
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

function getPageIcebreakers(pageId) {
  const override = PAGE_OVERRIDES[pageId];
  if (override?.icebreakers) {
    return override.icebreakers;
  }
  return [
    { question: "💬 Tư vấn dịch vụ", payload: "Tư vấn dịch vụ" },
    { question: "📞 Gặp nhân viên tư vấn", payload: "gặp admin" },
  ];
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
  getPageIcebreakers,
  getPersistentMenu,
  getGetStartedPayload,
};
