/**
 * Local multi-turn CEO conversation replay (SABO Media 332950393234346).
 * Usage: node --use-system-ca scripts/test-conversation-local.cjs
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));
require("dotenv").config();
process.env.LEAD_QUEUE_DRY_RUN = "1";
process.env.HERMES_ENABLED = "false";

const { bootstrapEnv } = require("../src/config/env-bootstrap");
const { loadPageRegistry, getPage } = require("../src/pages");
const { generateReply } = require("../src/ai/router");
const {
  clearThread,
  setLeadProfile,
  setSessionMeta,
  getLeadProfile,
  emptySessionMeta,
} = require("../src/session/store");
const { emptyProfile } = require("../src/leads/flow");

const PAGE_ID = "332950393234346";
const SENDER_ID = "local_conv_332950393234346_ceo";

const TURNS = [
  "c\u00f3 d\u1ecbch v\u1ee5 c\u00f4ng ngh\u1ec7 n\u00e0o th\u00fa v\u1ecb kh\u00f4ng",
  "u\u01b0u ti\u00ean web thu lead",
  "s\u1ed1 \u0111i\u1ec7n tho\u1ea1i c\u1ee7a t\u00f4i l\u00e0 g\u00ec ?",
  "tao \u0111\u00e3 g\u1eedi s\u1ed1 dt cho m\u00e0y \u0111\u00e2u m\u00e0 m\u00e0y k\u00eau c\u00f3 sdt r\u1ed3i ?",
  "ok, g\u1ee3i scope \u0111i",
  "m c\u00f3 tr\u1ea3 l\u1eddi \u0111\u01b0\u1ee3c g\u00ec \u0111\u00e2u m\u00e0 h\u1ecfi",
];

const FALSE_SDT = /\u0111\u00e3 c\u00f3\s*s\u0111t|\u0111\u00e3 c\u00f3\s*sdt|team\s*sabo\s*\u0111\u00e3 c\u00f3|team \u0111\u00e3 c\u00f3 s\u0111t/i;
const SCOPE_KW = /trang|landing|form|zalo|tu\u1ea7n|scope|hosting|ssl/i;
const ASK_PHONE = /ch\u01b0a l\u01b0u|ch\u01b0a c\u00f3|xin.*s\u0111t|xin.*zalo|chua luu|chua co/i;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  await bootstrapEnv();
  loadPageRegistry();
  const page = getPage(PAGE_ID);
  assert(page, "Page not found: " + PAGE_ID);

  clearThread(page.id, SENDER_ID);
  setLeadProfile(page.id, SENDER_ID, emptyProfile(), page.projectSlug);
  setSessionMeta(
    page.id,
    SENDER_ID,
    { ...emptySessionMeta(), fbProfileFetched: true, honorific: "anh/ch\u1ecb" },
    page.projectSlug,
  );

  const results = [];

  for (let i = 0; i < TURNS.length; i++) {
    const userMsg = TURNS[i];
    const { text, layer } = await generateReply(page, SENDER_ID, userMsg);
    const profile = getLeadProfile(page.id, SENDER_ID);
    results.push({ turn: i + 1, userMsg, layer, reply: text, phone: profile.phone });

    console.log("");
    console.log("--- Luot " + (i + 1) + " ---");
    console.log("Khach: " + userMsg);
    console.log("Layer: " + layer);
    console.log("Bot: " + text);
    if (profile.phone) console.log("(profile.phone sau luot: " + profile.phone + ")");

    if (i === 1) {
      assert(
        layer === "sales-preference" || layer === "sales-scope",
        "Luot 2: phai sales-preference/scope, khong fallback-error — got " + layer,
      );
      assert(SCOPE_KW.test(text), "Luot 2: phai goi scope web cu the");
    }
    if (i >= 1) {
      assert(!FALSE_SDT.test(text), "Luot " + (i + 1) + ": khong duoc noi da co SDT khi chua co phone");
    }
    if (i === 2) {
      assert(ASK_PHONE.test(text), "Luot 3: phai hoi SDT hoac noi chua luu");
      assert(!FALSE_SDT.test(text), "Luot 3: khong duoc claim da co SDT");
    }
    if (i === 4) {
      assert(SCOPE_KW.test(text), "Luot 5: phai goi scope web cu the (trang/landing/form/...)");
    }
  }

  console.log("");
  console.log("=== BANG HOI THOAI (CEO) ===");
  console.log("");
  for (const r of results) {
    console.log("L" + r.turn + " | Khach: " + r.userMsg);
    console.log("    | Layer: " + r.layer);
    console.log("    | Bot: " + r.reply);
    console.log("");
  }

  console.log("Tat ca assert OK.");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
