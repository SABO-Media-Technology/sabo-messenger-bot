const axios = require("axios");
const { logger } = require("../utils/logger");
const { detectHotLead, extractPhone } = require("../ai/intent");
const { HOTLINE } = require("../responses/prompts");

/**
 * Async lead capture — Supabase `leads` + optional Telegram notify.
 * Does NOT call Travis. sales_concierge picks up from CRM later.
 */

async function supabaseRest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const base = url.replace(/\/$/, "");
  return axios({
    url: `${base}/rest/v1/${path}`,
    method: options.method || "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
    },
    data: options.body,
    timeout: 10000,
    validateStatus: () => true,
  });
}

async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { chat_id: chatId, text, disable_web_page_preview: true },
      { timeout: 8000 },
    );
  } catch (err) {
    const detail = err.response?.data?.description || err.message;
    logger.warn("telegram_notify_failed", { error: detail });
  }
}

/**
 * Queue lead event (fire-and-forget).
 */
async function queueLeadEvent({ page, senderId, userText, replyLayer }) {
  const phone = extractPhone(userText);
  const hot = detectHotLead(userText);
  const source = `messenger:${page.slug}`;

  if (process.env.LEAD_QUEUE_DRY_RUN === "1") {
    logger.info("lead_dry_run", { source, psid: senderId, hot });
    return { stored: false, dryRun: true };
  }

  const payload = {
    page_id: page.id,
    page_name: page.name,
    project_slug: page.projectSlug,
    psid: senderId,
    phone,
    user_text: userText.slice(0, 500),
    source,
    tier: page.tier,
    reply_layer: replyLayer,
    lead_status: "new_lead",
    lead_score: hot ? 75 : 40,
    metadata: {
      reply_layer: replyLayer,
    },
  };

  const res = await supabaseRest("messenger_leads", {
    method: "POST",
    body: payload,
    prefer: "return=representation",
  });

  if (!res) {
    logger.info("lead_logged_local", { source, psid: senderId, hot });
    return { stored: false };
  }

  if (res.status >= 200 && res.status < 300) {
    const rows = res.data;
    const leadId = Array.isArray(rows) ? rows[0]?.id : rows?.id;
    logger.info("lead_queued", { leadId, source, hot });

    const icon = hot ? "🔥" : "📩";
    await notifyTelegram(
      `${icon} Messenger lead — ${page.name}\n` +
        `Project: ${page.projectSlug} · Tier: ${page.tier}\n` +
        `PSID: ${senderId}\n` +
        (phone ? `📞 ${phone}\n` : "") +
        `\n${userText.slice(0, 200)}\n\n` +
        `→ sales_concierge / hotline ${HOTLINE}`,
    );

    return { stored: true, leadId };
  }

  logger.warn("lead_queue_failed", { status: res.status, body: res.data });
  return { stored: false };
}

function isLeadQueueConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

module.exports = { queueLeadEvent, isLeadQueueConfigured, notifyTelegram };
