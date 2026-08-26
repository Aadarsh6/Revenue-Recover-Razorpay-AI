import express, { Request, Response } from "express"
import dotenv from "dotenv"
import crypto from "crypto"
import prisma from "./lib/prismaClient"
import { PrismaClientKnownRequestError } from "./generated/prisma/internal/prismaNamespace"
import { validateState, StateDecision } from "./services/src/services/stateMachine"

dotenv.config()

const app = express()

app.post(
  "/webhook/razorpay",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const rawBody = req.body.toString("utf8")

    const signature = req.headers["x-razorpay-signature"]
    const eventId = req.headers["x-razorpay-event-id"]

    // Validate headers
    if (typeof signature !== "string" || typeof eventId !== "string") {
      return res.status(400).send("Missing webhook headers")
    }

// 1. Signature Verification (Security Layer)
    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_WEBHOOK_SECRET as string
      )
      .update(rawBody)
      .digest("hex")

    if (signature !== expectedSignature) {
      console.error("Invalid signature, rejecting webhook")
      return res.status(400).send("Invalid signature")
    }

    // Parse body only AFTER signature verification
    let body

    try {
      body = JSON.parse(rawBody)
    } catch {
      return res.status(400).send("Invalid JSON")
    }

    const eventType = body.event

    // 2. Idempotency via DB Constraint (Race Condition Fix)
    let newEvent
    try {
      newEvent = await prisma.webhookEvent.create({
        data: {
          eventId,
          eventType,
          payload: body,
          status: "PENDING",
        },
      })
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.error(`Duplicate webhook received: ${eventId}`)

        return res.status(200).json({
          status: "duplicate ignored",
        })
      }

      console.error("Failed to create webhook event:", error)

      return res.status(500).send("Internal server error")
    }

  // 3. Acknowledge receipt immediately
  // WHY: Razorpay requires a fast 200 OK. If we make it wait for our AI pipeline, 
  // Razorpay will think our server is dead and will retry the webhook.
  // NOTE: This runs on the Node event loop, not a real queue. If the server crashes 
  // here, the event stays in PENDING. We would need a background worker to retry it later.
  res.status(200).json({ status: 'ok' });

  //4 Asynchronous processing

  try {
    console.log(`Processing event ${eventId}(${eventType})`);

    const stateResult = await validateState(body);
    const decision:StateDecision = stateResult.decision;
// Route based on the explicit decision
    if (decision !== "VALID_FAILURE") {
      await prisma.webhookEvent.update({
        where: { id: newEvent.id },
        data: { 
          status: 'IGNORED', 
          processedAt: new Date() 
        },
      });
      console.log(`🛑 BLOCKED: Event ignored due to state: ${decision}. No money moved.`);
      return; // Stops the pipeline dead in its tracks.
    }

    // If we reach here, the state is perfectly valid.
    console.log("➡️ State is valid. Proceeding to Context Aggregation...");

    await prisma.webhookEvent.update({
      where: { id: newEvent.id },
      data: { 
        status: 'PROCESSED',
        processedAt: new Date()
      },
    });
    console.log(`✅ Successfully Processed Event: ${eventId}`);

  } catch (error) {
    console.error(`🔥 Processing FAILED for Event: ${eventId}`, error);
    
    await prisma.webhookEvent.update({
      where: { id: newEvent.id },
      data: { 
        status: 'FAILED',
        processedAt: new Date()
      },
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));