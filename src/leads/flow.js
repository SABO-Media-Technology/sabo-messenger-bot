/**
 * Progressive lead collection — one field at a time, Vietnamese sales flow.
 * Order: need/interest → qualify → contact (Highvision-style, not interrogation).
 */

const { getPageContract, getVertical, getFieldLabel } = require("../strategies/page-contracts");
const { hasContact, hasVerifiedPhone } = require("./extract");
const { buildHonorificAddress } = require("../facebook/profile");
const { buildPostQualifyPricingHint } = require("./post-qualify-consult");

const REQUIRED_FIELDS = ["need", "contact"];
const OPTIONAL_FIELDS = ["business_type", "timeline", "budget"];

function emptyProfile() {
  return {
    name: null,
    phone: null,
    email: null,
    business_type: null,
    need: null,
    timeline: null,
    budget: null,
    qualified: false,
    queued: false,
  };
}

function shouldSkipNameField(profile, sessionMeta = {}) {
  if (profile.name) return true;
  if (sessionMeta.profileName) return true;
  if (sessionMeta.nameRefused) return true;
  return false;
}

function profileField(profile, field) {
  switch (field) {
    case "name":
      return profile.name;
    case "contact":
      return hasContact(profile) ? "ok" : null;
    case "business_type":
      return profile.business_type;
    case "need":
      return profile.need;
    case "timeline":
      return profile.timeline;
    case "budget":
      return profile.budget;
    default:
      return null;
  }
}

function getNextMissingField(profile, contract, sessionMeta = {}, { intakeOnly = true } = {}) {
  const fields = intakeOnly
    ? contract.leadFields.filter((f) => REQUIRED_FIELDS.includes(f) || f === "name")
    : contract.leadFields;

  for (const field of fields) {
    if (field === "name" && shouldSkipNameField(profile, sessionMeta)) continue;
    if (!profileField(profile, field)) return field;
  }
  return null;
}

function isLeadComplete(profile, contract, sessionMeta = {}) {
  for (const field of REQUIRED_FIELDS) {
    if (!contract.leadFields.includes(field)) continue;
    if (!profileField(profile, field)) return false;
  }
  if (!shouldSkipNameField(profile, sessionMeta) && contract.leadFields.includes("name")) {
    if (!profileField(profile, "name")) return false;
  }
  return true;
}

function markQualified(profile, contract, sessionMeta = {}) {
  const complete = isLeadComplete(profile, contract, sessionMeta);
  if (!complete) return { ...profile, qualified: false, queued: profile.queued && complete };
  if (profile.qualified && complete) return profile;
  return { ...profile, qualified: true };
}

function isPostQualify(profile, contract, sessionMeta = {}) {
  return isLeadComplete(profile, contract, sessionMeta);
}

function buildCollectedSummary(profile, sessionMeta = {}) {
  const lines = [];
  const displayName = profile.name || sessionMeta.profileName;
  if (displayName) lines.push(`Tên: ${displayName}`);
  if (profile.phone) lines.push(`SĐT/Zalo: ${profile.phone}`);
  if (profile.email) lines.push(`Email: ${profile.email}`);
  if (profile.business_type) lines.push(`Ngành: ${profile.business_type}`);
  if (profile.need) lines.push(`Nhu cầu: ${profile.need}`);
  if (profile.timeline) lines.push(`Timeline: ${profile.timeline}`);
  if (profile.budget) lines.push(`Ngân sách: ${profile.budget}`);
  if (sessionMeta.nameRefused) lines.push(`Xưng hô: anh/chị (khách không muốn cho tên)`);
  if (profile.qualified) lines.push(`Trạng thái: LEAD ĐÃ QUALIFY`);
  return lines.length ? lines.join("\n") : "(chưa có)";
}

function buildPostQualifyBlock(profile, sessionMeta = {}) {
  const address = buildHonorificAddress(sessionMeta);
  const hasPhone = hasVerifiedPhone(profile);
  const contactLine = hasPhone
    ? `- Kết thúc nhẹ: team SABO đã có SĐT — sẽ liên hệ báo sát, không dump hotline.`
    : `- CHƯA CÓ SĐT/Zalo hợp lệ — KHÔNG nói "đã có SĐT" hay "team sẽ gọi". Kết bằng xin SĐT/Zalo MỘT lần nếu phù hợp.`;
  return `
CHẾ ĐỘ TƯ VẤN SAU QUALIFY (ƯU TIÊN CAO NHẤT):
- Lead đã có nhu cầu${hasPhone ? " + contact" : ""}. Xưng hô: ${address}.
- KHÔNG hỏi lại tên${hasPhone ? ", SĐT, email" : ""}, ngành/lĩnh vực — đã có trong hồ sơ bên dưới.
- KHÔNG nói "em cần biết tên", "cho em xin tên", "không thể thấy tên".
- Viết như chat Messenger: 2–4 câu tự nhiên — KHÔNG list (1)(2)(3) trừ khi khách xin breakdown.
- Khách chỉ chào/cảm ơn → chào lại ngắn, KHÔNG nhắc lại essay tư vấn cũ.
- Khách hỏi tư vấn / thắc mắc / so sánh → trả lời CỤ THỂ theo câu HIỆN TẠI — KHÔNG chỉ defer "team sẽ gọi".
- Khách hỏi giá → KHÔNG số tiền cụ thể; giá tùy scope + xin Zalo/SĐT (hoặc team liên hệ qua contact đã lưu) để gửi báo giá chi tiết qua Zalo.
- Khách đổi nhu cầu (web→app, v.v.) → cập nhật tư vấn theo nhu cầu MỚI trong câu trả lời.
- Mỗi lượt trả lời KHÁC lượt trước — đọc history, không lặp nguyên văn hay opener "Dạ anh/chị! Về...".
- Có thể upsell nhẹ dịch vụ liên quan (hosting, SEO, automation) nếu phù hợp — không ép.
${contactLine}
- CẤM TUYỆT ĐỐI nói "đã có SĐT" / "team sẽ gọi" nếu hồ sơ KHÔNG có SĐT hợp lệ.

${buildPostQualifyPricingHint(hasPhone)}
`.trim();
}

