/**
 * Deploy sabo-messenger-bot to Render (create service + env + deploy).
 * Usage: RENDER_API_KEY=rnd_... node scripts/deploy-render.cjs
 */
const fs = require("fs");
const path = require("path");

process.chdir(path.join(__dirname, ".."));

const MONOREPO_ROOT = process.env.MONOREPO_ROOT || "D:\\0.PROJECTS";

const { bootstrapEnv } = require("../src/config/env-bootstrap");
const { loadPageRegistry, PAGE_DEFINITIONS } = require("../src/pages");

const API_KEY = process.env.RENDER_API_KEY;
const OWNER_ID = process.env.RENDER_OWNER_ID || "tea-d8psrsu7r5hc7397m20g";
const SERVICE_ID = process.env.RENDER_SERVICE_ID || "srv-d8psv69194ac739luu00";
const REPO = process.env.RENDER_REPO || "https://github.com/longsangsabo2025/sabo-messenger-bot";
const BRANCH = process.env.RENDER_BRANCH || "main";
const SERVICE_NAME = "sabo-messenger-bot";
const ROOT_DIR = process.env.RENDER_ROOT_DIR || "";

async function api(method, urlPath, body) {
  const key = process.env.RENDER_API_KEY;
  const res = await fetch(`https://api.render.com/v1${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} → ${res.status}: ${text.slice(0, 800)}`);
  }
  return data;
}

async function findService() {
  const list = await api("GET", "/services?limit=100");
  const items = Array.isArray(list) ? list : [];
  for (const row of items) {
    const s = row.service || row;
    if (s.name === SERVICE_NAME) return s;
  }
  return null;
}

function buildEnvVars() {
  const vars = [
    { key: "NODE_ENV", value: "production" },
    { key: "VERIFY_TOKEN", value: process.env.VERIFY_TOKEN },
    { key: "META_APP_ID", value: process.env.META_APP_ID || process.env.VITE_FACEBOOK_APP_ID },
    { key: "META_APP_SECRET", value: process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET },
    { key: "HERMES_ENABLED", value: process.env.HERMES_ENABLED },
    { key: "HERMES_API_URL", value: process.env.HERMES_API_URL },
    { key: "HERMES_API_KEY", value: process.env.HERMES_API_KEY || process.env.API_SERVER_KEY },
    { key: "HERMES_MODEL", value: process.env.HERMES_MODEL || "hermes-agent" },
    { key: "LLM_PROVIDER", value: process.env.LLM_PROVIDER || "auto" },
    { key: "OLLAMA_ENABLED", value: process.env.OLLAMA_ENABLED },
    { key: "OLLAMA_BASE_URL", value: process.env.OLLAMA_BASE_URL },
    { key: "OLLAMA_MODEL", value: process.env.OLLAMA_MODEL || "qwen3.5:9b" },
    { key: "GROQ_API_KEY", value: process.env.GROQ_API_KEY },
    { key: "GROQ_MODEL", value: process.env.GROQ_MODEL || "llama-3.3-70b-versatile" },
    { key: "OPENAI_API_KEY", value: process.env.OPENAI_API_KEY },
    { key: "OPENAI_MODEL", value: process.env.OPENAI_MODEL || "gpt-4o-mini" },
    { key: "SUPABASE_URL", value: process.env.SUPABASE_URL },
    { key: "SUPABASE_SERVICE_KEY", value: process.env.SUPABASE_SERVICE_KEY },
    { key: "TELEGRAM_BOT_TOKEN", value: process.env.TELEGRAM_BOT_TOKEN },
    { key: "TELEGRAM_ADMIN_CHAT_ID", value: process.env.TELEGRAM_ADMIN_CHAT_ID },
    { key: "META_USER_ACCESS_TOKEN", value: process.env.META_USER_ACCESS_TOKEN },
    // Webhook Live + dedupe.js: default OFF to avoid double-reply with webhook.
    // Set INBOX_POLLER_ENABLED=true only for Meta Dev mode or webhook outages.
    { key: "INBOX_POLLER_ENABLED", value: process.env.INBOX_POLLER_ENABLED ?? "false" },
    { key: "CUSTOMER_SAFE_MODE", value: process.env.CUSTOMER_SAFE_MODE ?? "true" },
    { key: "BRAIN_RAG_ENABLED", value: process.env.BRAIN_RAG_ENABLED || "false" },
  ];

  if (process.env.BRAIN_RAG_URL) {
    vars.push({ key: "BRAIN_RAG_URL", value: process.env.BRAIN_RAG_URL });
  }

  for (const page of PAGE_DEFINITIONS) {
    const token = process.env[page.tokenEnv];
    if (token) vars.push({ key: page.tokenEnv, value: token });
  }

  return vars.filter((v) => v.value);
}

