/**
 * Extract lead entities from free-text Messenger messages.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?84|0)\d{8,10}/;

const NAME_PATTERNS = [
  /(?:tên (?:tôi|em|mình) (?:là|la))\s+([^\n,.!?]{2,40})/i,
  /(?:em|mình|tôi)\s+tên\s+(?:là\s+)?([^\n,.!?]{2,40})/i,
  /(?:em là|mình là|tôi là)\s+([^\n,.!?]{2,40})/i,
  /^([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){0,3})$/,
];

const SKIP_NAME = new Set([
  "xin chào",
  "chào",
  "hello",
  "hi",
  "ok",
  "oke",
  "vâng",
  "dạ",
  "có",
  "không",
]);

function extractPhone(text) {
  const m = (text || "").match(PHONE_RE);
  return m ? m[0] : null;
}

function extractEmail(text) {
  const m = (text || "").match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

function looksLikeConsultationQuestion(text) {
  const t = (text || "").trim();
  if (!t) return false;
  return /tư vấn|tư vấn sơ|giải thích|cho biết|không.*(tư vấn|nói|giải thích)|sao không|tại sao|là gì|như thế nào/i.test(
    t,
  );
}

function extractName(text) {
  const t = (text || "").trim();
  if (!t || t.length > 60) return null;
  if (looksLikeConsultationQuestion(t)) return null;
  if (/^(xin chào|chào|hello|hi|alo)\b/i.test(t)) return null;
  if (/\?/.test(t) && t.length > 12) return null;

  for (const re of NAME_PATTERNS) {
    const m = t.match(re);
    if (m?.[1]) {
      const name = m[1].trim();
      if (!SKIP_NAME.has(name.toLowerCase())) return name;
    }
  }

  if (t.length >= 2 && t.length <= 35 && !/\d/.test(t) && !/@/.test(t)) {
    const lower = t.toLowerCase();
    if (
      !SKIP_NAME.has(lower) &&
      !/^(tư vấn|báo giá|giá|website|app)$/i.test(t) &&
      !looksLikeNeed(t)
    ) {
      return t;
    }
  }
  return null;
}

function refusesName(text) {
  return /không (muốn|cho|nói|đưa).*tên|đừng hỏi tên|không xin tên|khỏi hỏi tên|tao không muốn cho/i.test(
    text || "",
  );
}

function extractZalo(text) {
  const t = (text || "").trim();
  const m = t.match(/zalo[:\s]*((?:\+?84|0)\d{8,10})/i);
  if (m?.[1]) return m[1];
  if (/^zalo$/i.test(t)) return null;
  return null;
}

function looksLikeNeed(text) {
  const lower = (text || "").toLowerCase();
  if (lower.length < 8) return false;
  const signals = [
    "cần",
    "muốn",
    "làm",
    "thiết kế",
    "website",
    "app",
    "automation",
    "tự động",
    "học ai",
    "chatgpt",
    "bđs",
    "mua",
    "thuê",
    "giải đấu",
    "billiard",
    "bida",
    "logo",
    "marketing",
    "chuyển đổi",
  ];
  return signals.some((s) => lower.includes(s));
}

function extractNeed(text, existingNeed) {
  if (existingNeed) return null;
  const t = (text || "").trim();
  if (looksLikeConsultationQuestion(t)) return null;
  if (looksLikeNeed(t) && t.length >= 6) {
    return t.slice(0, 300);
  }
  return null;
}

function extractBusinessType(text) {
  const lower = (text || "").toLowerCase();
  const types = [
    "retail",
    "f&b",
    "nhà hàng",
    "spa",
    "bất động sản",
    "bđs",
    "giáo dục",
    "agency",
    "dịch vụ",
    "sản xuất",
    "billiard",
    "bida",
    "công nghệ",
    "thương mại",
  ];
  if (types.some((t) => lower.includes(t))) return text.trim().slice(0, 120);
  return null;
}

function extractTimeline(text) {
  const lower = (text || "").toLowerCase();
  if (/gấp|urgent|asap|tuần này|tháng này|ngay/i.test(lower)) return text.trim().slice(0, 80);
  if (/đang tìm hiểu|chưa gấp|q[1-4]|năm sau/i.test(lower)) return text.trim().slice(0, 80);
  return null;
}

function extractBudget(text) {
  const lower = (text || "").toLowerCase();
  if (/ngân sách|budget|dưới \d|tr\+|\d+\s*tr/i.test(lower)) return text.trim().slice(0, 80);
  if (/chưa rõ|chưa biết/i.test(lower) && /ngân sách|budget|giá/i.test(lower)) {
    return text.trim().slice(0, 80);
  }
  return null;
}

/**
 * Merge extracted fields into profile (only fills empty slots).
 */
function mergeLeadProfile(profile, text) {
  const next = { ...profile };
  const phone = extractPhone(text);
  const email = extractEmail(text);
  const name = extractName(text);
  const zalo = extractZalo(text);

  if (phone && !next.phone) next.phone = phone;
  if (zalo && !next.phone) next.phone = zalo;
  if (email && !next.email) next.email = email;
  if (name && !next.name) next.name = name;

  const need = extractNeed(text, next.need);
  if (need) next.need = need;

  const businessType = extractBusinessType(text);
  if (businessType && !next.business_type) next.business_type = businessType;

  const timeline = extractTimeline(text);
  if (timeline && !next.timeline) next.timeline = timeline;

  const budget = extractBudget(text);
  if (budget && !next.budget) next.budget = budget;

  if (!next.need && text.trim().length >= 6 && looksLikeNeed(text) && !looksLikeConsultationQuestion(text)) {
    next.need = text.trim().slice(0, 300);
  }

  return next;
}

function hasContact(profile) {
  return Boolean(profile.phone || profile.email);
}

module.exports = {
  extractPhone,
  extractEmail,
  extractName,
  extractZalo,
  mergeLeadProfile,
  hasContact,
  looksLikeNeed,
  refusesName,
  looksLikeConsultationQuestion,
};
