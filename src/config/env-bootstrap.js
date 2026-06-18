/**
 * Load secrets from monorepo .env files (không commit vào messenger-bot/.env).
 * Chỉ set biến chưa có trong process.env.
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const axios = require("axios");
const { logger } = require("../utils/logger");
const { PAGE_DEFINITIONS } = require("../pages");

const MONOREPO_ROOT = process.env.MONOREPO_ROOT || "D:\\0.PROJECTS";
const GRAPH_VERSION = "v21.0";

const ENV_SOURCES = [
  path.join(MONOREPO_ROOT, "messenger-bot", ".env"),
  path.join(MONOREPO_ROOT, "05-TOOLS", ".env"),
  path.join(MONOREPO_ROOT, "05-TOOLS", "fb-messenger-bot", ".env"),
  path.join(MONOREPO_ROOT, "00-MASTER-ADMIN", "admin", ".env"),
  path.join(MONOREPO_ROOT, "02-SABO-ECOSYSTEM", "sabo-mt-website", ".env.local"),
  path.join(MONOREPO_ROOT, "02-SABO-ECOSYSTEM", "sabo-mt-website", ".env"),
  path.join(MONOREPO_ROOT, "10-AI-BRAIN", "travis", "services", "travis-ai", ".env"),
  path.join(MONOREPO_ROOT, "00-MASTER-ADMIN", "admin", "supabase", ".env"),
  path.join(MONOREPO_ROOT, "01-MAIN-PRODUCTS", "long-sang-ai", ".env"),
  path.join(MONOREPO_ROOT, ".env.secrets"),
];

/** page_id → admin .env key for known page tokens */
const ADMIN_TOKEN_BY_PAGE_ID = {
  "118356497898536": "FACEBOOK_PAGE_ACCESS_TOKEN",
  "569671719553461": "FACEBOOK_PAGE_AI_NEWBIE_VN_TOKEN",
  "332950393234346": "FACEBOOK_PAGE_SABO_MEDIA_TOKEN",
  "618738001318577": "FACEBOOK_PAGE_AI_ART_NEWBIE_TOKEN",
  "569652129566651": "FACEBOOK_PAGE_SABO_BILLIARD_SHOP_TOKEN",
  "519070237965883": "FACEBOOK_PAGE_THO_SAN_HOANG_HON_TOKEN",
};

const PAGE_ID_TO_TOKEN_ENV = Object.fromEntries(
  PAGE_DEFINITIONS.map((p) => [p.id, p.tokenEnv]),
);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  return dotenv.parse(raw);
}

