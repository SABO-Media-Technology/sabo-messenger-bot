/**
 * SABO M&T service catalog — structured offers for sales discovery replies.
 * Ground truth: CHIEN_LUOC_PHAT_TRIEN_2026.md + page-contracts vertical.
 */

/** @typedef {{ id: string, name: string, hook: string, outcome: string, priceHint?: string }} SaboOffer */

/** @type {Record<string, SaboOffer[]>} */
const OFFERS_BY_VERTICAL = {
  "sabo-mt-services": [
    {
      id: "web-leadgen",
      name: "Website thu lead",
      hook: "Khách inbox nhiều mà chưa có chỗ để giữ lead",
      outcome: "Landing + form/Zalo — khách để lại SĐT 24/7, team gọi lại có data",
      priceHint: "thường 15–50tr tùy trang & thanh toán",
    },
    {
      id: "sabohub-vertical",
      name: "SABOHUB theo ngành",
      hook: "Vận hành rời 3–4 app, mất nhịp ca, CEO không có dashboard",
      outcome: "Company OS + mobile — quản ca, đơn, khách, báo cáo một chỗ",
      priceHint: "gói vertical setup 10–30tr + 3–10tr/tháng",
    },
    {
      id: "automation-ai",
      name: "Automation & chatbot AI",
      hook: "Trả lời inbox chậm, lead nguội trước khi sales kịp gọi",
      outcome: "Bot Messenger/Zalo tư vấn sơ + thu SĐT, workflow n8n nối CRM",
    },
    {
      id: "brand-content",
      name: "Thiết kế & content AI",
      hook: "Feed social đìu, thiếu visual chuyên nghiệp",
      outcome: "Logo, poster, video ngắn AI — đồng bộ brand, tăng nhận diện",
    },
  ],
  platform: [
    {
      id: "sabohub-demo",
      name: "SABOHUB pilot",
      hook: "Quản lý bằng Excel/Zalo group — khó scale",
      outcome: "Demo vertical theo ngành anh/chị — ca, đơn, nhân sự trên app",
      priceHint: "setup 10–30tr + subscription",
    },
    {
      id: "web-leadgen",
      name: "Website thu lead",
      hook: "Chưa có kênh online chính thức",
      outcome: "Trang giới thiệu + thu contact — làm nền trước khi lên app",
    },
  ],
  "ai-education": [
    {
      id: "ai-workshop",
      name: "Học AI cho team",
      hook: "Team chưa biết dùng ChatGPT/ảnh AI cho việc hàng ngày",
      outcome: "Workflow AI cơ bản — tiết kiệm giờ content & báo cáo",
    },
    {
      id: "biz-automation",
      name: "Dự án AI doanh nghiệp",
      hook: "Học xong muốn triển khai thật cho công ty",
      outcome: "SABO M&T build bot/automation theo quy trình riêng",
    },
  ],
  "real-estate": [
    {
      id: "vt-listings",
      name: "Web BĐS + lead",
      hook: "Tin đăng rải rác, khách khó tìm đúng căn",
      outcome: "Trang listing Vũng Tàu + form liên hệ — môi giới gọi nhanh",
    },
  ],
  "billiards-ops": [
    {
      id: "arena-app",
      name: "App quản lý giải",
      hook: "Tổ giải thủ công — bracket, điểm, thông báo mệt",
      outcome: "Sabo Arena — đăng ký giải, bảng đấu, cộng đồng billiards",
    },
  ],
};

function getOffersForPage(page) {
  const { getVerticalId } = require("../strategies/page-contracts");
  const verticalId = getVerticalId(page);
  return OFFERS_BY_VERTICAL[verticalId] || OFFERS_BY_VERTICAL["sabo-mt-services"];
}

function pickOffers(page, count = 3, seed = 0) {
  const offers = getOffersForPage(page);
  if (offers.length <= count) return offers;
  const start = seed % offers.length;
  const picked = [];
  for (let i = 0; i < count; i++) {
    picked.push(offers[(start + i) % offers.length]);
  }
  return picked;
}

module.exports = {
  OFFERS_BY_VERTICAL,
  getOffersForPage,
  pickOffers,
};
