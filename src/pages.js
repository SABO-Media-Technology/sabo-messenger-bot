/**
 * Page registry — Facebook Page ID → project config + access token.
 * SSoT aligned with empire: BRAND_CONTENT_MAP, seed-projects, social-channels.yaml
 */

const { BIDA_HOTLINE } = require("./hotline");

const PAGE_DEFINITIONS = [
  {
    id: "840807759121010",
    slug: "SABO_DESIGN",
    name: "SABO Design - Thiết Kế Logo Poster Giá Rẻ",
    tokenEnv: "PAGE_ACCESS_TOKEN_SABO_DESIGN",
    instagramId: "17841421361351034",
    instagramUsername: "__sabodesign",
    projectSlug: "sabo-mt",
    replyStrategy: "sabo-mt",
    tier: "t0",
    websiteUrl: "https://sabo.com.vn",
    hotline: "0798893333",
    ragTags: ["sabo", "design", "logo"],
  },
  {
    id: "827460493786896",
    slug: "SABO_WEB",
    name: "SABO Web - Thiết Kế Website Giá Tốt",
    tokenEnv: "PAGE_ACCESS_TOKEN_SABO_WEB",
    projectSlug: "sabo-mt",
    replyStrategy: "sabo-mt",
    tier: "t0",
    websiteUrl: "https://sabo.com.vn",
    hotline: "0798893333",
    ragTags: ["sabo", "website", "web"],
  },
  {
    id: "890435434143231",
    slug: "SABO_AGENCY",
    name: "SABO Agency",
    tokenEnv: "PAGE_ACCESS_TOKEN_SABO_AGENCY",
    projectSlug: "sabo-mt",
    replyStrategy: "sabo-mt",
    tier: "t0",
    websiteUrl: "https://sabo.com.vn",
    hotline: "0798893333",
    ragTags: ["sabo", "agency", "marketing"],
  },
  {
    id: "852828551244183",
    slug: "SABO_APP",
    name: "SABO APP - Thiết Kế App Chuyên Nghiệp",
    tokenEnv: "PAGE_ACCESS_TOKEN_SABO_APP",
    projectSlug: "sabo-mt",
    replyStrategy: "sabo-mt",
    tier: "t0",
    websiteUrl: "https://sabo.com.vn",
    hotline: "0798893333",
    ragTags: ["sabo", "app", "mobile"],
  },
  {
    id: "789401597597854",
    slug: "SABO_HUB",
    name: "SABO HUB",
    tokenEnv: "PAGE_ACCESS_TOKEN_SABO_HUB",
    projectSlug: "sabohub",
    replyStrategy: "rag-mini",
    tier: "t1",
    websiteUrl: "https://hub.sabo.com.vn",
    hotline: "0798893333",
    ragTags: ["sabohub", "sabo", "company os", "erp"],
  },
  {
    id: "618738001318577",
    slug: "AI_ART_NEWBIE",
    name: "AI Art Newbie",
    tokenEnv: "PAGE_ACCESS_TOKEN_AI_ART_NEWBIE",
    instagramId: "17841472996653110",
    instagramUsername: "lsfusionlab",
    projectSlug: "ai-art",
    replyStrategy: "rag-mini",
    tier: "t1",
    websiteUrl: "https://ainewbievn.shop",
    hotline: "0798893333",
    ragTags: ["ai art", "midjourney", "stable diffusion", "ainewbie"],
  },
  {
    id: "519070237965883",
    slug: "BDS_VUNGTAU",
    name: "BĐS VŨNG TÀU",
    tokenEnv: "PAGE_ACCESS_TOKEN_BDS_VUNGTAU",
    instagramId: "17841472735138532",
    instagramUsername: "thosan.hoanghon",
    projectSlug: "vungtau",
    replyStrategy: "rag-mini",
    tier: "t1",
    websiteUrl: "https://vungtauland.store",
    hotline: "0798893333",
    ragTags: ["bất động sản", "vũng tàu", "vungtau", "dream homes"],
  },
  {
    id: "569652129566651",
    slug: "APP_BILLIARDS",
    name: "App Quản lý Giải Đấu Billiards",
    tokenEnv: "PAGE_ACCESS_TOKEN_APP_BILLIARDS",
    instagramId: "17841472893889754",
    instagramUsername: "saboarenaapp",
    projectSlug: "sabo-arena",
    replyStrategy: "rag-mini",
    tier: "t0",
    websiteUrl: "https://saboarena.com",
    hotline: BIDA_HOTLINE, // bida page — hotline theo SSoT
    ragTags: ["billiards", "giải đấu", "sabo arena", "bida"],
  },
  {
    id: "719273174600166",
    slug: "SABO_ARENA_PAGE",
    name: "SABO ARENA",
    tokenEnv: "PAGE_ACCESS_TOKEN_SABO_ARENA",
    instagramId: "17841416019280177",
    instagramUsername: "saboarena",
    projectSlug: "sabo-arena",
    replyStrategy: "rag-mini",
    tier: "t0",
    websiteUrl: "https://saboarena.com",
    hotline: BIDA_HOTLINE,
    ragTags: ["sabo arena", "billiards", "giải đấu", "bida", "xếp hạng"],
  },
  {
    id: "981040798421726",
    slug: "UYEN_NHI_BIDA",
    name: "Uyển Nhi - Billiards",
    tokenEnv: "PAGE_ACCESS_TOKEN_UYEN_NHI_BIDA",
    instagramId: "17841459316312354",
    instagramUsername: "uyennhi03._",
    projectSlug: "sabo-arena",
    replyStrategy: "rag-mini",
    tier: "t0",
    websiteUrl: "https://saboarena.com",
    hotline: BIDA_HOTLINE,
    ragTags: ["uyển nhi", "billiards", "bida", "sabo arena"],
  },
  {
    id: "1284910878042165",
    slug: "TAM_SU_UYEN_NHI",
    name: "Tâm Sự Cùng Uyển Nhi",
    tokenEnv: "PAGE_ACCESS_TOKEN_TAM_SU_UYEN_NHI",
    projectSlug: "sabo-arena",
    replyStrategy: "rag-mini",
    tier: "t0",
    websiteUrl: "https://saboarena.com",
    hotline: BIDA_HOTLINE,
    ragTags: ["tâm sự cùng uyển nhi", "uyển nhi", "billiards"],
  },
  {
    id: "569671719553461",
    slug: "AI_NEWBIE_VN",
    name: "AI Newbie VN",
    tokenEnv: "PAGE_ACCESS_TOKEN_AI_NEWBIE_VN",
    instagramId: "17841474205608601",
    instagramUsername: "ainewbievn",
    projectSlug: "ainewbie",
    replyStrategy: "rag-mini",
    tier: "t1",
    websiteUrl: "https://ainewbievn.shop",
    hotline: "0798893333",
    ragTags: ["ai", "học ai", "ainewbie", "chatgpt"],
  },
  {
    id: "332950393234346",
    slug: "SABO_MEDIA",
    name: "SABO Media & Technology",
    tokenEnv: "PAGE_ACCESS_TOKEN_SABO_MEDIA",
    instagramId: "17841472718907470",
    instagramUsername: "sabomete",
    projectSlug: "sabo-mt",
    replyStrategy: "sabo-mt",
    tier: "t0",
    websiteUrl: "https://sabo.com.vn",
    hotline: "0798893333",
    ragTags: ["sabo", "media", "technology", "chuyển đổi số"],
  },
  {
    id: "118356497898536",
    slug: "SABO_BILLIARDS",
    name: "SABO Billiards - TP. Vũng Tàu",
    tokenEnv: "PAGE_ACCESS_TOKEN_SABO_BILLIARDS",
    instagramId: "17841474279844606",
    instagramUsername: "sabobilliard",
    projectSlug: "sabo-billiards",
    replyStrategy: "human-handoff",
    tier: "t2",
    websiteUrl: "https://sabobilliards.com",
    hotline: BIDA_HOTLINE, // bida page — hotline theo SSoT
    ragTags: ["billiards", "bida", "vũng tàu", "sabo billiards"],
  },
];

/** @type {Record<string, object>} */
const pageRegistry = {};

function loadPageRegistry() {
  for (const def of PAGE_DEFINITIONS) {
    const accessToken = process.env[def.tokenEnv] || null;
    const pageObj = { ...def, accessToken };
    pageRegistry[def.id] = pageObj;
    if (def.instagramId) {
      pageRegistry[def.instagramId] = {
        ...pageObj,
        isInstagram: true,
        parentPageId: def.id,
      };
    }
  }
  return pageRegistry;
}

function getPage(pageId) {
  return pageRegistry[pageId] || null;
}

function getAllPages() {
  return PAGE_DEFINITIONS.map((def) => pageRegistry[def.id] || def);
}

function getPagesWithToken() {
  return getAllPages().filter((p) => p.accessToken);
}

module.exports = {
  PAGE_DEFINITIONS,
  loadPageRegistry,
  getPage,
  getAllPages,
  getPagesWithToken,
  pageRegistry,
};
