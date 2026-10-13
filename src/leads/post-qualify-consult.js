/**

 * Post-qualify consultation helpers — contextual fallback when LLM unavailable.

 * Fallback only; primary path is Hermes/Groq/OpenAI via router.

 */



const { buildHonorificAddress } = require("../facebook/profile");
const { getPageContract, getVerticalId } = require("../strategies/page-contracts");

const {

  looksLikeConsultationQuestion,

  extractNeedUpdate,

  isNeedPivot,
  isChurnIntent,
  isPageCorrectionIntent,

} = require("./extract");

const { pickOpener, pickCloser, pickVariant, hashSeed } = require("../responses/variation");
const { isDiscoveryQuestion, buildDiscoveryReply } = require("../sales/discovery");
const { hasVerifiedPhone } = require("./extract");
const {
  isPricingQuestion,
  buildPricingHandoffReply,
  buildPricingPolicyPromptBlock,
} = require("../sales/pricing-policy");



const GREETING_RE = /^(xin chào|chào|hello|hi|hey|alo|dạ)\b/i;

const THANKS_RE = /cảm ơn|thank/i;

const SHORT_ACK_RE = /^(ok|oke|vâng|ừ|uh|uhm|được|hiểu rồi)\b/i;



function isCasualGreeting(text) {

  return GREETING_RE.test((text || "").trim());

}



function isThanksMessage(text) {

  return THANKS_RE.test(text || "");

}



function isShortAck(text) {

  return SHORT_ACK_RE.test((text || "").trim());

}



function messageRelatesToNeed(userText, need) {

  const text = (userText || "").trim().toLowerCase();

  if (!text || text.length < 8) return false;

  if (isCasualGreeting(text) || isShortAck(text) || isThanksMessage(text)) return false;

  if (isPricingQuestion(text) || looksLikeConsultationQuestion(text) || isNeedPivot(text)) {

    return true;

  }

  const needWords = String(need || "")

    .toLowerCase()

    .split(/\s+/)

    .filter((w) => w.length >= 4);

  return needWords.some((w) => text.includes(w));

}



function handoffLine(hasPhone) {
  if (hasPhone) return "Team SABO đã có SĐT — sẽ liên hệ báo sát hơn.";
  return "Cho em xin SĐT hoặc Zalo để team báo giá chi tiết nhé ạ.";
}

function messageMentionsApp(text) {
  return /app|mobile|ứng dụng/i.test(text || "");
}

function consultSnippet(need, seed = 0, userText = "", hasPhone = false, verticalId = "sabo-mt-services") {
  const n = (need || "").toLowerCase();
  const text = (userText || "").toLowerCase();

  if (verticalId === "billiards-ops") {
    const tips = [
      "Bên em có app SABO Arena hỗ trợ tạo giải đấu bida tự động (sơ đồ nhánh thắng nhánh thua DE16, DE32), bảng xếp hạng ELO và cấp quỹ thưởng SPA.",
      "CLB bida đăng ký dùng thử 30 ngày Club Pro được tặng ngay 100.000 điểm SPA vào quỹ thưởng để tổ chức giải kéo khách.",
      "App SABO Arena tích hợp sẵn quản lý bàn, order dịch vụ và kết nối cộng đồng cơ thủ giao lưu ELO cân trình.",
    ];
    return tips[seed % tips.length];
  }

  if (verticalId === "ai-education") {
    const tips = [
      "AI Newbie VN tập trung học AI cơ bản — ChatGPT, prompt, workflow và tạo ảnh AI cho người mới.",
      "Em hay gợi lộ trình: làm quen ChatGPT → prompt thực chiến → ứng dụng vào công việc hàng ngày.",
      "Anh/chị muốn học cho bản thân hay build cho team — em gợi chủ đề phù hợp trước ạ.",
    ];
    return tips[seed % tips.length];
  }

  if (/app|mobile|ứng dụng/i.test(n) && messageMentionsApp(text)) {

    const tips = [

      "App SME em hay gợi chốt vài tính năng lõi trước, pilot khoảng 4–8 tuần rồi mở rộng dần — Flutter + Supabase là combo hay dùng.",

      "Làm app thì scope nhỏ, chạy nhanh quan trọng hơn làm đủ tính năng ngay — anh/chị có thể bắt đầu từ luồng đặt hàng hoặc quản khách.",

      "Với app, em thường tư vấn khách pilot MVP trước, đo phản hồi thật rồi mới thêm module — đỡ tốn và dễ iterate.",

    ];

    return tips[seed % tips.length];

  }

  if (/website|web|trang|landing|bán hàng/i.test(n) && /web|trang|landing|bán hàng|website/i.test(text)) {

    const tips = [

      "Web bán hàng có thể đi landing + form/Zalo thu lead, hoặc full giỏ hàng + thanh toán — tùy mục tiêu doanh thu hay thu khách trước.",

      "Em hay gợi web SME bắt đầu từ trang giới thiệu + kênh liên hệ rõ, sau đó mới nâng giỏ hàng khi traffic ổn.",

      "Website thì scope trang, tích hợp thanh toán và quản đơn là 3 điểm ảnh hưởng giá và timeline nhất.",

    ];

    return tips[seed % tips.length];

  }

  const tips = [
    "Em có thể gợi scope và lộ trình phù hợp quy mô SME — ưu tiên bản chạy nhanh rồi iterate.",
    hasPhone
      ? "Tùy mục tiêu kinh doanh, em sẽ gợi hướng MVP hoặc gói vertical — team đã có SĐT để báo sát hơn."
      : "Tùy mục tiêu kinh doanh, em sẽ gợi hướng MVP hoặc gói vertical — cho em xin SĐT/Zalo để team báo sát nhé.",
  ];

  return tips[seed % tips.length];

}



