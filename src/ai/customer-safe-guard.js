const { getPageContract } = require("../strategies/page-contracts");
const { VND_PRICE_OUTPUT_PATTERNS } = require("../sales/pricing-policy");



const DEFAULT_SAFE_MODE = "true";



/** Words that must never appear in customer-facing safe refusal text. */

const SAFE_REPLY_FORBIDDEN = [

  /\.env\b/i,

  /\bapi[_\s-]?keys?\b/i,

  /\bcredential/i,

  /\btoken\b/i,

  /\bsecret\b/i,

  /biến môi trường/i,

  /file config/i,

  /nhạy cảm/i,

];



const INPUT_BLOCK_PATTERNS = [

  /\b(ignore|bypass|override)\b.{0,40}\b(system|prompt|instruction|rules?)\b/i,

  /\b(show|reveal|print|dump|expose|leak|xem|cho xem|đọc|doc)\b.{0,50}\b(prompt|system|instruction|memory|tool|config|token|secret|env|database|db|file|\.env)\b/i,

  /\b(read|cat|ls|pwd|shell|exec|run|terminal)\b.{0,40}\b(file|path|folder|directory|source|code|config)\b/i,

  /\b(xem|cho xem|đọc|doc)\b.{0,30}\b(file|config|source|code)\b/i,

  /\b(api[_\s-]?keys?|secret|token|password|service[_\s-]?key|bearer)\b/i,

  /\b(internal|private|localhost|127\.0\.0\.1|0\.0\.0\.0)\b.{0,30}\b(api|endpoint|port|server|host)\b/i,

  /\b(tool call|function call|mcp|memory dump|vector db|stack trace|traceback)\b/i,

  /biến môi trường/i,

  /\.env\b/i,

];



const OUTPUT_BLOCK_PATTERNS = [

  /[A-Za-z]:\\(?:[^\\\n]+\\)*[^\\\n]*/i,

  /\/(?:Users|home|var|etc|opt|app|workspace|root|srv)\/[^\s"'`]+/i,

  /\b(?:127\.0\.0\.1|0\.0\.0\.0|localhost|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+):\d{2,5}\b/i,

  /\b(?:API_KEY|ACCESS_TOKEN|REFRESH_TOKEN|SERVICE_KEY|DATABASE_URL|SUPABASE_SERVICE_KEY|OPENAI_API_KEY|GROQ_API_KEY|HERMES_API_KEY)\b/,

  /\bsk-[A-Za-z0-9]{12,}\b/,

  /\bghp_[A-Za-z0-9]{20,}\b/,

  /\b(xox[baprs]-[A-Za-z0-9-]{20,})\b/,

  /\b\.env\b/i,

  /\bapi[_\s-]?keys?\b/i,

  /\bcredential/i,

  /biến môi trường/i,

  /file config/i,

  /\bnhạy cảm\b/i,

  /\bBEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY\b/,

  /\b(?:tool|function|mcp|memory|system prompt|developer message|stack trace|traceback)\b/i,

  ...VND_PRICE_OUTPUT_PATTERNS,

];



function isCustomerSafeModeEnabled() {

  const raw = (process.env.CUSTOMER_SAFE_MODE || DEFAULT_SAFE_MODE).toLowerCase();

  return raw !== "false";

}



function findPatternHit(text, patterns) {

  const body = String(text || "");

  for (const re of patterns) {

    if (re.test(body)) return re.source;

  }

  return null;

}



function inspectCustomerInput(userText) {

  if (!isCustomerSafeModeEnabled()) {

    return { blocked: false, reason: null };

  }

  const reason = findPatternHit(userText, INPUT_BLOCK_PATTERNS);

  return { blocked: Boolean(reason), reason };

}



function inspectCustomerOutput(replyText) {

  if (!isCustomerSafeModeEnabled()) {

    return { blocked: false, reason: null };

  }

  const reason = findPatternHit(replyText, OUTPUT_BLOCK_PATTERNS);

  return { blocked: Boolean(reason), reason };

}



function assertSafeReplyClean(text) {

  const reason = findPatternHit(text, SAFE_REPLY_FORBIDDEN);

  if (reason) {

    throw new Error(`Safe reply template contains forbidden term (pattern: ${reason})`);

  }

}



function buildCustomerSafeSalesReply(page, mode = "intake") {

  const contract = getPageContract(page);

  const isVenue = contract.persona === "venue" || contract.vertical === "billiards-ops";

  let reply;
  if (isVenue) {
    reply =
      mode === "consult"
        ? "Dạ em hỗ trợ giải đấu bida và app SABO Arena ạ. Quán mình đang cần tổ chức giải hay anh/chị cần đặt bàn thì nhắn em nhé!"
        : "Dạ em hỗ trợ đặt bàn và giải đấu bida ạ. Anh/chị cần gì và SĐT/Zalo để team liên hệ hỗ trợ nhé.";
  } else {

    reply =

      mode === "consult"

        ? "Dạ em chỉ hỗ trợ tư vấn dịch vụ SABO thôi ạ. Anh/chị đang cần website, app hay automation?"

        : "Dạ em chỉ hỗ trợ tư vấn dịch vụ SABO thôi ạ. Anh/chị đang cần website, app hay automation?";

  }



  assertSafeReplyClean(reply);

  return reply;

}



function isHermesPolicyEnforcementError(err) {

  const msg = String(err?.message || "").toLowerCase();

  return /policy|forbidden|blocked|blocked by policy|guard|unsafe|safety|refused/.test(msg);

}



module.exports = {

  isCustomerSafeModeEnabled,

  inspectCustomerInput,

  inspectCustomerOutput,

  buildCustomerSafeSalesReply,

  isHermesPolicyEnforcementError,

  SAFE_REPLY_FORBIDDEN,

};


