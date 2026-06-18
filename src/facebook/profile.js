/**
 * Fetch Messenger user profile from Graph API (PSID).
 * GET /{psid}?fields=first_name,last_name,name
 */

const axios = require("axios");
const { logger } = require("../utils/logger");

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Default honorific when gender unknown — Vietnamese sales norm.
 * @param {{ first_name?: string, last_name?: string, name?: string } | null} profile
 */
function deriveHonorific(profile) {
  if (!profile?.first_name) return "anh/chị";
  // Gender unknown → neutral paired form (CEO policy)
  return "anh/chị";
}

/**
 * Greeting fragment: "anh Minh" or "anh/chị"
 */
function buildHonorificAddress(sessionMeta) {
  if (sessionMeta?.nameRefused) return "anh/chị";
  const first = sessionMeta?.firstName;
  if (first) return `anh/chị ${first}`;
  return sessionMeta?.honorific || "anh/chị";
}

/**
 * @returns {Promise<{ first_name: string, last_name: string, name: string } | null>}
 */
async function fetchMessengerProfile(psid, accessToken) {
  if (!psid || !accessToken) return null;

  const mock = process.env.MOCK_FB_PROFILE;
  if (mock) {
    try {
      return JSON.parse(mock);
    } catch {
      return null;
    }
  }

  try {
    const { data } = await axios.get(`${GRAPH_BASE}/${psid}`, {
      params: {
        fields: "first_name,last_name,name",
        access_token: accessToken,
      },
      timeout: 8000,
    });
    if (!data?.name && !data?.first_name) return null;
    return {
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      name: data.name || [data.first_name, data.last_name].filter(Boolean).join(" "),
    };
  } catch (err) {
    const fbErr = err.response?.data?.error?.message;
    logger.warn("fb_profile_fetch_failed", { psid: psid.slice(0, 8), error: fbErr || err.message });
    return null;
  }
}

module.exports = {
  fetchMessengerProfile,
  deriveHonorific,
  buildHonorificAddress,
};
