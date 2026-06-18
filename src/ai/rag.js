const axios = require("axios");
const { logger } = require("../utils/logger");

const BRAIN_RAG_URL = (process.env.BRAIN_RAG_URL || "http://127.0.0.1:3012").replace(/\/$/, "");
const RAG_TIMEOUT_MS = Number(process.env.BRAIN_RAG_TIMEOUT_MS || 5000);
const RAG_LIMIT = Number(process.env.BRAIN_RAG_LIMIT || 4);

/**
 * Fetch context snippets from Brain RAG (best-effort; never blocks reply).
 */
async function fetchRagContext(query, page) {
  if (process.env.BRAIN_RAG_ENABLED === "false") {
    return "";
  }

  const enrichedQuery = [query, ...(page.ragTags || [])].join(" ");

  try {
    const { data } = await axios.post(
      `${BRAIN_RAG_URL}/api/brain/rag/search`,
      { query: enrichedQuery, limit: RAG_LIMIT },
      { timeout: RAG_TIMEOUT_MS },
    );

    const results = data.results || data.data || [];
    if (!Array.isArray(results) || results.length === 0) {
      return "";
    }

    const snippets = results
      .slice(0, RAG_LIMIT)
      .map((r, i) => {
        const title = r.title || r.source || `Doc ${i + 1}`;
        const body = (r.summary || r.content || "").slice(0, 400);
        return `[${title}] ${body}`;
      })
      .join("\n");

    logger.debug("rag_context", { pageId: page.id, snippets: results.length });
    return snippets;
  } catch (err) {
    logger.warn("rag_unavailable", {
      pageId: page.id,
      error: err.response?.data?.error || err.message,
    });
    return "";
  }
}

function isRagConfigured() {
  return process.env.BRAIN_RAG_ENABLED !== "false";
}

module.exports = { fetchRagContext, isRagConfigured };