function buildChurnReply(page, sessionMeta, userText = "") {
  const address = buildHonorificAddress(sessionMeta);
  const seed = hashSeed(`${sessionMeta?.profileName || ""}:${userText}:churn`);
  const verticalId = getVerticalId(page);

  if (verticalId === "ai-education") {
    const lines = [
      `Dạ em hiểu ${address} ạ. Cứ để đó — khi anh/chị muốn học AI hay cần tài liệu, nhắn em bất cứ lúc nào nhé. Chúc anh/chị một ngày tốt lành!`,
      `Dạ vâng ${address}! Em không làm phiền thêm. Khi nào anh/chị quan tâm khóa học AI, cứ nhắn em ạ.`,
    ];
    return lines[seed % lines.length];
  }

  const lines = [
    `Dạ em hiểu ${address} ạ. Cứ để đó — khi anh/chị cần tư vấn thêm, nhắn em bất cứ lúc nào nhé.`,
    `Dạ vâng ${address}! Em không làm phiền thêm. Chúc anh/chị một ngày tốt lành!`,
  ];
  return lines[seed % lines.length];
}

function buildPageCorrectionReply(page, sessionMeta, userText = "") {
  const address = buildHonorificAddress(sessionMeta);
  const seed = hashSeed(`${sessionMeta?.profileName || ""}:${userText}:page-correction`);
  const verticalId = getVerticalId(page);
  const contract = getPageContract(page);

  if (verticalId === "ai-education") {
    const lines = [
      `Dạ đúng rồi ${address}! AI Newbie VN tập trung học AI từ cơ bản — em hay gợi ChatGPT, prompt, workflow và tạo ảnh AI. Anh/chị muốn em gợi lộ trình học hay chủ đề nào trước ạ?`,
      `Dạ em xin lỗi nếu lúc nãy em lệch chủ đề ${address}. Đây là cộng đồng học AI — anh/chị đang muốn bắt đầu từ đâu (ChatGPT, ảnh AI, hay ứng dụng công việc) ạ?`,
    ];
    return lines[seed % lines.length];
  }

  return `${address}, em ghi nhận — em sẽ trả lời đúng theo ${contract.goal.split(".")[0].toLowerCase()}. Anh/chị muốn em hỗ trợ phần nào trước ạ?`;
}

function buildCasualReply(address, text, seed) {

  if (isThanksMessage(text)) {

    const lines = [

      `Dạ không có chi ${address}! Cần gì thêm cứ nhắn em nhé.`,

      `Dạ vâng ạ! Anh/chị hỏi thêm gì em hỗ trợ tiếp.`,

    ];

    return lines[seed % lines.length];

  }

  if (isCasualGreeting(text) || isShortAck(text)) {

    const lines = [

      `Chào ${address}! Em vẫn ở đây — anh/chị cần hỏi thêm gì cứ nhắn nhé.`,

      `Dạ chào ${address}! Em sẵn sàng tư vấn tiếp khi anh/chị cần ạ.`,

      `Chào ${address}! Có gì thắc mắc về dự án cứ hỏi em nhé.`,

    ];

    return lines[seed % lines.length];

  }

  return null;

}