function buildLeadPromptBlock(page, profile, sessionMeta = {}) {
  const contract = getPageContract(page);
  const vertical = getVertical(page);
  const collected = buildCollectedSummary(profile, sessionMeta);
  const complete = isLeadComplete(profile, contract, sessionMeta);
  const postQualify = isPostQualify(profile, contract, sessionMeta);
  const hasPhone = hasVerifiedPhone(profile);
  const next = postQualify ? null : getNextMissingField(profile, contract, sessionMeta, { intakeOnly: true });
  const address = buildHonorificAddress(sessionMeta);

  let block = `
MỤC TIÊU TRANG: ${contract.goal}
VERTICAL: ${vertical.label} (${vertical.id})

XƯNG HÔ KHÁCH: ${address}
${sessionMeta.profileName ? `TÊN TỪ FACEBOOK: ${sessionMeta.profileName} — KHÔNG hỏi "tên là gì".` : ""}
${sessionMeta.nameRefused ? "Khách từ chối cho tên — chỉ dùng anh/chị, KHÔNG hỏi lại tên." : ""}

HỒ SƠ LEAD ĐÃ THU (PSID session — PHẢI nhớ xuyên suốt):
${collected}
SĐT HỢP LỆ: ${hasPhone ? `CÓ (${profile.phone})` : "CHƯA CÓ — CẤM nói đã có SĐT"}

QUY TẮC HỘI THOẠI (ƯU TIÊN CAO — BẮT BUỘC):
${vertical.forbidden.map((f) => `- ${f}`).join("\n")}
- CẤM: "em cần biết tên", "cho em xin tên", "không thể thấy tên user", dump hotline khi chưa được hỏi.
- CẤM: "đã có SĐT", "team sẽ gọi", "team đã có SĐT" khi SĐT HỢP LỆ = CHƯA CÓ.
- Khách hỏi "SĐT của tôi là gì" → nếu có SĐT thì đọc lại; nếu chưa có → "Em chưa lưu SĐT, cho em xin SĐT/Zalo nhé".
- Khách phủ nhận đã cho SĐT → xin lỗi, xóa SĐT sai, xin SĐT lại MỘT lần.
- Thứ tự tự nhiên: trả lời câu hỏi → làm rõ nhu cầu/loại dịch vụ → khi sẵn sàng báo giá mới xin SĐT/Zalo.
- SABO/quán chủ động liên hệ khách sau khi có contact.
`.trim();

  if (postQualify) {
    block += `\n\n${buildPostQualifyBlock(profile, sessionMeta)}`;
    return block;
  }

  if (!complete && next) {
    const label = getFieldLabel(page, next);
    block += `

THIẾU (chỉ hỏi MỘT field này): ${label}.
BẮT BUỘC LƯỢT NÀY: trả lời ngắn câu hỏi khách (nếu có) → kết thúc bằng hỏi ${label}. Không hỏi dồn nhiều câu. ${vertical.ctaStyle}`;
  }

  return block;
}

function buildGreetingForSession(page, sessionMeta = {}) {
  const base = getPageContract(page).greetingIntro;
  if (sessionMeta.nameRefused) {
    return base.replace(/anh\/chị\s+\w+/i, "anh/chị").replace(/anh\s+\w+/i, "anh/chị");
  }
  const first = sessionMeta.firstName;
  if (first) {
    return base.replace(/anh\/chị/gi, `anh/chị ${first}`);
  }
  return base;
}

function getGreetingForPage(page) {
  return getPageContract(page).greetingIntro;
}

module.exports = {
  emptyProfile,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  shouldSkipNameField,
  getNextMissingField,
  isLeadComplete,
  isPostQualify,
  markQualified,
  buildLeadPromptBlock,
  buildCollectedSummary,
  buildPostQualifyBlock,
  buildGreetingForSession,
  getGreetingForPage,
};
