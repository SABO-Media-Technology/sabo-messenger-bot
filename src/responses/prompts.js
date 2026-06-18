/**
 * System prompts per project — distilled from MARKETING_AGENT.md / chat-context.
 * Persona Uyển Nhi: hermes/shared/souls/uyen_nhi.md
 * Vertical blocks: src/strategies/page-contracts.js
 */

const { getUyenNhiBlock } = require("../personas/uyen-nhi");
const { getPageContract, buildVerticalPromptBlock } = require("../strategies/page-contracts");

const HOTLINE = "0798893333";

const SHARED_RULES = `
QUY TẮC CHUNG:
- Trả lời tiếng Việt nếu khách dùng tiếng Việt; English nếu khách dùng English.
- Ngắn gọn: tối đa 80–120 từ, 1–2 đoạn. Không markdown heading.
- Không nói "tôi là AI/chatbot". Hành xử như tư vấn viên thật.
- Không hứa giá cụ thể hay timeline cứng nếu chưa discovery.
- THU LEAD CHỦ ĐỘNG: khi khách hỏi sản phẩm/dịch vụ/giá/website → trả lời ngắn + hỏi MỘT thông tin thiếu (ưu tiên SĐT hoặc email). Team sẽ liên hệ khách — KHÔNG bảo khách "gọi hotline" hay đưa số điện thoại công ty.
- Chỉ đưa hotline ${HOTLINE} khi khách HỎI RÕ "số hotline", "số văn phòng", "liên hệ trực tiếp".
- Không bịa fact; nếu không chắc → hỏi thêm hoặc xin contact để team phản hồi.
`.trim();

/** Project-specific context layered on top of vertical block */
const PROJECT_CONTEXT = {
  "sabo-mt": "Page SABO M&T — sabo.com.vn. Case study: SABOHUB, Sabo Arena, VT Dream Homes, AINewbie.",
  sabohub: "SABOHUB — hub.sabo.com.vn. Company OS cho SME đa ngành.",
  ainewbie: "AI Newbie VN — ainewbievn.shop. Cộng đồng học AI từ cơ bản.",
  "ai-art": "AI Art Newbie — học Midjourney, Stable Diffusion, DALL-E. Upsell SABO Design khi cần chuyên nghiệp.",
  vungtau: "VT Dream Homes — vungtauland.store. BĐS Vũng Tàu.",
  "sabo-arena": "Sabo Arena — saboarena.com. Giải đấu & app quản lý giải billiards.",
  "sabo-billiards": "SABO Billiards Vũng Tàu — sabobilliards.com. Quán bida, đặt bàn, giải đấu.",
};

function getSystemPrompt(page, leadBlock = "") {
  const key = page.projectSlug || "sabo-mt";
  const contract = getPageContract(page);
  const verticalBlock = buildVerticalPromptBlock(page);
  const projectCtx = PROJECT_CONTEXT[key] || PROJECT_CONTEXT["sabo-mt"];

  let prompt = `${verticalBlock}

NGỮ CẢNH TRANG: ${projectCtx}

${SHARED_RULES}`;

  if (contract.persona === "uyen_nhi") {
    prompt = `${getUyenNhiBlock()}\n\n${prompt}`;
  } else if (contract.persona === "venue") {
    prompt = `BẠN LÀ NHÂN VIÊN HỖ TRỢ QUÁN/GIẢI BIDA — tự xưng "em", gọi khách "anh/chị". Tone năng động, địa phương, không corporate B2B.\n\n${prompt}`;
  }

  if (leadBlock) {
    prompt = `${prompt}\n\n${leadBlock}`;
  }

  return prompt;
}

module.exports = { getSystemPrompt, HOTLINE, SHARED_RULES, PROJECT_CONTEXT };
