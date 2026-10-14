const express = require("express");

const { getPage } = require("./pages");

const { handleMessage } = require("./handlers/message");

const { handlePostback } = require("./handlers/welcome");

const { claimMessage } = require("./inbox/dedupe");

const { logger } = require("./utils/logger");



const router = express.Router();



const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "";



/**

 * GET /webhook — Facebook webhook verification.

 */

router.get("/", (req, res) => {

  const mode = req.query["hub.mode"];

  const token = req.query["hub.verify_token"];

  const challenge = req.query["hub.challenge"];



  if (mode === "subscribe" && token === VERIFY_TOKEN) {

    logger.info("webhook_verified");

    return res.status(200).send(challenge);

  }



  logger.warn("webhook_verify_failed", { mode, tokenMatch: token === VERIFY_TOKEN });

  return res.sendStatus(403);

});



/**

 * POST /webhook — Receive Messenger events.

 */

router.post("/", async (req, res) => {

  const body = req.body;



  if (body.object !== "page" && body.object !== "instagram") {
    return res.sendStatus(404);
  }

  // Respond immediately — Facebook requires 200 within 20s
  res.sendStatus(200);

  for (const entry of body.entry || []) {
    const pageId = entry.id;

    for (const event of entry.messaging || []) {
      processEvent(pageId, event).catch((err) => {
        logger.error("event_processing_failed", {
          pageId,
          error: err.message,
          stack: err.stack,
        });
      });
    }

    // Process Post Comments (Feed changes)
    for (const change of entry.changes || []) {
      if (change.field === "feed" && change.value?.item === "comment" && change.value?.verb === "add") {
        processCommentEvent(pageId, change.value).catch((err) => {
          logger.error("comment_processing_failed", {
            pageId,
            error: err.message,
          });
        });
      }
    }
  }
});

async function processCommentEvent(pageId, commentValue) {
  const page = getPage(pageId);
  if (!page || !page.accessToken) return;

  const commentId = commentValue.comment_id;
  const senderId = commentValue.from?.id || commentValue.sender_id;
  const senderName = commentValue.from?.name || commentValue.sender_name || "anh/chị";
  const userText = commentValue.message?.trim();

  // Don't reply to page's own comments or empty messages
  if (!commentId || !userText || senderId === pageId) return;

  logger.info("comment_received", { pageId, commentId, senderName, userText });

  const { replyComment, sendPrivateReplyToComment } = require("./utils/sender");

  // 1. Public Reply on the post
  const publicReply = `Dạ em chào ${senderName}! Em là Uyển Nhi bên SABO đây ạ 🎱 Em đã gửi thông tin tư vấn chi tiết qua inbox cho mình rồi nhé, anh/chị kiểm tra tin nhắn chờ giúp em nha! Hoặc nhắn trực tiếp Zalo em 0329 640 232 nhé ạ! ✨`;
  await replyComment(commentId, page.accessToken, publicReply).catch((err) => {
    logger.warn("comment_public_reply_failed", { commentId, error: err.message });
  });

  // 2. Private Reply to customer inbox via Meta Send API
  const { generateReply } = require("./ai/router");
  try {
    const aiResult = await generateReply(page, senderId, userText);
    if (aiResult?.text) {
      await sendPrivateReplyToComment(pageId, page.accessToken, commentId, aiResult.text);
    }
  } catch (err) {
    logger.warn("comment_private_reply_failed", { commentId, error: err.message });
  }
}



async function processEvent(pageId, event) {

  const page = getPage(pageId);

  if (!page) {

    logger.warn("unknown_page", { pageId });

    return;

  }



  if (!page.accessToken) {

    logger.warn("missing_token", { pageId, pageName: page.name });

    return;

  }



  // Human Handoff: Detect when Page Admin replies from Meta Business Suite / Page Inbox
  if (event.message?.is_echo) {
    const customerId = event.recipient?.id;
    if (customerId) {
      const { activateHumanHandoff } = require("./inbox/handoff");
      activateHumanHandoff(pageId, customerId, 30, "admin_echo");
      logger.info("admin_echo_detected_handoff_activated", { pageId, customerId });
    }
    return;
  }

  const senderId = event.sender?.id;

  if (!senderId) return;



  if (event.message?.mid) {

    const claimed = await claimMessage(event.message.mid, pageId, senderId);

    if (!claimed) {

      logger.info("webhook_duplicate_skipped", { pageId, mid: event.message.mid, senderId });

      return;

    }

  }



  if (event.message) {

    await handleMessage(page, senderId, event.message);

    return;

  }



  if (event.postback) {

    const payload = event.postback.payload || "";

    await handlePostback(page, senderId, payload);

  }

}



module.exports = router;

