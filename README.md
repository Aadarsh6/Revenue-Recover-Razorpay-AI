The important distinction is simple:

The LLM can recommend an action. It cannot authorize one.

AI provides intelligence. Deterministic code provides authority.

Why the architecture is intentionally conservative

Autonomous systems that touch money should not fail open.

Revive therefore separates reasoning from authority.

1. Zero-trust payment state

A webhook is treated as a trigger, not as the source of truth.

Revive re-fetches the payment directly from Razorpay before making a recovery decision.

A second live fetch occurs during policy evaluation, immediately before authorization. The execution layer uses that freshly fetched state rather than the original webhook-era data.

This protects against situations such as:

payment.failed webhook
        │
        ▼
payment is captured elsewhere
        │
        ▼
recovery is about to be authorized
        │
        ▼
fresh Razorpay state checked
        │
        ▼
      BLOCK

A human can override risk appetite.

Nobody — not even a human — can override state safety.

2. Economic floor before AI

Not every failed payment is worth spending resources to recover.

For example:

        ₹5 payment
             │
             ▼
   below configured ₹100 floor
             │
             ▼
           BLOCK
             │
             ▼
       AI is never called

This is enforced before the AI layer.

Floor-blocked cases have no AIAnalysis record, providing direct evidence that the model was never consulted.

The floor is not just about LLM cost. In a production system, recovery also has gateway costs, review costs, customer-friction costs, and the cost of repeatedly contacting customers.

The threshold is configurable rather than hard-coded as a universal business rule.

3. Hard rules the AI cannot override

The model's output is never accepted blindly.

For example, a customer with no successful payment history is escalated to human review regardless of whether the model considers the action low risk.

The policy matrix is code.

The prompt is not a security boundary.

4. At-most-once execution

Money movement is protected at the database layer.

Execution requires an atomic claim:

UPDATE ...
WHERE status = <expected_status>

Only the pipeline that successfully claims the case can execute the recovery action.

A unique database constraint on RecoveryAttempt provides another layer of protection against duplicate execution.

5. Fail-safe defaults

Uncertainty never becomes permission.

Examples:

AI unavailable
    → HUMAN

Malformed AI output
    → HUMAN

Razorpay state cannot be verified
    → BLOCK / safe escalation

Unexpected execution failure
    → FAILED

Unsafe live payment state
    → BLOCK

The system is designed so that an error stops the money-moving path rather than bypassing it.

6. Webhook idempotency

Razorpay webhook deliveries are identified using the webhook event ID and protected by a database uniqueness constraint.

A replay of an already-processed event is absorbed rather than creating another recovery pipeline.

This was also verified through a real webhook followed by a replay of the same event.

7. Recovery has a real lifecycle

Creating a payment link is not considered recovery.

A recovery case remains open until either:

customer pays
    ↓
payment.captured
    ↓
AUTO_RECOVERED

or:

recovery opportunity expires
    ↓
payment_link.expired
    ↓
RECOVERY_EXPIRED

Recovery links use Razorpay's expiry mechanism through expire_by.

The concurrency test found a real bug

This was one of the most important engineering moments in the project.

We deliberately sent five concurrent, correctly signed payment.failed webhooks for the same payment.

The test initially exposed a real race condition in our own state-management logic.

An unconditional intermediate status transition allowed a losing pipeline to temporarily move the case forward again after another pipeline had already claimed it.

The system's final defenses prevented duplicate money movement, but the test exposed that the state machine itself was not sufficiently atomic.

We fixed the root cause rather than relying on the last line of defense.

Every consequential status transition was changed to a conditional atomic update:

UPDATE ... WHERE status = expected_status

Then we ran the storm again.

Final result
5 concurrent pipelines
        │
        ├── 1 case created
        ├── 4 other pipelines encountered the same case
        │
        ▼
4 reached the policy path
        │
        ├── 4 independent AI analyses → AUTO
        │
        ▼
1 atomic execution claim won
        │
        ├── 3 pipelines aborted
        │
        ▼
1 recovery attempt
        │
        ▼
1 unique Razorpay payment link
        │
        ▼
0 duplicate executions

The test didn't just prove the lock worked.

The test changed the implementation and made the system safer.

We test our safety claims by trying to break them.

Verified scenarios

The core recovery scenarios were exercised against a real Razorpay test-mode account. Concurrency, replay, and failure paths were additionally verified with controlled tests.

