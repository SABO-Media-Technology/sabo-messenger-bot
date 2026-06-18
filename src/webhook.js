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



  if (body.object !== "page") {

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

  }

});



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

