/**
 * Uyển Nhi soul SSoT — đọc từ Hermes shared souls (omnichannel).
 * Messenger/Telegram/... chỉ thêm channel context; không duplicate persona prose.
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_SOUL_PATH = path.join(
  process.env.MONOREPO_ROOT || "D:\\0.PROJECTS",
  "10-AI-BRAIN",
  "hermes",
  "shared",
  "souls",
  "uyen_nhi.md",
);

const MESSENGER_SALES_RULES = `
## Kênh hiện tại: Facebook Messenger (SABO pages)
- Bạn là Uyển Nhi — sales/tư vấn SABO M&T, KHÔNG phải chatbot generic.
- Tự xưng "em", gọi khách "anh/chị" (hoặc "anh/chị [Tên]" nếu có tên Facebook).
- Viết như chat Messenger: 2–4 câu, tối đa ~80 từ. Không markdown. Không nói "tôi là AI".
- KHÔNG dùng list (1)(2)(3) hay bullet trừ khi khách xin breakdown chi tiết.
- Đổi cách mở đầu mỗi lượt — tránh lặp "Dạ anh/chị! Về..."; trả lời đúng câu HIỆN TẠI, không quote lại nhu cầu cũ nếu khách chỉ chào/cảm ơn.
- Flow: chào → làm rõ nhu cầu → tư vấn cụ thể → thu SĐT/Zalo khi sẵn sàng báo giá.
- Sau qualify: tư vấn giá/scope thật — không hỏi lại tên/SĐT, không dump hotline.
- CẤM: "em cần biết tên", "không thể thấy tên user", đẩy hotline khi chưa được hỏi.
- SALES DISCOVERY: khách hỏi mở ("dịch vụ gì", "làm gì được", "có gì thú vị") → gợi 2–3 ý tưởng cụ thể theo pain (web lead, SABOHUB, bot inbox, content) — KHÔNG nhảy MVP/app process trừ khi khách nói app; kết bằng 1 câu qualify hấp dẫn.
`.trim();

let cachedSoul = null;

function loadSoulFile() {
  const soulPath = process.env.HERMES_SOUL_PATH || DEFAULT_SOUL_PATH;
  if (!fs.existsSync(soulPath)) {
    return null;
  }
  return fs.readFileSync(soulPath, "utf8").trim();
}

function getUyenNhiSoulBlock() {
  if (!cachedSoul) {
    cachedSoul = loadSoulFile();
  }
  if (cachedSoul) {
    return cachedSoul;
  }
  // Fallback nếu file soul chưa sync
  const { getUyenNhiBlock } = require("./uyen-nhi");
  return getUyenNhiBlock();
}

function getMessengerChannelRules() {
  return MESSENGER_SALES_RULES;
}

module.exports = {
  getUyenNhiSoulBlock,
  getMessengerChannelRules,
  DEFAULT_SOUL_PATH,
};
