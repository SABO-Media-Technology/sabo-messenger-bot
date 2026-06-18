/**

 * Post-qualify consultation helpers — contextual fallback when LLM unavailable.

 * Fallback only; primary path is Hermes/Groq/OpenAI via router.

 */



const { buildHonorificAddress } = require("../facebook/profile");

const {

  looksLikeConsultationQuestion,

  extractNeedUpdate,

  isNeedPivot,

} = require("./extract");

const { pickOpener, pickCloser, hashSeed } = require("../responses/variation");
const { isDiscoveryQuestion, buildDiscoveryReply } = require("../sales/discovery");
const { hasVerifiedPhone } = require("./extract");



const PRICING_RE = /giá|bao nhiêu|price|cost|báo giá|quote|ngân sách|budget|\d+\s*tr\b/i;



const GREETING_RE = /^(xin chào|chào|hello|hi|hey|alo|dạ)\b/i;

const THANKS_RE = /cảm ơn|thank/i;

const SHORT_ACK_RE = /^(ok|oke|vâng|ừ|uh|uhm|được|hiểu rồi)\b/i;



function isPricingQuestion(text) {

  return PRICING_RE.test(text || "");

}



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



function pricingBallpark(need) {

  const n = (need || "").toLowerCase();

  if (/app|mobile|ứng dụng/i.test(n)) {

    return "app SME thường từ ~150tr (standalone) hoặc gói vertical 10–30tr setup + 3–10tr/tháng tùy module";

  }

  if (/website|web|trang|landing|bán hàng/i.test(n)) {

    return "website/landing thường 15–50tr tùy số trang, giỏ hàng, tích hợp thanh toán";

  }

  if (/automation|tự động|ai/i.test(n)) {

    return "automation/AI workflow báo theo số quy trình và tích hợp — thường từ vài chục triệu";

  }

  return "dự án chuyển đổi số SME thường 50–150tr (build) hoặc subscription vertical 10–30tr setup";

}



function handoffLine(hasPhone) {
  if (hasPhone) return "Team SABO đã có SĐT — sẽ liên hệ báo sát hơn.";
  return "Cho em xin SĐT hoặc Zalo để team báo giá chi tiết nhé ạ.";
}

function messageMentionsApp(text) {
  return /app|mobile|ứng dụng/i.test(text || "");
}

function consultSnippet(need, seed = 0, userText = "", hasPhone = false) {

  const n = (need || "").toLowerCase();
  const text = (userText || "").toLowerCase();

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



  const casual = buildCasualReply(address, text, seed);

  if (casual) return casual;

  if (isDiscoveryQuestion(text)) {
    return buildDiscoveryReply(page, sessionMeta, text);
  }

  const opener = pickOpener(address, seed);

  const closer = pickCloser(seed + 1);



  if (isPricingQuestion(text)) {

    const ballpark = pricingBallpark(need);

    const lines = hasPhone
      ? [
          `${opener} Giá ${need} phụ thuộc scope cụ thể — ${ballpark}. Team đã có SĐT, sẽ gọi báo sát sau vài câu hỏi ngắn. ${closer}`,
          `${opener} Về giá thì ${ballpark} — còn tùy tính năng và tích hợp nữa. Em note SĐT anh/chị rồi, team báo chi tiết qua call nhé.`,
        ]
      : [
          `${opener} Giá ${need} phụ thuộc scope cụ thể — ${ballpark}. Cho em xin SĐT/Zalo để team báo sát nhé ạ.`,
          `${opener} Về giá thì ${ballpark} — còn tùy tính năng và tích hợp. ${handoff}`,
        ];

    return lines[seed % lines.length];

  }



  if (looksLikeConsultationQuestion(text) || /tư vấn|giải thích|như thế nào|là gì/i.test(text)) {

    const tip = consultSnippet(need, seed, text, hasPhone);

    const lines = hasPhone
      ? [
          `${opener} ${tip} ${handoff} Anh/chị cứ hỏi thêm em trả lời tiếp nhé!`,
          `${opener} ${tip} ${closer}`,
        ]
      : [
          `${opener} ${tip} ${handoff}`,
          `${opener} ${tip} Anh/chị muốn em gợi scope cụ thể hơn không ạ?`,
        ];

    return lines[seed % lines.length];

  }



  if (isNeedPivot(text)) {

    const updated = extractNeedUpdate(text, need) || text.slice(0, 80);

    const tip = consultSnippet(updated, seed, text, hasPhone);

    return hasPhone
      ? `${opener} Em ghi nhận anh/chị muốn đổi sang ${updated.slice(0, 80)}. ${tip} Team sẽ cập nhật hồ sơ và liên hệ báo giá qua SĐT đã lưu ạ!`
      : `${opener} Em ghi nhận anh/chị muốn đổi sang ${updated.slice(0, 80)}. ${tip} ${handoff}`;

  }



  const tip = consultSnippet(need, seed, text, hasPhone);

  const relates = messageRelatesToNeed(text, need);

  const lines = relates

    ? [

        `${opener} Về "${need.slice(0, 60)}": ${tip} ${closer}`,

        `${opener} Em hiểu anh/chị đang quan tâm ${need.slice(0, 50)} — ${tip}`,

      ]

    : [

        `${opener} ${tip} ${closer}`,

        `${opener} ${tip} Anh/chị muốn em đi sâu giá, timeline hay tính năng ạ?`,

      ];

  return lines[seed % lines.length];

}



function buildPostQualifyPricingHint(hasPhone = true) {

  const contactKet = hasPhone
    ? "- Kết: team đã có SĐT → báo sát sau call ngắn, nhưng vẫn cho khách cảm giác được tư vấn ngay."
    : "- Kết: CHƯA có SĐT → xin SĐT/Zalo, KHÔNG nói team sẽ gọi.";

  return `

BÁO GIÁ SAU QUALIFY (khi khách hỏi giá):

- Đưa ballpark + yếu tố ảnh hưởng giá — KHÔNG chỉ nói "team sẽ gọi".

- Website/landing: ~15–50tr tùy trang, giỏ hàng, thanh toán.

- App SME standalone: ~150tr+; vertical subscription: setup 10–30tr + 3–10tr/tháng.

- Build pioneer dự án: ~50–150tr tùy scope.

- Viết như chat Messenger: 2–4 câu tự nhiên, KHÔNG list (1)(2)(3) trừ khi khách xin breakdown chi tiết.

${contactKet}`.trim();

}



module.exports = {

  isPricingQuestion,

  isCasualGreeting,

  buildPostQualifyFallback,

  buildPostQualifyPricingHint,

  pricingBallpark,

  consultSnippet,

};


