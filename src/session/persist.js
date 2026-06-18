/**
 * Optional Supabase persistence for PSID sessions (survives Render cold start).
 * Table: messenger_threads (page_id, psid, messages, lead, meta)
 */

const axios = require("axios");
const { logger } = require("../utils/logger");
const { emptyProfile } = require("../leads/flow");

function defaultSessionMeta() {
  return {
    profileName: null,
    firstName: null,
    honorific: "anh/chị",
    nameRefused: false,
    fbProfileFetched: false,
  };
}

function isPersistConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

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
    params: options.params,
    data: options.body,
    timeout: 8000,
    validateStatus: () => true,
  });
}

/**
 * @returns {Promise<{ messages: object[], lead: object, meta: object } | null>}
 */
async function loadThread(pageId, senderId) {
  if (!isPersistConfigured()) return null;

  const res = await supabaseRest("messenger_threads", {
    params: {
      page_id: `eq.${pageId}`,
      psid: `eq.${senderId}`,
      select: "messages,lead,meta,project_slug",
      limit: 1,
    },
  });

  if (!res || res.status < 200 || res.status >= 300) {
    if (res?.status && res.status !== 404) {
      logger.warn("session_load_failed", { pageId, status: res.status });
    }
    return null;
  }

  const row = Array.isArray(res.data) ? res.data[0] : null;
  if (!row) return null;

  return {
    messages: Array.isArray(row.messages) ? row.messages : [],
    lead: { ...emptyProfile(), ...(row.lead || {}) },
    meta: { ...defaultSessionMeta(), ...(row.meta || {}) },
    projectSlug: row.project_slug || null,
  };
}

function saveThread(pageId, senderId, projectSlug, entry) {
  if (!isPersistConfigured()) return;

  const body = {
    page_id: pageId,
    psid: senderId,
    project_slug: projectSlug || null,
    messages: entry.messages || [],
    lead: entry.lead || emptyProfile(),
    meta: entry.meta || defaultSessionMeta(),
    updated_at: new Date().toISOString(),
  };

  supabaseRest("messenger_threads", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    params: { on_conflict: "page_id,psid" },
    body,
  }).catch((err) => {
    logger.warn("session_save_failed", { pageId, error: err.message });
  });
}

module.exports = { isPersistConfigured, loadThread, saveThread };
