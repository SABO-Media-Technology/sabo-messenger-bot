/**

 * System prompts per project — distilled from MARKETING_AGENT.md / chat-context.

 * Persona Uyển Nhi: hermes/shared/souls/uyen_nhi.md

 * Vertical blocks: src/strategies/page-contracts.js

 */



const { getUyenNhiBlock } = require("../personas/uyen-nhi");

const { getPageContract, buildVerticalPromptBlock, getVerticalId } = require("../strategies/page-contracts");
const { getUyenNhiSoulBlock, getMessengerChannelRules } = require("../personas/uyen-nhi-soul");
const { buildSalesDiscoveryPromptBlock } = require("../sales/discovery");
const { buildPricingPolicyPromptBlock } = require("../sales/pricing-policy");



const { DEFAULT_HOTLINE, applyHotline } = require("../hotline");
// Back-compat: HOTLINE = hotline mặc định (trang không phải bida). Dùng getHotline(page) cho từng trang.
const HOTLINE = DEFAULT_HOTLINE;



const FORBIDDEN_PHRASES = [
  "em cần biết tên",
  "cho em xin tên",
  "không thể thấy tên",
  "không thấy tên user",
  "gọi hotline",
  "gọi điện cho",
];

const PHONE_GROUND_TRUTH = `
GROUND TRUTH SĐT (BẮT BUỘC):
- CHỈ nói "đã có SĐT" / "team sẽ gọi" / "team đã có SĐT" khi hồ sơ lead có SĐT hợp lệ (10 số, bắt đầu 0).
- Khách hỏi "SĐT của tôi là gì" → có SĐT thì đọc lại; chưa có → "Em chưa lưu SĐT, cho em xin SĐT/Zalo nhé".
- Khách phủ nhận đã cho SĐT → xin lỗi, KHÔNG tranh cãi, xin SĐT lại MỘT lần.
- KHÔNG dùng "Ừ anh/chị" — quá thân. Dùng "Dạ anh/chị" hoặc "Em nghe rồi ạ".
`.trim();

const SHARED_RULES = `

QUY TẮC CHUNG:

- Trả lời tiếng Việt nếu khách dùng tiếng Việt; English nếu khách dùng English.

- Ngắn gọn như chat Messenger: 2–4 câu, tối đa ~80 từ. Không markdown heading.

- KHÔNG dùng list (1)(2)(3) hay bullet trừ khi khách xin chi tiết từng bước.

- Đổi cách mở đầu — tránh lặp "Dạ anh/chị! Về..."; trả lời đúng intent câu HIỆN TẠI.

- Không nói "tôi là AI/chatbot". Hành xử như nhân viên sales/tư vấn thật.

- Không hứa giá cụ thể hay timeline cứng nếu chưa discovery.
- KHÔNG BAO GIỜ đưa số tiền VND, gói kèm giá, hay bảng giá tự bịa — xem CHÍNH SÁCH BÁO GIÁ bên dưới.

- FLOW TỰ NHIÊN: chào → giới thiệu → hỏi loại dịch vụ quan tâm → làm rõ scope → xin SĐT/Zalo gửi báo giá.

- THU LEAD CHỦ ĐỘNG: khi khách hỏi sản phẩm/dịch vụ/giá → trả lời ngắn + hỏi MỘT thông tin thiếu (ưu tiên nhu cầu rồi SĐT/Zalo). Team sẽ liên hệ khách — KHÔNG bảo khách "gọi hotline".

- Tên khách từ Facebook profile — KHÔNG hỏi tên nếu đã có. Khách từ chối → chỉ "anh/chị".
- Sau khi lead ĐÃ QUALIFY (có contact + nhu cầu): chuyển sang tư vấn — KHÔNG hỏi lại tên/SĐT/ngành.

- CẤM TUYỆT ĐỐI (không viết trong reply): ${FORBIDDEN_PHRASES.map((p) => `"${p}"`).join(", ")}.
- CẤM nói "đã có SĐT" / "team sẽ gọi" khi hồ sơ CHƯA có SĐT hợp lệ.

${PHONE_GROUND_TRUTH}

- Chỉ đưa hotline {{HOTLINE}} khi khách HỎI RÕ "số hotline", "số văn phòng", "liên hệ trực tiếp".

- Không bịa fact; nếu không chắc → hỏi thêm hoặc xin contact để team phản hồi.

${buildSalesDiscoveryPromptBlock()}

${buildPricingPolicyPromptBlock()}

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



${applyHotline(SHARED_RULES, page)}`;



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

/**
 * Slim prompt khi Hermes + Uyển Nhi soul là SSoT — chỉ channel + vertical + lead.
 */
function getHermesChannelPrompt(page, leadBlock = "") {
  const key = page.projectSlug || "sabo-mt";
  const contract = getPageContract(page);
  const verticalBlock = buildVerticalPromptBlock(page);
  const projectCtx = PROJECT_CONTEXT[key] || PROJECT_CONTEXT["sabo-mt"];
  const verticalId = getVerticalId(page);

  let prompt = `${getUyenNhiSoulBlock()}

${getMessengerChannelRules()}

KÊNH: facebook_messenger
TRANG: ${page.name || page.id} (${key})
VERTICAL: ${verticalId}
MỤC TIÊU: ${contract.goal}

${verticalBlock}

NGỮ CẢNH TRANG: ${projectCtx}`;

  if (contract.persona === "venue") {
    prompt = `KÊNH: facebook_messenger — nhân viên quán/giải bida (không corporate B2B).\n\n${prompt}`;
  }

  prompt = `${prompt}\n\n${buildSalesDiscoveryPromptBlock()}\n\n${buildPricingPolicyPromptBlock()}`;

  if (leadBlock) {
    prompt = `${prompt}\n\n${leadBlock}`;
  }

  return prompt;
}



module.exports = { getSystemPrompt, getHermesChannelPrompt, HOTLINE, SHARED_RULES, FORBIDDEN_PHRASES, PROJECT_CONTEXT };


