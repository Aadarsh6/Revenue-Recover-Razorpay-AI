import express, { Request, Response } from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import prisma from "./lib/prismaClient";
import { PrismaClientKnownRequestError } from "./generated/prisma/internal/prismaNamespace";
import { validateState, StateDecision } from "./services/stateValidator";
import { createRecoveryCase } from "./services/recoveryCaseService";

dotenv.config();

const app = express();

app.post(
  "/webhook/razorpay",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const rawBody = req.body.toString("utf8");

    const signature = req.headers["x-razorpay-signature"];
    const eventId = req.headers["x-razorpay-event-id"];

    // Validate headers
    if (typeof signature !== "string" || typeof eventId !== "string") {
      return res.status(400).send("Missing webhook headers");
    }

    // 1. Signature Verification (Security Layer)
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string)
      .update(rawBody)
      .digest("hex");

    const skipSignatureValidation =
      process.env.SKIP_SIGNATURE_VALIDATION === "true";

    if (!skipSignatureValidation && signature !== expectedSignature) {
      console.error("Invalid signature, rejecting webhook");
      return res.status(400).send("Invalid signature");
    }


    // Parse body only AFTER signature verification
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.status(400).send("Invalid JSON");
    }

    // FIX: Extract the exact string and paymentId before passing to the validator
    const eventType: string = body.event;
    const paymentId: string = body.payload.payment.entity.id;

    // 2. Idempotency via DB Constraint (Race Condition Fix)
    let newEvent;
    try {
      newEvent = await prisma.webhookEvent.create({
        data: {
          eventId,
          eventType,
          payload: body,
          status: "PENDING",
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.error(`Duplicate webhook received: ${eventId}`);
        return res.status(200).json({
          status: "duplicate ignored",
        });
      }

      console.error("Failed to create webhook event:", error);
      return res.status(500).send("Internal server error");
    }

    // 3. Acknowledge receipt immediately
    res.status(200).json({ status: "ok" });

// ... inside your app.post route, replace the asynchronous processing block:

  // 4. Asynchronous processing
  try {
    console.log(`Processing event ${eventId}(${eventType})`);

    // Validate state against live Razorpay API
    const stateResult: StateDecision = await validateState(eventType, paymentId);
    
    // 1. Create Recovery Case (The Domain Object)
    const recoveryCase = await createRecoveryCase(newEvent.id, paymentId, stateResult);

    // 2. Route based on the Recovery Case status
    if (recoveryCase.status !== 'OPEN') {
      await prisma.webhookEvent.update({
        where: { id: newEvent.id },
        data: { 
          status: recoveryCase.status === 'BLOCKED' ? 'IGNORED' : 'FAILED', 
          processedAt: new Date() 
        },
      });
      console.log(`🛑 Pipeline stopped. Recovery Case ${recoveryCase.id} is ${recoveryCase.status}. No money moved.`);
      return; 
    }

    // If we reach here, the case is OPEN.
    console.log(`Recovery Case ${recoveryCase.id} OPEN. Proceeding to Context Aggregation...`);

    await prisma.webhookEvent.update({
      where: { id: newEvent.id },
      data: { 
        status: "PROCESSED",
        processedAt: new Date()
      },
    });
    console.log(`Successfully Processed Event: ${eventId}`);

  } catch (error) {
    console.error(`Processing FAILED for Event: ${eventId}`, error);
    
    await prisma.webhookEvent.update({
      where: { id: newEvent.id },
      data: { 
        status: "FAILED",
        processedAt: new Date()
      },
    });
  }
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));