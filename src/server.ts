import express, { Request, Response } from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import prisma from "./lib/prismaClient";
import { PrismaClientKnownRequestError } from "./generated/prisma/internal/prismaNamespace";
import { validateState, StateDecision } from "./services/stateValidator";
import { createRecoveryCase } from "./services/recoveryCaseService";
import { aggregateContext } from "./services/contextAggregator";
import { AIAnalystService } from "./services/aiAnalyst";
import { evaluatePolicy } from "./services/policyEngine";
import { ExecutionLayer } from "./services/executionLayer";

dotenv.config();

const app = express();

app.post(
  "/webhook/razorpay",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const rawBody = req.body.toString("utf8");

    const signature = req.headers["x-razorpay-signature"];
    const eventId = req.headers["x-razorpay-event-id"];

    if (typeof signature !== "string" || typeof eventId !== "string") {
      return res.status(400).send("Missing webhook headers");
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string)
      .update(rawBody)
      .digest("hex");

    const skipSignatureValidation = process.env.SKIP_SIGNATURE_VALIDATION === "true";

    if (!skipSignatureValidation && signature !== expectedSignature) {
      console.error("Invalid signature, rejecting webhook");
      return res.status(400).send("Invalid signature");
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.status(400).send("Invalid JSON");
    }

    const eventType: string = body.event;
    const paymentId: string = body.payload.payment.entity.id;

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
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        console.error(`Duplicate webhook received: ${eventId}`);
        return res.status(200).json({ status: "duplicate ignored" });
      }
      console.error("Failed to create webhook event:", error);
      return res.status(500).send("Internal server error");
    }

    res.status(200).json({ status: "ok" });

    // 4. Asynchronous processing
    try {
      console.log(`Processing event ${eventId}(${eventType})`);
      
      const stateResult: StateDecision = await validateState(eventType, paymentId);
      
      // 1. Save Payment Record for history
      if (stateResult.decision === 'VALID_FAILURE' || stateResult.decision === 'ALREADY_CAPTURED' || stateResult.decision === 'VALID_CAPTURE') {
        await prisma.paymentRecord.upsert({
          where: { paymentId },
          update: {},
          create: {
            paymentId,
            contact: stateResult.livePayment.contact,
            email: stateResult.livePayment.email,
            amount: stateResult.livePayment.amount,
            currency: stateResult.livePayment.currency,
            method: stateResult.livePayment.method,
            status: stateResult.livePayment.status,
          }
        });
      }

      // 2. --- CLOSE THE LOOP: Intercept successful recovery payments FIRST ---
      if (stateResult.decision === 'VALID_CAPTURE') {
        const notes = stateResult.livePayment.notes;
        const recoveryCaseId = notes?.revive_recovery_case_id;

        if (recoveryCaseId) {
          console.log(`🔔 Recovery payment detected for Case ${recoveryCaseId}! Closing the loop...`);
          
          await prisma.recoveryCase.update({
            where: { id: parseInt(recoveryCaseId) },
            data: { status: 'AUTO_RECOVERED' as any }
          });

          await prisma.recoveryAttempt.updateMany({
            where: { recoveryCaseId: parseInt(recoveryCaseId) },
            data: { status: 'SUCCESS' as any }
          });

          console.log(`🎉🎉 LOOP CLOSED! Case ${recoveryCaseId} is now AUTO_RECOVERED!`);
        } else {
          console.log('✅ Normal payment captured (no recovery notes). Ignoring.');
        }

        await prisma.webhookEvent.update({
          where: { id: newEvent.id },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
        return; // Stop processing! Do not create a new RecoveryCase for a successful payment.
      }

      // 3. --- Normal Failed Payment Flow ---
      const recoveryCase = await createRecoveryCase(newEvent.id, paymentId, stateResult);

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

      if (stateResult.decision !== 'VALID_FAILURE') {
        console.error('System Error: Case is OPEN but state is not VALID_FAILURE. Aborting.');
        return;
      }

      console.log(`➡️ Recovery Case ${recoveryCase.id} OPEN. Proceeding to Context Aggregation...`);

      const context = await aggregateContext(stateResult.livePayment);
      console.log(`Context built for ${context.payment.id}. Real facts extracted.`);

      await prisma.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: { status: 'AI_PROCESSING' }
      });

      console.log("🧠 Sending clean context to Groq AI for diagnosis...");
      const aiService = new AIAnalystService();
      const aiResult = await aiService.analyzeFailure(context);
      console.log("🤖 AI Recommendation:", aiResult);
      
      await prisma.aIAnalysis.upsert({
        where: { recoveryCaseId: recoveryCase.id },
        update: {
          diagnosis: aiResult.diagnosis,
          evidence: aiResult.evidence,
          recommendedAction: aiResult.recommended_action,
          riskLevel: aiResult.risk_level,
          model: 'openai/gpt-oss-20b'
        },
        create: {
          recoveryCaseId: recoveryCase.id,
          diagnosis: aiResult.diagnosis,
          evidence: aiResult.evidence,
          recommendedAction: aiResult.recommended_action,
          riskLevel: aiResult.risk_level,
          model: 'openai/gpt-oss-20b'
        }
      });

      await prisma.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: {
          aiDiagnosis: aiResult.diagnosis,
          aiAction: aiResult.recommended_action
        }
      });

      console.log("⚖️ Evaluating Policy Engine...");
      const policyResult = await evaluatePolicy(recoveryCase.id, paymentId, aiResult);
      
      console.log(`Policy Decision: ${policyResult.decision} - ${policyResult.reason}`);

      if (policyResult.decision === 'BLOCK') {
        await prisma.recoveryCase.update({
          where: { id: recoveryCase.id },
          data: { status: 'BLOCKED', policyDecision: 'BLOCK' }
        });
        console.log(`🛑 Pipeline stopped by Policy Engine. Case marked as BLOCKED.`);
      } else if (policyResult.decision === 'HUMAN') {
        await prisma.recoveryCase.update({
          where: { id: recoveryCase.id },
          data: { status: 'PENDING_HUMAN_REVIEW', policyDecision: 'HUMAN' }
        });
        console.log(`👤 Escalated to HUMAN review by Policy Engine.`);
      } else {
        // AUTO: Transition to PENDING_EXECUTION
        await prisma.recoveryCase.update({
          where: { id: recoveryCase.id },
          data: { 
            status: 'PENDING_EXECUTION', 
            policyDecision: 'AUTO'
          }
        });
        console.log("✅ Policy Engine authorized AUTONOMOUS execution. Case marked as PENDING_EXECUTION.");
        
        // --- EXECUTION LAYER WITH ATOMIC LOCK & DUPLICATE CHECK ---

        const lockResult = await prisma.recoveryCase.updateMany({
          where: { id: recoveryCase.id, status: 'PENDING_EXECUTION' },
          data: { status: 'EXECUTING' }
        });

        if (lockResult.count === 0) {
          console.log(`⚠️ Concurrency Control: Case ${recoveryCase.id} is already being executed. Aborting.`);
          return;
        }

        const existingAttempt = await prisma.recoveryAttempt.findUnique({
          where: { recoveryCaseId: recoveryCase.id }
        });

        if (existingAttempt) {
          console.log(`⚠️ Duplicate Execution Prevented: Attempt already exists for Case ${recoveryCase.id}.`);
          await prisma.recoveryCase.update({
            where: { id: recoveryCase.id },
            data: { status: 'RECOVERY_LINK_CREATED' }
          });
          return;
        }

        const executor = new ExecutionLayer();
        const executionResult = await executor.executeAction(stateResult.livePayment, aiResult, recoveryCase.id);

        await prisma.recoveryAttempt.create({
          data: {
            recoveryCaseId: recoveryCase.id,
            action: aiResult.recommended_action,
            razorpayLinkId: executionResult.razorpayResponse?.id || null,
            recoveryUrl: executionResult.razorpayResponse?.short_url || null,
            status: executionResult.success ? 'LINK_CREATED' : 'FAILED',
            errorMessage: executionResult.error || null
          }
        });

        if (executionResult.success) {
          await prisma.recoveryCase.update({
            where: { id: recoveryCase.id },
            data: { status: 'RECOVERY_LINK_CREATED' }
          });
          console.log(`🔗 Recovery Link saved to DB. Case ${recoveryCase.id} marked as RECOVERY_LINK_CREATED. Awaiting customer payment...`);
        } else {
          await prisma.recoveryCase.update({
            where: { id: recoveryCase.id },
            data: { status: 'FAILED' }
          });
          console.log(`⚠️ Execution failed. Case ${recoveryCase.id} marked as FAILED.`);
        }
      }

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

// API Route for the Dashboard
app.get("/api/cases", async (req: Request, res: Response) => {
  try {
    const cases = await prisma.recoveryCase.findMany({
      include: {
        aiAnalysis: true,
        recoveryAttempt: true,
      },
      orderBy: {
        createdAt: 'desc',
      }
    });
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));