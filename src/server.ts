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
      
      await prisma.paymentRecord.upsert({
        where: { paymentId },
        update: {},
        create: {
          paymentId,
          contact: stateResult.decision === 'VALID_FAILURE' || stateResult.decision === 'ALREADY_CAPTURED' ? stateResult.livePayment.contact : null,
          email: stateResult.decision === 'VALID_FAILURE' || stateResult.decision === 'ALREADY_CAPTURED' ? stateResult.livePayment.email : null,
          amount: stateResult.decision === 'VALID_FAILURE' || stateResult.decision === 'ALREADY_CAPTURED' ? stateResult.livePayment.amount : 0,
          currency: stateResult.decision === 'VALID_FAILURE' || stateResult.decision === 'ALREADY_CAPTURED' ? stateResult.livePayment.currency : 'INR',
          method: stateResult.decision === 'VALID_FAILURE' || stateResult.decision === 'ALREADY_CAPTURED' ? stateResult.livePayment.method : 'unknown',
          status: stateResult.decision === 'VALID_FAILURE' || stateResult.decision === 'ALREADY_CAPTURED' ? stateResult.livePayment.status : 'unknown',
        }
      });

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
        
        // --- EXECUTION LAYER ---
        const executor = new ExecutionLayer();
        const executionResult = await executor.executeAction(stateResult.livePayment, aiResult);

        if (executionResult.success) {
          await prisma.recoveryCase.update({
            where: { id: recoveryCase.id },
            data: { status: 'AUTO_RECOVERED' }
          });
          console.log(`🎉 Recovery Case ${recoveryCase.id} successfully AUTO_RECOVERED!`);
        } else {
          // If Razorpay API fails, escalate to human
          await prisma.recoveryCase.update({
            where: { id: recoveryCase.id },
            data: { status: 'PENDING_HUMAN_REVIEW' } // Override to human because execution failed
          });
          console.log(`⚠️ Execution failed. Case ${recoveryCase.id} escalated to HUMAN review.`);
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));