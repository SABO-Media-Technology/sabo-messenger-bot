/**
 * Progressive lead collection — one field at a time, Vietnamese sales flow.
 * Order: need/interest → qualify → contact (Highvision-style, not interrogation).
 */

const { getPageContract, getVertical, getFieldLabel } = require("../strategies/page-contracts");
const { hasContact } = require("./extract");
const { buildHonorificAddress } = require("../facebook/profile");

function emptyProfile() {
  return {
    name: null,
    phone: null,
    email: null,
    business_type: null,
    need: null,
    timeline: null,
    budget: null,
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

function getNextMissingField(profile, contract, sessionMeta = {}) {
  for (const field of contract.leadFields) {
    if (field === "name" && shouldSkipNameField(profile, sessionMeta)) continue;
    if (!profileField(profile, field)) return field;
  }
  return null;
}

function isLeadComplete(profile, contract, sessionMeta = {}) {
  const required = ["contact", "need"];
  for (const field of required) {
    if (!profileField(profile, field)) return false;
  }
  if (!shouldSkipNameField(profile, sessionMeta) && contract.leadFields.includes("name")) {
    if (!profileField(profile, "name")) return false;
  }
  return true;
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
  return lines.length ? lines.join("\n") : "(chưa có)";
}

function buildLeadPromptBlock(page, profile, sessionMeta = {}) {
  const contract = getPageContract(page);
  const vertical = getVertical(page);
  const next = getNextMissingField(profile, contract, sessionMeta);
  const collected = buildCollectedSummary(profile, sessionMeta);
  const complete = isLeadComplete(profile, contract, sessionMeta);
  const address = buildHonorificAddress(sessionMeta);

  let block = `
MỤC TIÊU TRANG: ${contract.goal}
VERTICAL: ${vertical.label} (${vertical.id})

XƯNG HÔ KHÁCH: ${address}
${sessionMeta.profileName ? `TÊN TỪ FACEBOOK: ${sessionMeta.profileName} — KHÔNG hỏi "tên là gì".` : ""}
${sessionMeta.nameRefused ? "Khách từ chối cho tên — chỉ dùng anh/chị, KHÔNG hỏi lại tên." : ""}

HỒ SƠ LEAD ĐÃ THU (PSID session):
${collected}

QUY TẮC HỘI THOẠI (ƯU TIÊN CAO — BẮT BUỘC):
${vertical.forbidden.map((f) => `- ${f}`).join("\n")}
- CẤM: "em cần biết tên", "cho em xin tên", "không thể thấy tên user", dump hotline khi chưa được hỏi.
- Thứ tự tự nhiên: trả lời câu hỏi → làm rõ nhu cầu/loại dịch vụ → khi sẵn sàng báo giá mới xin SĐT/Zalo.
- SABO/quán chủ động liên hệ khách sau khi có contact.
- Sau khi trả lời câu hỏi của khách, PHẢI hỏi đúng MỘT field thiếu (nếu còn thiếu).
`.trim();

  if (!complete && next) {
    const label = getFieldLabel(page, next);
    block += `

THIẾU: ${label}.
BẮT BUỘC LƯỢT NÀY: trả lời ngắn câu hỏi khách (nếu có) → kết thúc bằng hỏi ${label}. Không hỏi dồn nhiều câu. ${vertical.ctaStyle}`;
  } else if (complete) {
    block += `

ĐỦ THÔNG TIN LEAD (liên hệ + nhu cầu). Cảm ơn khách, tóm tắt ngắn và nói team sẽ liên hệ sớm. Không hỏi thêm field bắt buộc. Không đưa hotline trừ khi khách hỏi rõ.`;
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
  shouldSkipNameField,
  getNextMissingField,
  isLeadComplete,
  buildLeadPromptBlock,
  buildCollectedSummary,
  buildGreetingForSession,
  getGreetingForPage,
};