WIN — Autonomous recovery

Test: Failed payment → AI → AUTO → Razorpay link → customer payment

Result: AUTO_RECOVERED

HUMAN — Safe escalation

Test: Zero-history hard rule

Result: PENDING_HUMAN_REVIEW

GUARD — Race condition

Test: payment.failed webhook while live state is already captured

Result: BLOCKED — no AI call, no money moved

FLOOR — Economic gate

Test: ₹5 payment below the ₹100 recovery floor

Result: BLOCKED — AI skipped

EXPIRY — Lifecycle

Test: Recovery link reaches its TTL

Result: RECOVERY_EXPIRED

CONCURRENCY STORM

Test: 5 concurrent signed webhooks for the same payment

Result: 1 attempt, 0 duplicate links

EXECUTION FAILURE

Test: Razorpay API failure during execution

Result: FAILED — error persisted safely

DUPLICATE WEBHOOK

Test: Replay of an already processed event

Result: Duplicate absorbed

Evidence

Captured evidence for the key adversarial tests is kept in the repository.

Concurrency storm
Execution failure
Duplicate webhook absorption

The evidence files are intended to make the safety claims inspectable rather than relying only on README descriptions.

Real Razorpay integration

Revive is not a simulated payment-recovery demo.

The recovery path uses actual Razorpay test-mode infrastructure:

Real Razorpay payment links
Real Razorpay webhooks
Real HMAC signature verification
Real payment.captured events
Real payment_link.expired lifecycle events
Live payment-state fetches through the Razorpay API
Recovery traceability embedded in Razorpay payment-link notes

Recovery links contain identifiers such as:

revive_recovery_case_id
original_failed_payment_id

This lets the eventual payment.captured webhook be associated with the correct recovery case without introducing another tracking service.

The AI also works with real application data:

Razorpay payment failure information
Actual failure reason / step / source
Customer history from the local payment ledger
Previous successful payment methods
Previous recovery actions

There is no mock customer history feeding the decision.

The AI's role

The AI Analyst produces a structured recommendation:

Diagnosis
Evidence
Recommended action
Risk level

The output is strictly validated against allowed actions and risk levels.

The model used is:

openai/gpt-oss-20b

via the Groq API.

A useful way to think about the architecture is:

        AI
        │
        ├── understands the failure
        ├── gathers meaning from context
        └── recommends an intervention
                 │
                 ▼
        Policy Engine
        │
        ├── applies hard rules
        ├── checks risk
        ├── verifies live state again
        └── authorizes AUTO / HUMAN / BLOCK
                 │
                 ▼
        Execution Layer
        │
        └── performs the allowed Razorpay action

The AI is an advisor, not an authority.

Operations console

Revive includes a live operations console built around the same decision model as the backend.

It is not just a dashboard.

The UI makes the system's reasoning and safety boundaries visible.

Decision trace

Each case exposes the progression through:

Webhook
    ↓
State validation
    ↓
AI analysis
    ↓
Policy decision
    ↓
Execution
    ↓
Recovery outcome

When a guard fires, the chain visibly stops at the layer that made the decision.

Audit timeline

Every consequential event is recorded chronologically with its metadata, allowing an operator to reconstruct what happened and why.

Honest reason cards

Blocked and escalated cases display the actual reason produced by the backend audit trail rather than hard-coded frontend explanations.

Policy Rules

The frontend exposes the active policy configuration so the operator can see the rules governing autonomous decisions.

The console also includes
Live polling
Case/status filters
Recovery links
Financial impact
New-case feedback
Per-case decision traces
Audit timelines
<!-- Add the real screenshot once it exists in the repository. --> <!-- ![Case decision trace and audit timeline](docs/evidence/case-trace.png) -->
Auditability

Every consequential stage leaves an auditable trail.

WEBHOOK_RECEIVED
        ↓
STATE_VALIDATED
        ↓
RECOVERY_CASE_CREATED
        ↓
AI_ANALYSIS_COMPLETED
        ↓
POLICY_DECIDED
        ↓
RECOVERY_LINK_CREATED
        ↓
RECOVERY_PAYMENT_CAPTURED
        ↓
LOOP_CLOSED

This matters because an autonomous money-moving system should be able to answer:

What happened?
Why did it happen?
Which rule allowed it?
What was the live payment state at the time?
Did the customer actually pay?
Financial accounting

