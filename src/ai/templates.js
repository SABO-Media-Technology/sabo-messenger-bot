const { HOTLINE } = require("../responses/prompts");

const { pickVariant, hashSeed } = require("../responses/variation");
const { getVerticalId, getPageContract } = require("../strategies/page-contracts");
const { isPostQualify } = require("../leads/flow");



/** Shared rules — hotline only when explicitly asked */

const HOTLINE_RULE = {

  patterns: [/hotline|số hotline|số điện thoại.*(công ty|sabo|văn phòng|quán)|liên hệ trực tiếp|gọi.*(sabo|văn phòng)/i],

  reply: (page) =>

    `Hotline: ${page.hotline || HOTLINE}. Anh/chị cũng có thể để lại SĐT/email ở đây — team sẽ gọi lại sớm nhất nhé!`,

};



const THANKS_RULE = {

  patterns: [/cảm ơn|thank|thanks/i],

  reply: (_page, userText) =>
    pickVariant(
      [
        `Dạ không có chi! Anh/chị cần hỗ trợ thêm cứ nhắn em nhé.`,
        `Dạ vâng ạ! Có gì thắc mắc cứ hỏi em tiếp nhé.`,
        `Không có gì ạ! Anh/chị nhắn em bất cứ lúc nào.`,
      ],
      hashSeed(userText || "thanks"),
    ),

};



/**

 * Layer 0 templates keyed by vertical — not one global script.

 * @type {Record<string, Array<{ patterns: RegExp[], reply: (page: object) => string }>>}

 */

