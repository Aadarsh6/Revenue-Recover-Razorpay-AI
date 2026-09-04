Testing & Verification Record
All results below are from real runs against a Razorpay test-mode account with livewebhooks, live state fetches, and real payment links. Raw terminal output for theadversarial tests is preserved in docs/evidence/.

Environment
Backend: Node.js + Express + TypeScript, Prisma + PostgreSQL
Razorpay: test-mode keys; webhook configured with payment.failed, payment.captured, payment_link.expired subscribed
AI: Groq (openai/gpt-oss-20b)
Test customers: one seeded identity with 5 captured historical payments (PaymentRecord ledger), plus fresh identities for zero-history cases
Scenario matrix
#	Scenario	Mechanism under test	Expected	Actual	Status
1	WIN — autonomous recovery	Full happy path: real webhook → AI → AUTO → real link → real capture	AUTO_RECOVERED, loop closed	AUTO_RECOVERED; timeline ends RECOVERY_PAYMENT_CAPTURED → LOOP_CLOSED; recoveredAt stamped	✅
2	HUMAN — safe escalation	Zero-history hard rule overrides AI risk	PENDING_HUMAN_REVIEW, no action	PENDING_HUMAN_REVIEW; policy reason persisted to audit trail	✅
3	GUARD — race condition	Failed webhook for an already-captured payment	BLOCKED at state validation, no AI call	BLOCKED; timeline shows STATE_VALIDATED decision ALREADY_CAPTURED; no AIAnalysis row	✅
4	FLOOR — economic gate	₹5 payment below ₹100 floor	BLOCKED before AI call	BLOCKED; no AI line in logs; no AIAnalysis row; zero tokens	✅
5	EXPIRY — lifecycle	Recovery link TTL elapses, unpaid	RECOVERY_EXPIRED via payment_link.expired	Event received at exactly created+TTL; conditional transition applied	✅
6	CONCURRENCY STORM	5 concurrent signed webhooks, same payment, distinct event IDs	1 attempt, 0 duplicates	1 attempt, 1 unique link, 0 duplicate executions	✅
7	EXECUTION FAILURE	Razorpay API rejects the link creation	FAILED, error persisted	FAILED; errorMessage persisted on RecoveryAttempt	✅
8	DUPLICATE WEBHOOK	Replay of an already-processed event ID	Second delivery absorbed	{"status":"duplicate ignored"} (P2002 on unique constraint)	✅
9	NORMAL CAPTURE — no false case	A payment.captured with no recovery notes	No recovery case created	Normal payment captured (no recovery notes). Ignoring. — no case created	✅
10	NORMAL CAPTURE — loop close	A payment.captured with recovery notes	Correct case closes	Correct case → AUTO_RECOVERED; other cases untouched	✅
Scenario 10 verifies that loop-closing matches the recovery case by the notes embedded in the payment link, not by customer identity — two different customers paying two different links cannot cross-close cases.

Adversarial test procedures
Concurrency storm (scenario 6)
Setup: backend running; ngrok/tunnel stopped so Razorpay's real webhook cannot pre-empt the test; a fresh ₹500 payment failed with the seeded customer identity; verified no RecoveryCase exists for the payment yet.

Action: 5 payment.failed webhooks fired simultaneously at the backend — identical payload, correctly signed, distinct event IDs (so ingestion accepts all 5 and the contention is resolved by the execution claim, not by ingestion idempotency).

Result (Case 11):

  Final status          : RECOVERY_LINK_CREATED  Recovery attempts     : 1  Unique Razorpay links : 1  Duplicate executions  : ✅ 0
Pipeline funnel observed in logs:

5 webhooks ingested (all signature-verified)
1 RecoveryCase created; the other 4 pipelines safely attached to the same case
4 pipelines reached the policy engine; 4 independent AI analyses, all → AUTO
1 atomic claim won (AI_PROCESSING → PENDING_EXECUTION); 3 pipelines aborted with already claimed by another pipeline
1 execution → 1 link; the later real Razorpay webhook for the same payment was absorbed against the terminal status
Note — this test found a real bug on its first run (an unconditional intermediate transition let a losing pipeline resurrect the case status). Fixed by converting every consequential transition to a conditional atomic update, then re-verified. Full before/after logs: docs/evidence/concurrency-storm.txt.

Execution failure (scenario 7)
Mechanism: during a test run with a sub-minimum link TTL, Razorpay rejected the payment_link.create call (expire_by: timestamp must be atleast 15 minutes in future).

Result: case → FAILED, error message persisted on the RecoveryAttempt, webhook event marked PROCESSED, no partial state left behind. The discovery also produced a fix: the execution layer now clamps TTL to Razorpay's documented 15-minute minimum.Log: docs/evidence/execution-failure.txt.

Duplicate webhook (scenario 8)
Procedure: same signed payload, same event ID, delivered twice.

Result: first delivery processed; second returned {"status":"duplicate ignored"} before any pipeline work.Log: docs/evidence/duplicate-webhook.txt.

Guard-logic verification (policy-level)
These were verified as part of scenarios 1–4, and are stated explicitly because they are the invariants that make autonomous execution safe:

Invariant	How it manifests
Webhook payload never trusted as truth	Every decision path fetches live state from Razorpay first
Second live fetch immediately before authorization	Policy engine re-fetches; execution uses that fresh payment object
Zero-history ⇒ human review, regardless of AI risk	Hard rule in policy engine; fired even when AI itself said HIGH
Floor-blocked ⇒ model never consulted	No AIAnalysis row exists for floor-blocked cases (DB-verifiable)
AI output out-of-bounds ⇒ ESCALATE_HUMAN	Strict validation with fail-safe default
Unverifiable live state ⇒ human review	Observed live: invalid payment ID → API_ERROR → PENDING_HUMAN_REVIEW, no action
Human/escalation paths cannot bypass state safety	Policy guard rules are non-overridable by design
Demo reset procedure (used before the recorded run)
# Wipe all tables, reset identity countersecho 'TRUNCATE TABLE "AuditLog", "RecoveryAttempt", "AIAnalysis", "RecoveryCase", "WebhookEvent", "PaymentRecord" RESTART IDENTITY CASCADE;' | npx prisma db execute --stdin# Re-seed customer payment historynpx tsx src/scripts/seedHistory.ts
Then the scenarios are re-run in narrative order: WIN → HUMAN → GUARD → FLOOR.

All results in this file are from real executions against Razorpay test mode on September 3–4, 2026. Raw logs are committed under docs/evidence/ so every safety claim in the README can be inspected rather than taken on faith.

