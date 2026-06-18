/**
 * Extract lead entities from free-text Messenger messages.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?84|0)\d{9,10}\b/;

/** VN mobile/landline — 10 digits starting with 0, or +84 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  const raw = phone.trim();
  if (/^\+?84\d{9}$/.test(raw.replace(/\s/g, ""))) return true;
  return /^0\d{9}$/.test(raw.replace(/\s/g, ""));
}

function normalizePhone(phone) {
  if (!phone) return null;
  const raw = phone.trim().replace(/\s/g, "");
  if (!isValidPhone(raw)) return null;
  if (raw.startsWith("+84")) return `0${raw.slice(3)}`;
  if (raw.startsWith("84") && raw.length === 11) return `0${raw.slice(2)}`;
  return raw;
}

const ASK_OWN_PHONE_RE =
  /số\s*(điện\s*thoại|dt|phone).*(của\s*(tôi|em|mình)|tôi|em|mình)\s*(là\s*)?(gì|bao nhiêu|đâu)|(?:tôi|em|mình)\s*(đã\s*)?(cho|gửi|đưa).*(số|sdt|zalo).*(chưa|đâu|gì)/i;

const DENY_PHONE_RE =
  /(?:tao|tôi|em|mình)\s*(đã\s*)?(gửi|cho|đưa|nói).*(số|sdt|zalo|điện\s*thoại).*(đâu|chưa|gì)|chưa\s*(cho|gửi|đưa).*(số|sdt)|(?:mày|bạn|em)\s*(có|lưu|biết).*(số|sdt).*(đâu|gì)|(?:sao|tại sao).*(nói|bảo).*(đã\s*có|đã\s*lưu).*(số|sdt)/i;

const FRUSTRATION_RE =
  /(?:m\s*|mày|bạn)\s*(có\s*)?trả lời\s*(được\s*)?(gì|không)|vô dụng|không\s*hiểu\s*gì|nói\s*hoài|lặp\s*hoài|chán\s*quá/i;

function asksForOwnPhone(text) {
  return ASK_OWN_PHONE_RE.test(text || "");
}

function deniesGivingPhone(text) {
  return DENY_PHONE_RE.test(text || "");
}

function isFrustration(text) {
  return FRUSTRATION_RE.test(text || "");
}

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
  if (!m) return null;
  return normalizePhone(m[0]);
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

function looksLikeNeedSignal(text) {
  const lower = (text || "").toLowerCase();
  return ["cần", "muốn", "làm", "app", "website", "web", "thiết kế", "automation"].some((s) =>
    lower.includes(s),
  );
}

const NEED_PIVOT_RE =
  /giờ|thay vì|chuyển sang|đổi sang|lại thích|muốn làm|thích làm|không làm.*nữa|bỏ.*làm/i;

function isNeedPivot(text) {
  const t = (text || "").trim();
  if (!t) return false;
  return NEED_PIVOT_RE.test(t) || (/app|website|web|trang|landing/i.test(t) && t.length >= 8);
}

function extractNeedUpdate(text, existingNeed) {
  if (!existingNeed) return null;
  const t = (text || "").trim();
  if (!t || t.length < 6) return null;
  if (looksLikeConsultationQuestion(t) && !isNeedPivot(t)) return null;

  if (isNeedPivot(t) || (looksLikeNeedSignal(t) && !PRICING_RE.test(t))) {
    if (/app|ứng dụng|mobile/i.test(t)) return t.slice(0, 300);
    if (/website|web|trang|landing|bán hàng/i.test(t)) return t.slice(0, 300);
    if (NEED_PIVOT_RE.test(t)) return t.slice(0, 300);
  }
  return null;
}

const PRICING_RE = /giá|bao nhiêu|price|cost|báo giá|quote|ngân sách|budget|\d+\s*tr\b/i;

function extractNeed(text, existingNeed) {
  const pivot = extractNeedUpdate(text, existingNeed);
  if (pivot) return pivot;
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
  if (zalo && !next.phone) next.phone = normalizePhone(zalo);
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
  if (profile.phone && isValidPhone(profile.phone)) return true;
  return Boolean(profile.email);
}

function hasVerifiedPhone(profile) {
  return Boolean(profile?.phone && isValidPhone(profile.phone));
}

function clearFalsePhone(profile) {
  if (!profile?.phone) return profile;
  if (isValidPhone(profile.phone)) return profile;
  return { ...profile, phone: null, qualified: false, queued: false };
}

function maskPhone(phone) {
  if (!phone || phone.length < 6) return phone;
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

module.exports = {
  extractPhone,
  extractEmail,
  extractName,
  extractZalo,
  mergeLeadProfile,
  hasContact,
  hasVerifiedPhone,
  isValidPhone,
  normalizePhone,
  asksForOwnPhone,
  deniesGivingPhone,
  isFrustration,
  clearFalsePhone,
  maskPhone,
  looksLikeNeed,
  refusesName,
  looksLikeConsultationQuestion,
  extractNeedUpdate,
  isNeedPivot,
};