/**

 * Contextual post-qualify fallback — varies by user message intent.

 */

function buildPostQualifyFallback(page, profile, sessionMeta, userText) {

  const address = buildHonorificAddress(sessionMeta);

  const need = (profile.need || "dự án").slice(0, 120);

  const text = (userText || "").trim();

  const seed = hashSeed(`${sessionMeta.profileName || ""}:${text}`);

  const hasPhone = hasVerifiedPhone(profile);
  const handoff = handoffLine(hasPhone);
  const verticalId = getVerticalId(page);

  if (isChurnIntent(text)) {
    return buildChurnReply(page, sessionMeta, text);
  }

  if (isPageCorrectionIntent(text)) {
    return buildPageCorrectionReply(page, sessionMeta, text);
  }

  const casual = buildCasualReply(address, text, seed);

  if (casual) return casual;

  if (isDiscoveryQuestion(text)) {
    return buildDiscoveryReply(page, sessionMeta, text);
  }

  const opener = pickOpener(address, seed);
  const closer =
    verticalId === "billiards-ops"
      ? pickVariant(
          [
            "Anh/chị đang cần hỗ trợ cho quán bida hay muốn tham gia giải đấu ạ?",
            "Anh/chị cần tư vấn tổ chức giải hay đặt bàn cứ nhắn em nhé!",
            "Có gì thắc mắc về app hay giải đấu anh/chị cứ hỏi em tiếp ạ.",
          ],
          seed + 1,
        )
      : pickCloser(seed + 1);



  if (isPricingQuestion(text)) {
    return buildPricingHandoffReply(page, profile, sessionMeta);
  }



  if (looksLikeConsultationQuestion(text) || /tư vấn|giải thích|như thế nào|là gì/i.test(text)) {

    const tip = consultSnippet(need, seed, text, hasPhone, verticalId);

    const consultPrompt =
      verticalId === "billiards-ops"
        ? "Anh/chị muốn tìm hiểu tính năng giải đấu hay gói dùng thử CLB ạ?"
        : "Anh/chị muốn em gợi scope cụ thể hơn không ạ?";

    const lines = hasPhone
      ? [
          `${opener} ${tip} ${handoff} Anh/chị cứ hỏi thêm em trả lời tiếp nhé!`,
          `${opener} ${tip} ${closer}`,
        ]
      : [
          `${opener} ${tip} ${handoff}`,
          `${opener} ${tip} ${consultPrompt}`,
        ];

    return lines[seed % lines.length];

  }



  if (isNeedPivot(text)) {

    const updated = extractNeedUpdate(text, need) || text.slice(0, 80);

    const tip = consultSnippet(updated, seed, text, hasPhone, verticalId);

    return hasPhone
      ? `${opener} Em ghi nhận anh/chị muốn đổi sang ${updated.slice(0, 80)}. ${tip} Team sẽ liên hệ qua SĐT đã lưu ạ!`
      : `${opener} Em ghi nhận anh/chị muốn đổi sang ${updated.slice(0, 80)}. ${tip} ${handoff}`;

  }



  const tip = consultSnippet(need, seed, text, hasPhone, verticalId);

  const relates = messageRelatesToNeed(text, need);

  const lines = relates

    ? [

        `${opener} Về "${need.slice(0, 60)}": ${tip} ${closer}`,

        `${opener} Em hiểu anh/chị đang quan tâm ${need.slice(0, 50)} — ${tip}`,

      ]

    : [

        `${opener} ${tip} ${closer}`,

        verticalId === "billiards-ops"
          ? `${opener} ${tip} Anh/chị muốn tìm hiểu tính năng giải đấu hay gói dùng thử CLB ạ?`
          : `${opener} ${tip} Anh/chị muốn em đi sâu giá, timeline hay tính năng ạ?`,

      ];

  return lines[seed % lines.length];

}



function buildPostQualifyPricingHint(hasPhone = true) {
  return buildPricingPolicyPromptBlock();
}



module.exports = {

  isPricingQuestion,

  isCasualGreeting,

  buildPostQualifyFallback,

  buildPostQualifyPricingHint,

  consultSnippet,

  buildChurnReply,

  buildPageCorrectionReply,

};


