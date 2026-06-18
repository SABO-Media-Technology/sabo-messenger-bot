const LEAD_SIGNALS = [
  "muốn",
  "cần",
  "tư vấn",
  "báo giá",
  "quote",
  "interested",
  "liên hệ",
  "đặt lịch",
  "demo",
  "hợp tác",
  "mua",
  "thuê",
  "đăng ký",
  "booking",
  "contact",
];

const HOT_LEAD_SIGNALS = [
  "gấp",
  "hôm nay",
  "ngay",
  "urgent",
  "asap",
  "ký hợp đồng",
  "chốt",
];

function detectLeadIntent(message) {
  const lower = (message || "").toLowerCase();
  return LEAD_SIGNALS.some((s) => lower.includes(s));
}

function detectHotLead(message) {
  const lower = (message || "").toLowerCase();
  return detectLeadIntent(message) && HOT_LEAD_SIGNALS.some((s) => lower.includes(s));
}

function extractPhone(text) {
  const m = (text || "").match(/(?:\+?84|0)\d{8,10}/);
  return m ? m[0] : null;
}

module.exports = { detectLeadIntent, detectHotLead, extractPhone, LEAD_SIGNALS };
