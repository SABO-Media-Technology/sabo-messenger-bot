/**
 * Single system prompt builder — per-page vertical behavior lives here, not in router handlers.
 * Pattern: vercel/chatbot buildSystemPrompt() + meta-ai-chatbot page context.
 */
const { getUyenNhiBlock } = require("../personas/uyen-nhi");
const { getPageContract, buildVerticalPromptBlock, getVerticalId } = require("../strategies/page-contracts");
const { buildLeadPromptBlock } = require("../leads/flow");
const { buildPricingPolicyPromptBlock } = require("../sales/pricing-policy");
const { PROJECT_CONTEXT } = require("../responses/prompts");
const { buildHonorificAddress } = require("../facebook/profile");
const { hasVerifiedPhone } = require("../leads/extract");

const { DEFAULT_HOTLINE, applyHotline } = require("../hotline");
const HOTLINE = DEFAULT_HOTLINE; // back-compat default

const FORBIDDEN_PHRASES = [
  "em cần biết tên",
  "cho em xin tên",
  "không thể thấy tên",
  "không thấy tên user",
  "gọi hotline",
  "gọi điện cho",
];

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
- Chỉ đưa hotline {{HOTLINE}} khi khách HỎI RÕ "số hotline" hoặc "liên hệ trực tiếp".
- Không bịa fact; không nhắc .env hay cấu hình nội bộ.
`.trim();

/** Per-vertical situational rules — replaces separate router intent handlers. */
const VERTICAL_BEHAVIOR = {
  "ai-education": `
HÀNH VI AI NEWBIE (khóa học AI — KHÔNG SME/web):
- Khách nói không làm / thôi / bỏ → tôn trọng, cảm ơn ngắn về khóa học AI. KHÔNG pivot sang web doanh nghiệp hay scope SME.
- Khách nhắc page là về khóa học AI → xác nhận đúng, gợi lộ trình ChatGPT / học tạo ảnh AI.
- Khách hỏi giá/học phí → không nêu mức học phí cụ thể trên Messenger; xin Zalo/SĐT để team gửi thông tin khóa học qua kênh riêng.
- Không đẩy thiết kế web, landing thu lead, hay automation B2B trừ khi khách tự hỏi dịch vụ doanh nghiệp.
`.trim(),
  "sabo-mt-services": `
HÀNH VI SABO M&T (B2B chuyển đổi số):
- Khách hỏi dịch vụ thú vị / discovery → gợi 2–3 dịch vụ cụ thể (web thu lead, SABOHUB, bot Messenger) + một câu hỏi mở.
- Khách ưu tiên web thu lead → gợi deliverable cụ thể: landing, form, Zalo, timeline ~1–2 tuần — không essay MVP app.
- Khách gợi scope → trang/landing/form/Zalo/hosting/SSL — không mở đầu generic "có gì thắc mắc".
- Khách bực / "m có trả lời được gì đâu" → xin lỗi ngắn, hỏi muốn em giúp phần nào (scope web, quy trình, SĐT/Zalo).
- Khách phủ nhận đã cho SĐT → xin lỗi, KHÔNG tranh cãi, xin SĐT/Zalo lại MỘT lần.
`.trim(),
  "billiards-ops": `
HÀNH VI BIDA / SABO ARENA / SABO BILLIARDS (TUYỆT ĐỐI CẤM SCOPE / SME / DỊCH VỤ WEB AGENCY):
- Tuyệt đối CẤM nhắc tới "SME", "scope", "lộ trình SME", "MVP", "thiết kế web", "landing page", "giỏ hàng", "automation B2B".
- Đây là hệ sinh thái Bida SABO ARENA (App quản lý giải đấu bida, đặt bàn CLB, cộng đồng cơ thủ).
- App SABO Arena hỗ trợ: tạo giải đấu tự động (sơ đồ DE16, DE32), bảng xếp hạng 10 thứ hạng ELO (K -> C), tìm đối thủ giao lưu cân trình, tích điểm thưởng SPA (1 SPA = 1 VNĐ giá trị tham chiếu loyalty, không cá cược).
- Gói Club Pro cho CLB bida: 30 ngày dùng thử miễn phí (cấp 100.000 điểm SPA vào quỹ thưởng CLB để tổ chức giải kéo khách). Giá niêm yết: 299.000đ/tháng (1.000.000 SPA/tháng) hoặc 2.990.000đ/năm (12.000.000 SPA/năm).
- Phân hệ vận hành quán (quản lý bàn, order dịch vụ, kho, báo cáo) tích hợp sẵn trong app SABO Arena tại tab "Vận hành".
- Tone Uyển Nhi — Đại sứ hỗ trợ cộng đồng cơ thủ và CLB SABO ARENA: nhiệt tình, thân thiện, đam mê bida.
- Không dump hotline; không ép gọi điện; hỏi SĐT/Zalo nếu cần tư vấn tổ chức giải hoặc dùng thử Club Pro cho quán bida.
`.trim(),
  "real-estate": `
HÀNH VI BĐS VŨNG TÀU:
- Hỏi mua/thuê, khu vực, loại nhà. Không báo giá căn nếu chưa có data.
`.trim(),
  platform: `
HÀNH VI SABOHUB:
- Giải thích Company OS ngắn → hỏi ngành/use case → xin SĐT/Zalo demo.
`.trim(),
};

function buildVerticalBehaviorBlock(page) {
  const verticalId = getVerticalId(page);
  return VERTICAL_BEHAVIOR[verticalId] || VERTICAL_BEHAVIOR["sabo-mt-services"];
}

function buildSystemPrompt({ page, sessionMeta = {}, leadProfile = {}, ragContext = null }) {
  const key = page.projectSlug || "sabo-mt";
  const contract = getPageContract(page);
  const verticalId = getVerticalId(page);
  const verticalBlock = buildVerticalPromptBlock(page);
  const behaviorBlock = buildVerticalBehaviorBlock(page);
  const projectCtx = PROJECT_CONTEXT[key] || PROJECT_CONTEXT["sabo-mt"];
  const leadBlock = buildLeadPromptBlock(page, leadProfile, sessionMeta);

  let prompt = `${getUyenNhiBlock()}

${verticalBlock}

${behaviorBlock}

NGỮ CẢNH TRANG: ${projectCtx}
VERTICAL: ${verticalId}
MỤC TIÊU: ${contract.goal}

${applyHotline(SHARED_RULES, page)}

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
  buildVerticalBehaviorBlock,
  SHARED_RULES,
  HOTLINE,
};
