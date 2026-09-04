import "dotenv/config";
import crypto from "crypto";
import { PrismaClient } from "../generated/prisma/client";
import prisma from "../lib/prismaClient";

// const prisma = new PrismaClient();

const CONFIG = {
  serverUrl: "http://localhost:3000/webhook/razorpay",
  paymentId: process.argv[2] ?? "",          // a REAL failed payment ID (must be live on Razorpay)
  numWebhooks: 5,
};

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET as string)
    .update(payload)
    .digest("hex");
}

async function fireConcurrentWave(): Promise<string[]> {
  const requests = Array.from({ length: CONFIG.numWebhooks }, (_, i) => {
    const payload = JSON.stringify({
      entity: "event",
      event: "payment.failed",
      payload: { payment: { entity: { id: CONFIG.paymentId } } },
    });
    const signature = sign(payload);
    return fetch(CONFIG.serverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": `evt_concurrency_${Date.now()}_${i}`, // distinct IDs, same payment
      },
      body: payload,
    }).then(r => r.text());
  });
  return Promise.all(requests);
}

async function main() {
  if (!CONFIG.paymentId) {
    console.error("Usage: npx tsx src/scripts/testConcurrency.ts <real_failed_pay_id>");
    process.exit(1);
  }

  console.log(`⚡ Firing ${CONFIG.numWebhooks} concurrent webhooks for payment ${CONFIG.paymentId}`);
  console.log(`   (distinct event IDs → ingestion accepts all; the EXECUTION LOCK must decide the winner)\n`);

  await fireConcurrentWave();
  console.log("All webhooks delivered. Waiting for pipelines to settle...\n");
  
    for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const check = await prisma.recoveryCase.findUnique({ where: { paymentId: CONFIG.paymentId } });
    if (check && !['OPEN', 'AI_PROCESSING', 'PENDING_EXECUTION', 'EXECUTING'].includes(check.status)) break;
  }

  const testCase = await prisma.recoveryCase.findFirst({
    where: { paymentId: CONFIG.paymentId },
    include: { recoveryAttempt: true, auditLogs: true },
  });

  if (!testCase) {
    console.error("❌ No recovery case found for this payment — did the webhook reach the server?");
    process.exit(1);
  }

  const attempts = await prisma.recoveryAttempt.findMany({ where: { recoveryCaseId: testCase.id } });

  console.log("═══════════════════════════════════════════════");
  console.log(`  CONCURRENCY TEST REPORT — Case ${testCase.id}`);
  console.log("═══════════════════════════════════════════════");
  console.log(`  Final status          : ${testCase.status}`);
  console.log(`  Recovery attempts     : ${attempts.length}`);
  console.log(`  Unique Razorpay links : ${new Set(attempts.map(a => a.razorpayLinkId)).size}`);
  console.log(`  Duplicate executions  : ${attempts.length > 1 ? "❌ YES — RACE CONDITION" : "✅ 0"}`);
  console.log("═══════════════════════════════════════════════");
  console.log(`\nExpected: exactly 1 attempt, 1 unique link, 0 duplicates, status RECOVERY_LINK_CREATED.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());