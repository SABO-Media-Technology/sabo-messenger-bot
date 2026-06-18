/**
 * E2E Meta setup: app webhook + subscribe 11 pages + /setup + simulate inbound message.
 * Usage: node --use-system-ca scripts/e2e-meta-setup.cjs [--production]
 */
const path = require("path");
const axios = require("axios");

process.chdir(path.join(__dirname, ".."));

const { bootstrapEnv } = require("../src/config/env-bootstrap");
const { loadPageRegistry, getAllPages } = require("../src/pages");

const GRAPH = "v21.0";
const PRODUCTION = process.argv.includes("--production");
const BASE =
  process.env.MESSENGER_BASE_URL ||
  (PRODUCTION ? "https://sabo-messenger-bot.onrender.com" : `http://127.0.0.1:${process.env.PORT || 3105}`);

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "longsang_messenger_bot_2026";
const CALLBACK_URL = `${BASE.replace(/\/$/, "")}/webhook`;
const FIELDS = "messages,messaging_postbacks,messaging_optins,message_deliveries,message_reads";

function appAccessToken() {
  const id = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || process.env.VITE_FACEBOOK_APP_ID;
  const secret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (!id || !secret) throw new Error("Missing META_APP_ID / META_APP_SECRET");
  return `${id}|${secret}`;
}

async function graphPost(pathSuffix, params = {}, body = null) {
  const url = `https://graph.facebook.com/${GRAPH}${pathSuffix}`;
  const { data } = await axios.post(url, body, { params, timeout: 20000 });
  return data;
}

async function graphGet(pathSuffix, params = {}) {
  const url = `https://graph.facebook.com/${GRAPH}${pathSuffix}`;
  const { data } = await axios.get(url, { params, timeout: 20000 });
  return data;
}

async function configureAppWebhook() {
  const appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || process.env.VITE_FACEBOOK_APP_ID;
  const token = appAccessToken();
  console.log("\n[1] App webhook →", CALLBACK_URL);
  try {
    const res = await graphPost(`/${appId}/subscriptions`, {
      object: "page",
      callback_url: CALLBACK_URL,
      verify_token: VERIFY_TOKEN,
      fields: FIELDS,
      access_token: token,
    });
    console.log("    OK:", res.success !== false ? "subscribed" : res);
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    if (/already/i.test(msg)) console.log("    OK (already set):", msg);
    else throw err;
  }
}

async function subscribePages(pages) {
  console.log("\n[2] Subscribe 11 pages to app webhook");
  let ok = 0;
  let fail = 0;
  for (const page of pages) {
    if (!page.accessToken) {
      console.log(`    SKIP ${page.name} — no token`);
      fail++;
      continue;
    }
    try {
      await graphPost(`/${page.id}/subscribed_apps`, {
        subscribed_fields: FIELDS,
        access_token: page.accessToken,
      });
      console.log(`    OK ${page.name}`);
      ok++;
    } catch (err) {
      const e = err.response?.data?.error;
      console.log(`    FAIL ${page.name}: ${e?.message || err.message}`);
      fail++;
    }
  }
  return { ok, fail };
}

async function runSetupEndpoint() {
  console.log("\n[3] GET /setup (Get Started + menu + ice breakers)");
  const { data } = await axios.get(`${BASE}/setup`, { timeout: 120000 });
  const succeeded = data.results?.filter((r) => r.success).length ?? 0;
  const failed = data.results?.filter((r) => !r.success) || [];
  console.log(`    ${succeeded}/${data.total} pages OK`);
  for (const f of failed) console.log(`    FAIL ${f.name}: ${f.error}`);
  return data;
}

async function simulateWebhook(page, text) {
  console.log("\n[4] Simulate inbound message → production webhook");
  const payload = {
    object: "page",
    entry: [
      {
        id: page.id,
        time: Date.now(),
        messaging: [
          {
            sender: { id: "e2e_test_psid_do_not_reply" },
            recipient: { id: page.id },
            timestamp: Date.now(),
            message: { mid: `m_e2e_${Date.now()}`, text },
          },
        ],
      },
    ],
  };
  const res = await axios.post(`${BASE}/webhook`, payload, {
    timeout: 30000,
    validateStatus: () => true,
  });
  console.log(`    POST /webhook → ${res.status} (handler runs async; Send API may fail on fake PSID — expected)`);
  return res.status === 200;
}

async function testReplyPipeline(page) {
  console.log("\n[5] Reply pipeline (generateReply local)");
  const { generateReply } = require("../src/ai/router");
  const reply = await generateReply(page, "e2e_quality", "Xin chào, tư vấn làm app giúp tôi");
  console.log(`    layer=${reply.layer} len=${reply.text.length}`);
  console.log(`    A: ${reply.text.slice(0, 180)}…`);
  return reply;
}

async function main() {
  await bootstrapEnv();
  applyMetaFromBootstrap();
  loadPageRegistry();
  const pages = getAllPages();

  console.log("=== E2E Meta + Messenger Bot ===");
  console.log("Base URL:", BASE);
  console.log("Pages with token:", pages.filter((p) => p.accessToken).length);

  await configureAppWebhook();
  const sub = await subscribePages(pages);
  const setup = await runSetupEndpoint();
  const testPage = pages.find((p) => p.slug === "SABO_MEDIA") || pages[0];
  await testReplyPipeline(testPage);
  await simulateWebhook(testPage, "E2E test — xin chào SABO");

  console.log("\n=== Summary ===");
  console.log(`Page subscribe: ${sub.ok} OK, ${sub.fail} fail`);
  console.log(`Profile setup: ${setup.succeeded}/${setup.total}`);
  console.log("\nE2E còn cần người thật nhắn 1 Page trên Messenger để confirm inbox (app dev mode = chỉ tester).");
  console.log("Webhook URL:", CALLBACK_URL);
  console.log("Verify token:", VERIFY_TOKEN);

  const setupFailed = (setup.results || []).some((r) => !r.success);
  process.exit(sub.fail > 0 || setupFailed ? 1 : 0);
}

function applyMetaFromBootstrap() {
  const fs = require("fs");
  const dotenv = require("dotenv");
  const MONOREPO_ROOT = process.env.MONOREPO_ROOT || "D:\\0.PROJECTS";
  for (const f of [
    path.join(MONOREPO_ROOT, "00-MASTER-ADMIN", "admin", ".env"),
    path.join(MONOREPO_ROOT, ".env"),
    path.join(MONOREPO_ROOT, ".env.secrets"),
  ]) {
    if (!fs.existsSync(f)) continue;
    const merged = dotenv.parse(fs.readFileSync(f, "utf8"));
    if (!process.env.META_APP_ID)
      process.env.META_APP_ID =
        merged.META_APP_ID || merged.VITE_FACEBOOK_APP_ID || merged.FACEBOOK_APP_ID;
    if (!process.env.META_APP_SECRET)
      process.env.META_APP_SECRET = merged.META_APP_SECRET || merged.FACEBOOK_APP_SECRET;
  }
}

main().catch((err) => {
  console.error("\nE2E failed:", err.response?.data || err.message);
  process.exit(1);
});
