require("dotenv").config();

const express = require("express");
const { bootstrapEnv } = require("./config/env-bootstrap");
const webhookRouter = require("./webhook");
const { loadPageRegistry, getPagesWithToken, getAllPages } = require("./pages");
const { setupAllPages } = require("./utils/sender");
const { logger, requestLogger } = require("./utils/logger");
const { isLlmConfigured, getLlmConfig } = require("./ai/llm");
const { isRagConfigured } = require("./ai/rag");
const { isLeadQueueConfigured } = require("./leads/queue");
const { stats: sessionStats } = require("./session/store");
const { startInboxPoller, pollerStats } = require("./inbox/poller");

const PORT = process.env.PORT || 3000;

const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  const pages = getAllPages();
  const configured = getPagesWithToken().length;
  const llm = getLlmConfig();

  res.status(200).json({
    status: "ok",
    gitCommit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
    pages: pages.length,
    tokensConfigured: configured,
    ai: {
      llm: isLlmConfigured(),
      llmProvider: llm?.provider || null,
      llmModel: llm?.model || null,
      brainRag: isRagConfigured(),
      brainRagUrl: process.env.BRAIN_RAG_URL || "http://127.0.0.1:3012",
      leadQueue: isLeadQueueConfigured(),
      activeThreads: sessionStats().activeThreads,
      inboxPoller: pollerStats(),
    },
    strategies: {
      "sabo-mt": pages.filter((p) => p.replyStrategy === "sabo-mt").length,
      "rag-mini": pages.filter((p) => p.replyStrategy === "rag-mini").length,
      "human-handoff": pages.filter((p) => p.replyStrategy === "human-handoff").length,
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/setup", async (_req, res) => {
  const pages = getPagesWithToken();
  if (pages.length === 0) {
    return res.status(400).json({
      success: false,
      error: "No page access tokens configured in environment",
    });
  }

  logger.info("setup_started", { pageCount: pages.length });
  const results = await setupAllPages(pages);
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success);

  res.status(failed.length === results.length ? 500 : 200).json({
    success: failed.length === 0,
    total: results.length,
    succeeded,
    failed: failed.length,
    results,
  });
});

app.use("/webhook", webhookRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

async function start() {
  await bootstrapEnv();
  loadPageRegistry();

  app.listen(PORT, () => {
    const pages = getAllPages();
    const configured = getPagesWithToken().length;
    const llm = getLlmConfig();
    logger.info("server_started", {
      port: PORT,
      pages: pages.length,
      tokensConfigured: configured,
      llm: llm?.provider || "none",
      rag: isRagConfigured(),
      leadQueue: isLeadQueueConfigured(),
      inboxPoller: pollerStats().enabled,
    });
    startInboxPoller();
  });
}

start().catch((err) => {
  logger.error("startup_failed", { error: err.message });
  process.exit(1);
});
