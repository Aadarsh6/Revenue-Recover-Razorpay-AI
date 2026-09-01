import express, { Request, Response } from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import prisma from "./lib/prismaClient";
import { PrismaClientKnownRequestError } from "./generated/prisma/internal/prismaNamespace";
import { validateState, StateDecision } from "./services/stateValidator";
import { createRecoveryCase } from "./services/recoveryCaseService";
import { aggregateContext } from "./services/contextAggregator";
import { evaluatePolicy } from "./services/policyEngine";
import { ExecutionLayer } from "./services/executionLayer";
import { logAudit } from "./services/auditLog";
import { AIAnalystService, AI_MODEL } from "./services/aiAnalyst";
// @ts-ignore
import cors from "cors";

dotenv.config();
const MIN_RECOVERY_AMOUNT_PAISE = Number(process.env.MIN_RECOVERY_AMOUNT_PAISE || 10000);
const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
}));


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

      
const skipSignatureValidation =
  process.env.SKIP_SIGNATURE_VALIDATION === "true" &&
  process.env.NODE_ENV !== "production";

if (!skipSignatureValidation) {
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedSignature, "utf8");
  const signaturesMatch =
    sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  if (!signaturesMatch) {
    console.error("Invalid signature, rejecting webhook");
    return res.status(400).send("Invalid signature");
  }
}

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return res.status(400).send("Invalid JSON");
    }

    const eventType: string = body.event;
    const paymentId: string | undefined = body.payload?.payment?.entity?.id;
    const isLinkExpiry = eventType === 'payment_link.expired';

    if (!paymentId && !isLinkExpiry) {
  // Events like payment_link.expired / refund.processed have no payment entity.
      try {
          await prisma.webhookEvent.create({
                data: { eventId, eventType, payload: body, status: "IGNORED", processedAt: new Date() },
          });
          } catch {
    // duplicate eventId — already stored
          }
            console.log(`⏭️ Event ${eventType} has no payment entity. Ignored.`);
          return res.status(200).json({ status: "event type not handled" });
        }
        let webhookAuditEntry: { id: number } | null = null;
        let stateAuditEntry: { id: number } | null = null;

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
      webhookAuditEntry = await logAudit('WEBHOOK_RECEIVED', undefined, { eventId, eventType });
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

            // ─── PAYMENT LINK EXPIRY: lifecycle close ───────────────────────
      if (isLinkExpiry) {
        const linkEntity = body.payload?.payment_link?.entity;
        const caseIdStr: string | undefined = linkEntity?.notes?.revive_recovery_case_id;

        if (caseIdStr) {
          const caseId = parseInt(caseIdStr);
          // Conditional transition: customer may have paid at the very last second
          const expired = await prisma.recoveryCase.updateMany({
            where: { id: caseId, status: 'RECOVERY_LINK_CREATED' },
            data: { status: 'RECOVERY_EXPIRED' },
          });
          if (expired.count > 0) {
            await logAudit('RECOVERY_LINK_EXPIRED', caseId, { paymentLinkId: linkEntity?.id });
            console.log(`⌛ Case ${caseId}: recovery link expired → RECOVERY_EXPIRED`);
          } else {
            console.log(`⌛ Expiry for Case ${caseId} — no longer awaiting payment (likely recovered). No-op.`);
          }
          if (webhookAuditEntry) {
            await prisma.auditLog.update({ where: { id: webhookAuditEntry.id }, data: { caseId } });
          }
        } else {
          console.log('⌛ Link expiry without revive notes — not our recovery link. Ignoring.');
        }

        await prisma.webhookEvent.update({
          where: { id: newEvent.id },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
        return;
      }
      if (!paymentId) {
        await prisma.webhookEvent.update({
          where: { id: newEvent.id },
          data: { status: "IGNORED", processedAt: new Date() },
        });
        return;
      }
      
      const stateResult: StateDecision = await validateState(eventType, paymentId);
      stateAuditEntry = await logAudit('STATE_VALIDATED', undefined, { paymentId, decision: stateResult.decision });
      
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

            await prisma.recoveryCase.update({
            where: { id: parseInt(recoveryCaseId) },
            data: { status: 'AUTO_RECOVERED', recoveredAt: new Date() }
          });

        if (recoveryCaseId) {
          console.log(`🔔 Recovery payment detected for Case ${recoveryCaseId}! Closing the loop...`);
          
          await prisma.recoveryCase.update({
            where: { id: parseInt(recoveryCaseId) },
            data: { status: 'AUTO_RECOVERED' } // Removed `as any` if Prisma is generated
          });

          await prisma.recoveryAttempt.updateMany({
            where: { recoveryCaseId: parseInt(recoveryCaseId) },
            data: { status: 'SUCCESS' } // Removed `as any`
          });

          // ✅ MOVED INSIDE THE IF BLOCK
          await logAudit('RECOVERY_PAYMENT_CAPTURED', parseInt(recoveryCaseId), { paymentId });
          await logAudit('LOOP_CLOSED', parseInt(recoveryCaseId), { status: 'AUTO_RECOVERED' });

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
      await logAudit('RECOVERY_CASE_CREATED', recoveryCase.id, { status: recoveryCase.status })
      // Attach pre-case audit entries (webhook + state validation) to this case so they appear in the timeline
        for (const entry of [webhookAuditEntry, stateAuditEntry]) {
      if (entry) {
          await prisma.auditLog.update({ where: { id: entry.id }, data: { caseId: recoveryCase.id } });
        }
      }


      if (recoveryCase.status !== 'OPEN') {
        await prisma.webhookEvent.update({
          where: { id: newEvent.id },
          data: { 
            status: ['BLOCKED', 'PENDING_HUMAN_REVIEW'].includes(recoveryCase.status) ? 'IGNORED' : 'FAILED', 
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

            // ─── Persist amount (floor input + future ROI) ───
      const amountPaise = stateResult.livePayment.amount;
      await prisma.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: { amount: amountPaise },
      });

      // ─── ECONOMIC FLOOR GATE (pre-AI, deterministic) ───
      // Recovery value below floor → AI costs more than it's worth. Skip entirely.
      if (amountPaise < MIN_RECOVERY_AMOUNT_PAISE) {
        await prisma.recoveryCase.update({
          where: { id: recoveryCase.id },
          data: { status: 'BLOCKED', policyDecision: 'BLOCK' },
        });
        await logAudit('ECONOMIC_FLOOR_BLOCKED', recoveryCase.id, {
          amount: amountPaise,
          floor: MIN_RECOVERY_AMOUNT_PAISE,
        });
        await prisma.webhookEvent.update({
          where: { id: newEvent.id },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
        console.log(`💰 ECONOMIC FLOOR: Case ${recoveryCase.id} blocked (₹${amountPaise / 100} < floor ₹${MIN_RECOVERY_AMOUNT_PAISE / 100}). AI skipped — no cost incurred.`);
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
      await logAudit('AI_ANALYSIS_COMPLETED', recoveryCase.id, { action: aiResult.recommended_action, risk: aiResult.risk_level });
      console.log("🤖 AI Recommendation:", aiResult);

      const costPer1k = Number(process.env.ESTIMATED_COST_PER_1K_TOKENS_INR || 0.01);
      const estimatedCost = aiResult.usage
        ? (aiResult.usage.totalTokens / 1000) * costPer1k
        : null;
      
      await prisma.aIAnalysis.upsert({
        where: { recoveryCaseId: recoveryCase.id },
        update: {
          diagnosis: aiResult.diagnosis,
          evidence: aiResult.evidence,
          recommendedAction: aiResult.recommended_action,
          riskLevel: aiResult.risk_level,
          model: AI_MODEL,
          promptTokens: aiResult.usage?.promptTokens ?? null,
          completionTokens: aiResult.usage?.completionTokens ?? null,
          totalTokens: aiResult.usage?.totalTokens ?? null,
          estimatedCost: estimatedCost,
        },
        create: {
          recoveryCaseId: recoveryCase.id,
          diagnosis: aiResult.diagnosis,
          evidence: aiResult.evidence,
          recommendedAction: aiResult.recommended_action,
          riskLevel: aiResult.risk_level,
          model: AI_MODEL,
          promptTokens: aiResult.usage?.promptTokens ?? null,
          completionTokens: aiResult.usage?.completionTokens ?? null,
          totalTokens: aiResult.usage?.totalTokens ?? null,
          estimatedCost: estimatedCost,
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
      const policyResult = await evaluatePolicy(recoveryCase.id, paymentId, aiResult, context.customer);
      await logAudit('POLICY_DECIDED', recoveryCase.id, { decision: policyResult.decision, reason: policyResult.reason });
      
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
      const paymentForExecution = policyResult.freshPayment ?? stateResult.livePayment;
      const executionResult = await executor.executeAction(paymentForExecution, aiResult, recoveryCase.id);

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
          await logAudit('RECOVERY_LINK_CREATED', recoveryCase.id, { url: executionResult.razorpayResponse?.short_url });
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
        auditLogs:{
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: {
        createdAt: 'desc',
      }
    });
    res.json(cases);
  } catch (error: any) {
    console.error("[API Error] Failed to fetch cases:", error);
    res.status(500).json({ error: "Failed to fetch cases", details: error.message });
  }
});


// API Route for single case details (for the frontend timeline)
app.get("/api/cases/:id", async (req: Request, res: Response) => {
  try {
    const caseId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    const recoveryCase = await prisma.recoveryCase.findUnique({
      where: { id: caseId },
      include: {
        aiAnalysis: true,
        recoveryAttempt: true,
        auditLogs: {
          orderBy: { createdAt: 'asc' }
        },
        webhookEvent: true
      }
    });
    if (!recoveryCase) return res.status(404).json({ error: "Case not found" });
    res.json(recoveryCase);
  } catch (error: any) {
    console.error("[API Error] Failed to fetch case:", error);
    res.status(500).json({ error: "Failed to fetch case", details: error.message });
  }
});

const PORT = process.env.PORT || 3000;

async function recoverOrphanedExecutions() {
  const result = await prisma.recoveryCase.updateMany({
    where: { status: 'EXECUTING' },
    data: { status: 'FAILED' },
  });
  if (result.count > 0) {
    console.log(`[Startup] Reset ${result.count} orphaned EXECUTING case(s) to FAILED.`);
    await logAudit('ORPHANED_EXECUTION_RESET', undefined, { resetCount: result.count });
  }
}

recoverOrphanedExecutions()
  .catch((e) => console.error('[Startup] Orphan recovery failed:', e))
  .finally(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });