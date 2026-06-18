/**
 * Deploy sabo-messenger-bot to Render (create service + env + deploy).
 * Usage: RENDER_API_KEY=rnd_... node scripts/deploy-render.cjs
 */
const path = require("path");

process.chdir(path.join(__dirname, ".."));

const { bootstrapEnv } = require("../src/config/env-bootstrap");
const { loadPageRegistry, PAGE_DEFINITIONS } = require("../src/pages");

const API_KEY = process.env.RENDER_API_KEY;
const OWNER_ID = process.env.RENDER_OWNER_ID || "tea-d8psrsu7r5hc7397m20g";
const REPO = process.env.RENDER_REPO || "https://github.com/longsangsabo2025/eva";
const BRANCH = process.env.RENDER_BRANCH || "main";
const SERVICE_NAME = "sabo-messenger-bot";
const ROOT_DIR = "messenger-bot";

async function api(method, urlPath, body) {
  const res = await fetch(`https://api.render.com/v1${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
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
    { key: "GROQ_API_KEY", value: process.env.GROQ_API_KEY },
    { key: "GROQ_MODEL", value: process.env.GROQ_MODEL || "llama-3.3-70b-versatile" },
    { key: "SUPABASE_URL", value: process.env.SUPABASE_URL },
    { key: "SUPABASE_SERVICE_KEY", value: process.env.SUPABASE_SERVICE_KEY },
    { key: "TELEGRAM_BOT_TOKEN", value: process.env.TELEGRAM_BOT_TOKEN },
    { key: "TELEGRAM_ADMIN_CHAT_ID", value: process.env.TELEGRAM_ADMIN_CHAT_ID },
    { key: "META_USER_ACCESS_TOKEN", value: process.env.META_USER_ACCESS_TOKEN },
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
  return api("POST", "/services", {
    type: "web_service",
    name: SERVICE_NAME,
    ownerId: OWNER_ID,
    repo: REPO,
    branch: BRANCH,
    autoDeploy: "yes",
    rootDir: ROOT_DIR,
    serviceDetails: {
      env: "node",
      plan: "free",
      region: "singapore",
      buildCommand: "npm install",
      startCommand: "npm start",
      healthCheckPath: "/health",
    },
  });
}

async function setEnvVars(serviceId, envVars) {
  return api("PUT", `/services/${serviceId}/env-vars`, {
    envVars: envVars.map(({ key, value }) => ({ key, value })),
  });
}

async function triggerDeploy(serviceId) {
  return api("POST", `/services/${serviceId}/deploys`, {
    clearCache: "do_not_clear",
  });
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
    console.error("Set RENDER_API_KEY");
    process.exit(1);
  }

  await bootstrapEnv();
  loadPageRegistry();

  const envVars = buildEnvVars();
  console.log(`Env vars to push: ${envVars.length} (secrets redacted in log)`);

  let service = await findService();
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
  const deployId = deploy.deploy?.id || deploy.id;
  console.log("Deploy id:", deployId);

  await waitDeploy(service.id, deployId);

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