const VERTICAL_TEMPLATES = {

  "sabo-mt-services": [

    HOTLINE_RULE,

    {

      patterns: [/ngân sách|budget|\d+\s*k\b|\d+\s*tr\b/i],

      reply: () =>

        `Với ngân sách đó em có thể gợi ý scope phù hợp — anh/chị cần loại dịch vụ nào (website, landing, automation)? Cho em xin SĐT hoặc Zalo để em gửi báo giá chi tiết nhé ạ?`,

    },

    {

      patterns: [/giá|bao nhiêu|price|cost|báo giá|quote/i],

      reply: () =>

        `Giá phụ thuộc scope và nhu cầu cụ thể của anh/chị. Anh/chị đang cần loại dịch vụ nào (website, app, thiết kế, automation)? Em làm rõ để báo giá sát hơn ạ.`,

    },

    {

      patterns: [/sản phẩm|dịch vụ|bán gì|làm gì|offer|service/i],

      reply: () =>

        `SABO hỗ trợ thiết kế, website, app, marketing và chuyển đổi số cho SME. Anh/chị đang quan tâm dịch vụ nào để em tư vấn chi tiết ạ?`,

    },

    {

      patterns: [/địa chỉ|address|ở đâu/i],

      reply: () =>

        `SABO Media & Technology — Vũng Tàu, Việt Nam. Anh/chị cần hẹn gặp trực tiếp hay tư vấn online? Cho em xin SĐT hoặc email để team sắp xếp nhé.`,

    },

    THANKS_RULE,

  ],

  "billiards-ops": [

    HOTLINE_RULE,

    {

      patterns: [/giá|bao nhiêu|price|giờ|mở cửa|địa chỉ|ở đâu/i],

      reply: (page) => {

        const isArena = page.projectSlug === "sabo-arena";

        if (isArena) {

          return `Em hỗ trợ thông tin giải đấu và app Sabo Arena. Chi tiết giờ/giá em xin SĐT để team gọi lại chính xác nhé?`;

        }

        return `Em ghi nhận rồi ạ. Cho em xin SĐT và anh/chị muốn đặt bàn hay hỏi giải đấu để team SABO Billiards phản hồi chi tiết nhé?`;

      },

    },

    {

      patterns: [/đặt bàn|book|bàn bida|giải đấu|giải|tournament|đăng ký giải/i],

      reply: () =>

        `Dạ em hỗ trợ đặt bàn và đăng ký giải. Anh/chị muốn đặt bàn hay tham gia giải ạ? Cho em xin SĐT hoặc Zalo để team xác nhận nhé?`,

    },

    THANKS_RULE,

  ],

  "ai-education": [

    HOTLINE_RULE,

    {

      patterns: [/giá|bao nhiêu|price|cost|báo giá/i],

      reply: () =>

        `Nội dung học AI cơ bản em hướng dẫn miễn phí qua cộng đồng. Nếu anh/chị cần dự án doanh nghiệp (web/app/automation), em xin SĐT hoặc email để team SABO tư vấn nhé?`,

    },

    {

      patterns: [/sản phẩm|dịch vụ|bán gì|làm gì|offer|service/i],

      reply: () =>

        `Ngoài học AI, SABO M&T hỗ trợ doanh nghiệp: website, app, automation, thiết kế. Anh/chị quan tâm phần nào? Nếu cần báo giá chi tiết, cho em xin SĐT hoặc Zalo nhé ạ?`,

    },

    {

      patterns: [/học|chatgpt|prompt|midjourney|stable diffusion|ai art/i],

      reply: () =>

        `Em có thể gợi ý lộ trình học AI phù hợp người mới. Anh/chị đang muốn học cho công việc hay cá nhân ạ?`,

    },

    THANKS_RULE,

  ],

  "real-estate": [

    HOTLINE_RULE,

    {

      patterns: [/giá|bao nhiêu|price|cost|báo giá/i],

      reply: () =>

        `Giá từng căn phụ thuộc vị trí và diện tích. Anh/chị cho em xin khu vực mong muốn và SĐT để môi giới tư vấn chi tiết nhé?`,

    },

    {

      patterns: [/mua|thuê|bất động|nhà|đất|căn hộ|vũng tàu/i],

      reply: () =>

        `Em hỗ trợ BĐS Vũng Tàu (mua/thuê). Anh/chị quan tâm khu nào và ngân sách khoảng bao nhiêu? Cho em xin SĐT liên hệ nhé?`,

    },

    THANKS_RULE,

  ],

  platform: [

    HOTLINE_RULE,

    {

      patterns: [/giá|bao nhiêu|price|cost|báo giá/i],

      reply: () =>

        `Gói SABOHUB phụ thuộc ngành và quy mô. Em xin ngành kinh doanh và SĐT/email để team demo phù hợp nhé?`,

    },

    {

      patterns: [/sabo\s*hub|demo|trial|dùng thử|pilot/i],

      reply: () =>

        `SABOHUB là Company OS quản lý doanh nghiệp + hiện trường. Anh/chị cho em xin tên, ngành kinh doanh và SĐT để đặt demo nhé?`,

    },

    {

      patterns: [/sản phẩm|dịch vụ|làm gì|tính năng/i],

      reply: () =>

        `SABOHUB giúp quản lý vận hành, nhân sự, đơn hàng theo vertical template. Anh/chị đang kinh doanh ngành gì? Cho em xin SĐT hoặc email demo nhé?`,

    },

    THANKS_RULE,

  ],

};



const DEFAULT_TEMPLATES = VERTICAL_TEMPLATES["sabo-mt-services"];



/**
 * Layer 0 — instant template match (no LLM), vertical-aware.
 * Skips intake templates when lead already qualified (post-consultation mode).
 */
function matchTemplate(userText, page, ctx = {}) {
  const text = (userText || "").trim();
  if (!text) return null;

  const profile = ctx.profile || {};
  const sessionMeta = ctx.sessionMeta || {};
  const contract = getPageContract(page);
  const postQualify = ctx.postQualify ?? isPostQualify(profile, contract, sessionMeta);

  const verticalId = getVerticalId(page);
  const rules = VERTICAL_TEMPLATES[verticalId] || DEFAULT_TEMPLATES;

  for (const rule of rules) {
    if (!rule.patterns.some((re) => re.test(text))) continue;

    // After qualify: only hotline/thanks templates — let LLM handle consultation
    if (postQualify && rule !== HOTLINE_RULE && rule !== THANKS_RULE) {
      continue;
    }

    return rule.reply(page, text);
  }
  return null;
}



module.exports = { matchTemplate, VERTICAL_TEMPLATES, HOTLINE_RULE };