function cleanEnvValue(value) {
  if (value == null) return "";
  return String(value).replace(/^["']|["']$/g, "").replace(/\r?\n/g, "").trim();
}

function jwtProjectRef(apiKey) {
  try {
    const payload = JSON.parse(Buffer.from(String(apiKey).split(".")[1], "base64").toString());
    return payload.ref || "";
  } catch {
    return "";
  }
}

/** Messenger leads live on shared instance diexsbzqwsbpilsymnfb — URL/key must match. */
const SHARED_SUPABASE_REF = "diexsbzqwsbpilsymnfb";

function resolveSharedSupabase(merged) {
  const pairs = [
    { url: merged.SUPABASE_URL, key: merged.SUPABASE_SERVICE_KEY },
    { url: merged.FORGE_SUPABASE_URL, key: merged.FORGE_SUPABASE_SERVICE_ROLE_KEY },
    { url: merged.SUPABASE_URL, key: merged.SUPABASE_SERVICE_ROLE_KEY },
    { url: merged.VITE_SUPABASE_URL, key: merged.SUPABASE_SERVICE_ROLE_KEY },
    { url: merged.VITE_SUPABASE_URL, key: merged.VITE_SUPABASE_SERVICE_KEY },
  ];

  for (const pair of pairs) {
    const url = cleanEnvValue(pair.url);
    const key = cleanEnvValue(pair.key);
    if (!url || !key) continue;
    const hostRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
    const keyRef = jwtProjectRef(key);
    if (hostRef === SHARED_SUPABASE_REF && keyRef === SHARED_SUPABASE_REF) {
      return { url, key };
    }
  }
  return null;
}

function applyIfUnset(key, value) {
  const cleaned = cleanEnvValue(value);
  if (cleaned && !process.env[key]) {
    process.env[key] = cleaned;
  }
}

function bootstrapFromFiles() {
  const merged = {};
  for (const filePath of ENV_SOURCES) {
    Object.assign(merged, parseEnvFile(filePath));
  }

  // LLM
  applyIfUnset("GROQ_API_KEY", merged.GROQ_API_KEY);
  applyIfUnset("OPENAI_API_KEY", merged.OPENAI_API_KEY);

  // Supabase shared — force matching URL + service key (travis/admin hoaprkc must not win)
  const sharedSb = resolveSharedSupabase(merged);
  if (sharedSb) {
    process.env.SUPABASE_URL = sharedSb.url;
    process.env.SUPABASE_SERVICE_KEY = sharedSb.key;
  } else {
    applyIfUnset(
      "SUPABASE_URL",
      merged.SUPABASE_URL || merged.FORGE_SUPABASE_URL || merged.VITE_SUPABASE_URL,
    );
    applyIfUnset(
      "SUPABASE_SERVICE_KEY",
      merged.SUPABASE_SERVICE_KEY ||
        merged.FORGE_SUPABASE_SERVICE_ROLE_KEY ||
        merged.SUPABASE_SERVICE_ROLE_KEY ||
        merged.VITE_SUPABASE_SERVICE_KEY,
    );
  }

  // Telegram notify
  applyIfUnset("TELEGRAM_BOT_TOKEN", merged.TELEGRAM_BOT_TOKEN || merged.VITE_TELEGRAM_BOT_TOKEN);
  applyIfUnset("TELEGRAM_ADMIN_CHAT_ID", merged.TELEGRAM_ADMIN_CHAT_ID);

  // Meta user token
  applyIfUnset(
    "META_USER_ACCESS_TOKEN",
    merged.META_USER_ACCESS_TOKEN ||
      merged.FACEBOOK_USER_ACCESS_TOKEN ||
      merged.FB_USER_ACCESS_TOKEN,
  );

  // Map admin page tokens → PAGE_ACCESS_TOKEN_*
  for (const [pageId, adminKey] of Object.entries(ADMIN_TOKEN_BY_PAGE_ID)) {
    const tokenEnv = PAGE_ID_TO_TOKEN_ENV[pageId];
    if (tokenEnv && merged[adminKey]) {
      applyIfUnset(tokenEnv, merged[adminKey]);
    }
  }

  applyIfUnset("VERIFY_TOKEN", merged.MESSENGER_VERIFY_TOKEN || "longsang_messenger_bot_2026");
  applyIfUnset("CUSTOMER_SAFE_MODE", merged.CUSTOMER_SAFE_MODE || "true");

  applyIfUnset("META_APP_ID", merged.META_APP_ID || merged.VITE_FACEBOOK_APP_ID || merged.FACEBOOK_APP_ID);
  applyIfUnset("META_APP_SECRET", merged.META_APP_SECRET || merged.FACEBOOK_APP_SECRET);

  const dbUrl = cleanEnvValue(merged.DATABASE_URL);
  if (dbUrl.includes(SHARED_SUPABASE_REF)) {
    process.env.DATABASE_URL = dbUrl;
  } else {
    applyIfUnset("DATABASE_URL", merged.DATABASE_URL);
  }

  return merged;
}

async function fetchMissingPageTokens() {
  const userToken = process.env.META_USER_ACCESS_TOKEN;
  if (!userToken) return { fetched: 0 };

  const missing = PAGE_DEFINITIONS.filter((p) => !process.env[p.tokenEnv]);
  if (missing.length === 0) return { fetched: 0 };

  const byId = new Map();

  try {
    const { data } = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`, {
      params: {
        fields: "id,name,access_token",
        limit: 100,
        access_token: userToken,
      },
      timeout: 15000,
    });

    for (const page of data.data || []) {
      byId.set(page.id, page.access_token);
    }
  } catch (err) {
    logger.warn("graph_me_accounts_failed", { error: err.response?.data?.error?.message || err.message });
  }

  let fetched = 0;
  for (const page of missing) {
    if (byId.has(page.id)) {
      process.env[page.tokenEnv] = byId.get(page.id);
      fetched++;
      continue;
    }

    try {
      const { data } = await axios.get(`https://graph.facebook.com/${GRAPH_VERSION}/${page.id}`, {
        params: { fields: "id,name,access_token", access_token: userToken },
        timeout: 10000,
      });
      if (data.access_token) {
        process.env[page.tokenEnv] = data.access_token;
        fetched++;
      }
    } catch {
      // page not accessible with this user token
    }
  }

  return { fetched, missing: missing.length - fetched };
}

async function bootstrapEnv() {
  bootstrapFromFiles();
  const tokenResult = await fetchMissingPageTokens();
  logger.info("env_bootstrap_done", {
    groq: Boolean(process.env.GROQ_API_KEY),
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID),
    metaUser: Boolean(process.env.META_USER_ACCESS_TOKEN),
    pageTokensFetched: tokenResult.fetched,
    pageTokensStillMissing: tokenResult.missing ?? 0,
  });
  return tokenResult;
}

module.exports = { bootstrapEnv, bootstrapFromFiles, ENV_SOURCES };
