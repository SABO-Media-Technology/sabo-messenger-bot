const axios = require("axios");
const { logger } = require("../utils/logger");
const { detectHotLead } = require("../ai/intent");
const { extractPhone } = require("./extract");
const { getHotline } = require("../hotline");

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
async function queueLeadEvent({ page, senderId, userText, replyLayer, profile = null }) {
  const phone = profile?.phone || extractPhone(userText);
  const hot = detectHotLead(userText) || Boolean(profile?.need && phone);
  const source = `messenger:${page.slug}`;
  const complete = Boolean(
    (profile?.phone || profile?.email) && profile?.need && (profile?.qualified || profile?.name || profile?.queued),
  );

  if (process.env.LEAD_QUEUE_DRY_RUN === "1") {
    logger.info("lead_dry_run", {
      source,
      psid: senderId,
      hot,
      complete,
      name: profile?.name || null,
    });
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
    lead_status: complete ? "qualified" : "new_lead",
    lead_score: complete ? (hot ? 85 : 65) : hot ? 75 : 40,
    metadata: {
      reply_layer: replyLayer,
      name: profile?.name || null,
      email: profile?.email || null,
      business_type: profile?.business_type || null,
      need: profile?.need || null,
      timeline: profile?.timeline || null,
      budget: profile?.budget || null,
      lead_complete: complete,
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

    // Also sync to unified CRM leads table
    const leadEmail = profile?.email || (phone ? `lead-${phone.replace(/\D/g, '')}@messenger.sabo.vn` : `lead-${senderId}@messenger.sabo.vn`);
    const leadRow = {
      name: profile?.name || "Khách Messenger",
      full_name: profile?.name || "Khách Messenger",
      phone: phone || null,
      email: leadEmail,
      message: userText.slice(0, 500),
      main_pain: profile?.need || userText.slice(0, 500),
      source,
      lead_status: complete ? (hot ? "hot_lead" : "qualified") : (hot ? "hot_lead" : "new_lead"),
      lead_score: complete ? (hot ? 85 : 65) : (hot ? 75 : 40),
      submitted_at: new Date().toISOString(),
    };
    supabaseRest("leads", {
      method: "POST",
      body: leadRow,
      prefer: "return=minimal",
    }).catch((err) => logger.warn("supabase_leads_sync_failed", { error: err.message }));

    const cleanPhone = phone ? phone.replace(/\D/g, "") : "";
    const zaloLink = cleanPhone ? `https://zalo.me/${cleanPhone}` : "";
    const badge = hot ? "🔴 [HOT LEAD — GỌI NGAY TRONG 5 PHÚT]" : "🟡 [WARM LEAD — TIỀM NĂNG]";

    await notifyTelegram(
      `${badge}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🏢 Fanpage: ${page.name}\n` +
      `👤 Khách hàng: ${profile?.name || "Khách Messenger"} (PSID: ${senderId})\n` +
      (phone ? `📞 SĐT: ${phone}\n` : "") +
      (profile?.email ? `📧 Email: ${profile.email}\n` : "") +
      `🎯 Nhu cầu: ${(profile?.need || userText).slice(0, 150)}\n` +
      `🏆 Điểm Lead: ${leadRow.lead_score}/100\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      (cleanPhone ? `👉 Nhắn Zalo: ${zaloLink}\n` : "") +
      `⚡ Sẵn sàng chốt khách trên Meta Inbox hoặc Hotline ${getHotline(page)}`
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
