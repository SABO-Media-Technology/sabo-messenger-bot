/**
 * Progressive lead collection — one field at a time, Vietnamese primary.
 */

const { FIELD_LABELS, getPageContract } = require("../strategies/page-contracts");
const { hasContact } = require("./extract");

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

function getNextMissingField(profile, contract) {
  for (const field of contract.leadFields) {
    if (!profileField(profile, field)) return field;
  }
  return null;
}

function isLeadComplete(profile, contract) {
  const required = contract.leadFields.filter((f) =>
    ["name", "contact", "need"].includes(f),
  );
  for (const field of required) {
    if (!profileField(profile, field)) return false;
  }
  return true;
}

function buildCollectedSummary(profile) {
  const lines = [];
  if (profile.name) lines.push(`Tên: ${profile.name}`);
  if (profile.phone) lines.push(`SĐT: ${profile.phone}`);
  if (profile.email) lines.push(`Email: ${profile.email}`);
  if (profile.business_type) lines.push(`Ngành: ${profile.business_type}`);
  if (profile.need) lines.push(`Nhu cầu: ${profile.need}`);
  if (profile.timeline) lines.push(`Timeline: ${profile.timeline}`);
  if (profile.budget) lines.push(`Ngân sách: ${profile.budget}`);
  return lines.length ? lines.join("\n") : "(chưa có)";
}

function buildLeadPromptBlock(page, profile) {
  const contract = getPageContract(page);
  const next = getNextMissingField(profile, contract);
  const collected = buildCollectedSummary(profile);
  const complete = isLeadComplete(profile, contract);

  let block = `
MỤC TIÊU TRANG: ${contract.goal}

HỒ SƠ LEAD ĐÃ THU (PSID session):
${collected}
`.trim();

  if (!complete && next) {
    const label = FIELD_LABELS[next] || next;
    block += `

THIẾU: ${label}.
QUY TẮC HỎI: hỏi NHẸ đúng MỘT thông tin (${label}); xác nhận ngắn thông tin vừa nhận nếu có; không hỏi dồn nhiều câu.`;
  } else if (complete) {
    block += `

ĐỦ THÔNG TIN LEAD (tên + liên hệ + nhu cầu). Cảm ơn khách, tóm tắt ngắn và hướng hotline/website nếu phù hợp. Không hỏi thêm field bắt buộc.`;
  }

  return block;
}

function getGreetingForPage(page) {
  return getPageContract(page).greetingIntro;
}

module.exports = {
  emptyProfile,
  getNextMissingField,
  isLeadComplete,
  buildLeadPromptBlock,
  buildCollectedSummary,
  getGreetingForPage,
};
