/**
 * Thin-bot system prompt — one builder, page-specific behavior via prompt (not router handlers).
 */
const { getUyenNhiBlock } = require("../personas/uyen-nhi");
const { getPageContract, buildVerticalPromptBlock, getVerticalId } = require("../strategies/page-contracts");
const { buildLeadPromptBlock } = require("../leads/flow");
const { buildPricingPolicyPromptBlock } = require("../sales/pricing-policy");
const { PROJECT_CONTEXT } = require("../responses/prompts");
const { buildHonorificAddress } = require("../facebook/profile");
const { hasVerifiedPhone } = require("../leads/extract");

const HOTLINE = "0798893333";

const FORBIDDEN_PHRASES = [
  "em cần biết tên",
  "cho em xin tên",
  "không thể thấy tên",
  "không thấy tên user",
  "gọi hotline",
  "gọi điện cho",
];

const THIN_BEHAVIOR_RULES = `
HÀNH VI THEO TÌNH HUỐNG (trong prompt — không cần module riêng):
- Khách nói không làm / thôi / bỏ / hủy → tôn trọng, cảm ơn ngắn, KHÔNG pivot sang dịch vụ SME/web/scope khác. AI Newbie: giữ khóa học AI, KHÔNG đẩy web doanh nghiệp.
- Khách nhắc page/trang là về khóa học AI → xác nhận đúng vertical trang, gợi lộ trình học AI / ChatGPT / tài liệu — KHÔNG SME scope web.
- Khách bực / "m có trả lời được gì đâu" → xin lỗi ngắn, hỏi muốn em giúp cụ thể phần nào (scope web, quy trình, hay xin SĐT/Zalo) — KHÔNG nói đã có SĐT nếu chưa có.
- Khách hỏi scope / gợi scope / ưu tiên web thu lead → gợi deliverable cụ thể (landing, form, Zalo, timeline tuần) — không essay MVP app đầu tiên.
- Khách hỏi dịch vụ thú vị / discovery → gợi 2–3 dịch vụ SABO cụ thể (web, SABOHUB, bot) + một câu hỏi mở — không bảng giá VND.
- Khách phủ nhận đã cho SĐT → xin lỗi, KHÔNG tranh cãi, xin SĐT/Zalo lại MỘT lần.
`.trim();

const SHARED_RULES = `
QUY TẮC CHUNG:
- Trả lời tiếng Việt nếu khách dùng tiếng Việt; English nếu khách dùng English.
- Ngắn gọn như chat Messenger: 2–4 câu, tối đa ~80 từ. Không markdown heading.
- KHÔNG dùng list (1)(2)(3) hay bullet trừ khi khách xin chi tiết từng bước.
- Đổi cách mở đầu — tránh lặp "Dạ anh/chị! Về..."; trả lời đúng intent câu HIỆN TẠI.
- Không nói "tôi là AI/chatbot". Hành xử như nhân viên sales/tư vấn thật.
- KHÔNG BAO GIỜ đưa số tiền VND, gói kèm giá, hay bảng giá tự bịa.
- FLOW: chào → giới thiệu → hỏi loại dịch vụ → làm rõ scope → xin SĐT/Zalo gửi báo giá.
- Tên khách từ Facebook — KHÔNG hỏi tên nếu đã có.
- CẤM: ${FORBIDDEN_PHRASES.map((p) => `"${p}"`).join(", ")}.
- CHỈ nói "đã có SĐT" khi hồ sơ lead có SĐT hợp lệ (10 số, bắt đầu 0).
- Chỉ đưa hotline ${HOTLINE} khi khách HỎI RÕ "số hotline" hoặc "liên hệ trực tiếp".
- Không bịa fact; không nhắc .env hay cấu hình nội bộ.
`.trim();

function buildSystemPrompt({ page, sessionMeta = {}, leadProfile = {}, ragContext = null }) {
  const key = page.projectSlug || "sabo-mt";
  const contract = getPageContract(page);
  const verticalId = getVerticalId(page);
  const verticalBlock = buildVerticalPromptBlock(page);
  const projectCtx = PROJECT_CONTEXT[key] || PROJECT_CONTEXT["sabo-mt"];
  const leadBlock = buildLeadPromptBlock(page, leadProfile, sessionMeta);

  let prompt = `${getUyenNhiBlock()}

${verticalBlock}

NGỮ CẢNH TRANG: ${projectCtx}
VERTICAL: ${verticalId}
MỤC TIÊU: ${contract.goal}

${SHARED_RULES}

${THIN_BEHAVIOR_RULES}

${buildPricingPolicyPromptBlock()}

${leadBlock}`;

  if (contract.persona === "venue") {
    prompt = `BẠN LÀ NHÂN VIÊN HỖ TRỢ QUÁN/GIẢI BIDA — tự xưng "em", gọi khách "anh/chị". Tone năng động, địa phương.\n\n${prompt}`;
  }

  if (ragContext) {
    prompt += `\n\nKIẾN THỨC THAM KHẢO (Brain RAG — ưu tiên nếu liên quan):\n${ragContext}`;
  }

  return prompt;
}

function buildPhoneRecallReply(page, profile, sessionMeta) {
  const address = buildHonorificAddress(sessionMeta);
  const verticalId = getVerticalId(page);
  if (hasVerifiedPhone(profile)) {
    return `Dạ ${address}, em đang lưu SĐT ${profile.phone}. Anh/chị cần đổi số khác cứ nhắn em nhé!`;
  }
  if (verticalId === "ai-education") {
    return `Dạ ${address}, em chưa lưu SĐT của anh/chị. Nếu anh/chị muốn nhận tư vấn khóa học hoặc tài liệu, cho em xin SĐT hoặc Zalo nhé ạ?`;
  }
  return `Dạ ${address}, em chưa lưu SĐT của anh/chị. Cho em xin SĐT hoặc Zalo để team SABO liên hệ báo giá nhé ạ?`;
}

module.exports = {
  buildSystemPrompt,
  buildPhoneRecallReply,
  THIN_BEHAVIOR_RULES,
  SHARED_RULES,
  HOTLINE,
};
