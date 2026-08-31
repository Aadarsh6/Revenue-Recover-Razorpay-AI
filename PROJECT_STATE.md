# Revive AI — Project Context

## 1. Project Goal

Project: Revive AI
Buildathon: Razorpay Buildathon 2026
Track: Track 3 — AI Revenue Recovery

Core promise:
Recover more revenue without creating new financial risk. 

Golden rule:
AI recommends → Policy Engine decides → Razorpay API executes.

Deadline:
September 4, 2026

Primary objective:
Build a technically credible, working Razorpay-integrated AI revenue
recovery agent that can demonstrate real Test Mode recovery flows,
safe automation, human escalation, and measurable evaluation.

---

## 2. Locked Scope

We are building an event-driven backend agent that handles:

- payment.failed
- invoice.expired
- invoice.partially_paid

Recovery actions:

- Create Standard Razorpay Payment Link
- Configure available checkout methods
- Send Invoice Notification
- Human review
- No action / block

We are NOT currently building:

- Settlement reconciliation
- Fraud detection
- Refund automation
- WhatsApp integration
- RAG
- Vector database
- LangChain
- Microservices
- ML recovery-probability model
- Production-scale infrastructure

Avoid scope creep unless explicitly reconsidered.

---

## 3. Architecture

Razorpay
↓
Webhook ingestion
↓
Signature verification
↓
Event ID + idempotency
↓
State validation
↓
Recovery Case
↓
Context Aggregator
↓
Groq AI Analyst
↓
Deterministic Policy Engine
↓
AUTO / HUMAN REVIEW / BLOCK
↓
Razorpay API
↓
Webhook verification
↓
Recovery confirmed
↓
Audit Log
↓
React Dashboard

Golden rule:

AI recommends.
Policy Engine decides.
Razorpay API executes.

---

## 4. Security / Reliability Requirements

Must implement:

- Razorpay webhook signature verification
- Event ID deduplication
- Database uniqueness for event IDs
- Explicit payment/invoice state transitions
- Protection against out-of-order events
- Duplicate recovery prevention
- Re-check Razorpay state before financial execution
- Audit logging
- AI output schema validation
- Policy validation before every financial action

If Razorpay state conflicts with AI/context:
Razorpay state wins.

If state is ambiguous:
Do not execute financial action.
Escalate to human review.

---

## 5. AI Analyst

AI provider:
Groq

AI role:
Analysis and recommendation only.

AI output must be structured JSON containing:

- diagnosis
- evidence
- recommended_action
- risk_level

Example:

{
  "diagnosis": "payment_method_mismatch",
  "evidence": [
    "4 previous successful UPI payments",
    "0 previous successful card payments"
  ],
  "recommended_action": "CREATE_RECOVERY_LINK",
  "risk_level": "LOW"
}

Do NOT ask the LLM to generate recovery probabilities.

Do NOT allow the LLM to directly call Razorpay APIs.

---

## 6. Policy Engine

Implemented in deterministic TypeScript/Node.js.

Allowed actions initially:

- CREATE_RECOVERY_LINK
- SEND_REMINDER
- HUMAN_REVIEW
- NO_ACTION

Before execution verify:

- action is allowed
- entity is still recoverable
- payment/invoice state is current
- amount is still outstanding
- no successful payment already exists
- no duplicate recovery action exists
- requested action is compatible with current state

Routing:

SAFE → AUTO EXECUTE
AMBIGUOUS → HUMAN REVIEW
INVALID / CONFLICTING → BLOCK

---

## 7. Razorpay APIs

Primary APIs:

- Payments
- Invoices
- Standard Payment Links
- Payment Link checkout-method customization
- Webhooks

Important constraint:

Do NOT use the separate UPI Payment Link API because it is not supported with Razorpay Test API keys.

Use Standard Payment Links and configure checkout methods instead.

Before building the full system, validate:

Standard Payment Link creation
→ Test payment
→ payment_link.paid webhook
→ backend verification
→ database recovery update

---

## 8. Demo Cases

### Case 1 — WIN

payment.failed
→ customer payment history
→ AI detects payment-method mismatch
→ Policy approves
→ Standard Payment Link
→ test payment
→ payment_link.paid
→ revenue recovered

### Case 2 — ASSIST

invoice.partially_paid
→ outstanding balance detected
→ AI recommends reminder
→ Policy validates
→ Invoice Notification sent
→ case updated

### Case 3 — GUARD

payment.failed + payment.captured conflict
→ inconsistent state
→ Policy blocks
→ no financial action
→ human review

---

## 9. Evaluation

Synthetic evaluation dataset.

Metrics:

1. Decision Accuracy
2. Automation Rate
3. Unsafe-Action Rate
4. Human Review / Exception Rate

Do not invent metric values beforehand.

Report actual measured results.

Target:
0 unsafe financial actions in evaluation set.

---

## 10. Tech Stack

Backend:
Node.js + Express + TypeScript

Database:
PostgreSQL + Prisma

AI:
Groq API + structured output

Frontend:
React + TypeScript + TailwindCSS

Webhook development:
ngrok

Payments:
Razorpay Test Mode

---

## 11. Current Progress

Status:
PROJECT JUST STARTED

Current milestone:
Architecture finalized.

Next milestone:
Validate Razorpay Test Mode end-to-end.

First task:

Create Standard Payment Link
→ configure checkout methods
→ perform test payment
→ receive payment_link.paid webhook
→ verify signature
→ persist event
→ mark recovery case as recovered.

Do not start dashboard development before the core Razorpay webhook/payment loop is validated.

---

## 12. Development Rules

Prioritize in this order:

1. Razorpay integration
2. Webhook reliability
3. Database/state management
4. Policy Engine
5. AI Analyst
6. Recovery execution
7. Audit trail
8. Dashboard
9. Evaluation
10. Demo/polish

Build working backend functionality before UI polish.

Do not add technologies just because they are popular.

Prefer simple deterministic implementations.

When making architectural decisions, preserve:
- financial safety
- idempotency
- explainability
- testability
- hackathon deadline

---

## 13. Important Project Philosophy

This is NOT an "AI chatbot for payments."

This is NOT an LLM wrapper around Razorpay APIs.

The core engineering differentiator is:

AI reasoning
+
deterministic financial guardrails
+
event-driven Razorpay integration
+
verified recovery
+
auditability.

The goal is safe automation, not maximum automation.