AI usage is tracked from the actual token usage returned by the model API.

For the demonstrated recovery:

Gross recovered       ₹500.000
AI compute cost        ₹0.018
──────────────────────────────
Net recovery value    ₹499.982

The dashboard rounds the AI cost to ₹0.02 for display.

The important point is that recovery economics are measured separately from the AI recommendation itself.

Engineering highlights

A few implementation details are worth calling out:

Timing-safe webhook signature comparison using crypto.timingSafeEqual
HMAC SHA-256 verification over the raw webhook body
Database-backed webhook idempotency
Live Razorpay state validation before policy evaluation
A second live-state fetch immediately before authorization
Conditional atomic state transitions
Database uniqueness protection on recovery attempts
Strict validation of AI output
Fail-safe handling of AI/API failures
Paise-precision financial calculations
Persisted token usage and AI cost accounting
Recovery-case lifecycle tracking
Boot-time cleanup of orphaned transient states
Crash-tolerant concurrent upserts
Explicit handling of unexpected webhook payload shapes
Environment-gated development tools
Tech stack
Backend
Node.js
TypeScript
Express
Prisma
PostgreSQL
AI
Groq API
openai/gpt-oss-20b
Payments
Razorpay Node SDK
Razorpay Webhooks
Razorpay Payment Links
Frontend
React
Vite
TypeScript
Tailwind CSS
Repository structure
revive-ai/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── package.json
│   └── PROJECT_STATE.md
│
├── docs/
│   └── evidence/
│       ├── concurrency-storm.txt
│       ├── execution-failure.txt
│       └── duplicate-webhook.txt
│
├── .gitignore
└── README.md

The frontend and backend were developed as separate repositories and combined here for a single, complete project submission. Their development histories are preserved.

Run locally
Prerequisites
Node.js
PostgreSQL
Razorpay test-mode account
Groq API key
1. Clone
git clone https://github.com/Aadarsh6/Revenue-Recover-Razorpay-AI.git
cd Revenue-Recover-Razorpay-AI
2. Backend
cd backend
npm install

Create a .env file:

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

GROQ_API_KEY=

DATABASE_URL=

MIN_RECOVERY_AMOUNT_PAISE=10000
RECOVERY_LINK_TTL_MINUTES=60

ESTIMATED_COST_PER_1K_TOKENS_INR=

SKIP_SIGNATURE_VALIDATION=false

Configure PostgreSQL and run the Prisma migrations/generation required by the project.

Then start the backend:

npm run dev
3. Frontend

In another terminal:

cd frontend
npm install
npm run dev

The frontend will connect to the running backend API.

Never commit .env files or API credentials. The root .gitignore excludes environment files from Git.

Design principles

Revive is built around a few simple rules.

Webhooks trigger investigation. Live APIs establish truth.

A webhook tells us that something happened.

Razorpay's live API tells us what the payment actually is now.

AI provides intelligence. Code provides authority.

The model can reason about a payment failure.

It cannot authorize money movement.

Uncertainty stops execution.

If state, AI output, or execution cannot be trusted, the system does not guess.

Recovery is not link creation.

A recovery opportunity is only closed when the customer's payment is actually captured.

Concurrency is part of correctness.

If two workers can execute the same recovery, the system is not safe.

Revive therefore treats race conditions and duplicate execution as correctness problems, not edge cases.

Current limitations

Revive is a buildathon system, not a production payment-recovery platform.

The current implementation intentionally leaves several production extensions for future work:

Complete human-review resolution flow
Runtime stale-lock recovery/sweeper
More robust phone/contact normalization
Batch evaluation harness for measuring policy performance across larger datasets
Further production deployment and distributed-worker hardening

The current human-review path pauses safely rather than silently falling through to autonomous execution.

Built for Razorpay Buildathon — Track 3

Revive AI was built for AI Revenue Recovery:

Find revenue that is slipping away and win it back.

The project focuses on the difficult part of autonomous revenue recovery: not simply identifying a failed payment, but deciding when recovery is worth attempting, what intervention is appropriate, and when the system must stop.

The result is an autonomous recovery pipeline where:

AI recommends
    ↓
Policy constrains
    ↓
Database guarantees execution ownership
    ↓
Razorpay performs the payment action
    ↓
Webhook confirms the outcome

Revenue recovery with intelligence — without giving the AI unrestricted authority over money.