async function createService() {
  const body = {
    type: "web_service",
    name: SERVICE_NAME,
    ownerId: OWNER_ID,
    repo: REPO,
    branch: BRANCH,
    autoDeploy: "yes",
    serviceDetails: {
      env: "node",
      plan: "free",
      region: "singapore",
      healthCheckPath: "/health",
      envSpecificDetails: {
        buildCommand: "npm install",
        startCommand: "npm start",
      },
    },
  };
  if (ROOT_DIR) body.rootDir = ROOT_DIR;
  return api("POST", "/services", body);
}

async function setEnvVars(serviceId, envVars) {
  return api("PUT", `/services/${serviceId}/env-vars`, envVars);
}

async function triggerDeploy(serviceId) {
  const data = await api("POST", `/services/${serviceId}/deploys`, {});
  return data?.deploy || data;
}

async function waitDeploy(serviceId, deployId) {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 15000));
    const d = await api("GET", `/services/${serviceId}/deploys/${deployId}`);
    const status = d.deploy?.status || d.status;
    console.log(`  deploy status: ${status}`);
    if (status === "live") return d;
    if (status === "build_failed" || status === "update_failed" || status === "canceled") {
      throw new Error(`Deploy failed: ${status}`);
    }
  }
  throw new Error("Deploy timeout");
}

async function main() {
  if (!API_KEY) {
    const secretsPath = path.join(MONOREPO_ROOT, ".env.secrets");
    if (fs.existsSync(secretsPath)) {
      const m = fs.readFileSync(secretsPath, "utf8").match(/^RENDER_API_KEY=(\S+)/m);
      if (m) process.env.RENDER_API_KEY = m[1].trim();
    }
  }
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) {
    console.error("Set RENDER_API_KEY");
    process.exit(1);
  }

  await bootstrapEnv();
  loadPageRegistry();

  const envVars = buildEnvVars();
  console.log(`Env vars to push: ${envVars.length} (secrets redacted in log)`);

  let service = null;
  if (SERVICE_ID) {
    try {
      const detail = await api("GET", `/services/${SERVICE_ID}`);
      service = detail.service || detail;
      console.log("Service by ID:", service.id, service.name);
    } catch {
      console.warn("RENDER_SERVICE_ID not found, falling back to name lookup");
    }
  }
  if (!service) service = await findService();
  if (!service && SERVICE_ID) {
    throw new Error(
      `Could not load service ${SERVICE_ID}. Run: npm run deploy:render (uses --use-system-ca) and verify RENDER_API_KEY.`,
    );
  }
  if (!service) {
    console.log("Creating Render service...");
    const created = await createService();
    service = created.service || created;
    console.log("Created:", service.id, service.serviceDetails?.url || service.url);
  } else {
    console.log("Service exists:", service.id);
  }

  console.log("Updating environment variables...");
  await setEnvVars(service.id, envVars);

  console.log("Triggering deploy...");
  const deploy = await triggerDeploy(service.id);
  const deployId = deploy?.id;
  if (!deployId) {
    console.log("Deploy triggered (no id in response — check Render dashboard)");
  } else {
    console.log("Deploy id:", deployId);
    await waitDeploy(service.id, deployId);
  }

  const detail = await api("GET", `/services/${service.id}`);
  const s = detail.service || detail;
  const url = s.serviceDetails?.url || s.url;
  console.log("\nDONE");
  console.log("URL:", url);
  console.log("Health:", `${url}/health`);
  console.log("Webhook:", `${url}/webhook`);
  console.log("Setup (once):", `${url}/setup`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
