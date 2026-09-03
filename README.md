# Contractor OS

**The operating system for handyman and small contractor businesses.**

One place to run the whole revenue workflow — lead → estimate → approval →
schedule → field work → invoice → payment → profit — without re-entering the
same job three times across separate tools.

This repository is the **Phase 1 MVP**: the core revenue loop, built to be
genuinely usable end-to-end, not a collection of half-wired screens. Phase 2/3
features from the product spec (change orders, customer-review automation,
QuickBooks sync, AI assistance, etc.) have their data models in place but no
UI yet — see [Scope](#scope--whats-phase-1-vs-later) below.

## Tech stack

- **Next.js 16** (App Router, Server Actions, Turbopack)
- **TypeScript**, strict mode
- **PostgreSQL** + **Prisma 6** (`prisma-client-js`)
- **NextAuth v5** (Credentials provider, JWT sessions)
- **Tailwind CSS v4** + **shadcn/ui** (Base UI primitives)
- Provider-agnostic adapters for SMS, email, payments, and file storage —
  each has a working **development implementation** (console-logged
  messages, a simulated checkout page) so the whole app runs with zero
  external API keys, plus a real implementation ready to activate by setting
  environment variables.

## Getting started

### 1. Prerequisites

- Node.js 20.9+
- A PostgreSQL 14+ database

### 2. Install

```bash
npm install
cp .env.example .env
# edit .env — at minimum set DATABASE_URL to point at your Postgres instance
```

### 3. Create the database schema

```bash
npx prisma migrate dev
```

### 4. Seed demo data

```bash
npm run db:seed
```

This creates a demo company ("Greenwood Handyman Co.") with a price book,
customers, leads in every pipeline stage, estimates at every stage of the
follow-up lifecycle (including one carried all the way through to a paid,
completed job), and a couple of scheduled jobs. Sign in with any of:

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@greenwoodhandyman.example` | `password123` |
| Estimator | `estimator@greenwoodhandyman.example` | `password123` |
| Office | `office@greenwoodhandyman.example` | `password123` |
| Technician | `john@greenwoodhandyman.example` | `password123` |
| Technician | `mike@greenwoodhandyman.example` | `password123` |

Sign in as a technician to see the simplified mobile field view; every other
role lands on the full office dashboard.

Alternatively, skip seeding and use **Sign up → Set up your company**, which
offers to load the same sample data into your brand-new company.

### 5. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`.

### Quality checks

```bash
npx tsc --noEmit     # type check
npm run lint         # eslint
npm run build        # production build
```

## Architecture

### Multi-tenancy

Every tenant-owned table carries a `companyId`. The **only** sanctioned way to
read the current tenant is `requireSession()` in `src/lib/session.ts` — it
resolves the signed-in user's active company from their `CompanyMember` rows
(a cookie remembers which company is active if they belong to more than one)
and every query in the app is expected to filter by the `companyId` it
returns. There is no cross-tenant lookup path.

### Money

All currency math happens in **integer cents** (`src/lib/money.ts`,
`src/lib/estimate-calc.ts`) — never floating-point dollars — and Postgres
`numeric`/Prisma `Decimal` columns store the persisted amounts. Markup
(profit ÷ cost) and margin (profit ÷ price) are computed and labeled
separately; the estimator surfaces both plus warnings when a price falls
below the company's target margin.

### The estimate → job → actuals feedback loop

This is the product's central mechanic (`src/lib/estimate-to-job.ts`,
`src/lib/job-costing.ts`, `src/lib/invoice-generation.ts`):

```
Estimate (quoted labor/material/price)
  → Job (created from the approved estimate, no re-entry)
    → actual time entries + actual materials logged in the field
      → JobCost (actual vs. quoted, computed on completion)
        → Invoice (line items inherited from the estimate)
          → Payment
```

The Reports → Service Profitability and Labor & Material Variance tabs
aggregate this actual-vs-quoted data across completed jobs, which is exactly
the input a real "should we raise our price on this service" decision needs.

### Provider adapters (`src/lib/adapters/`)

| Concern | Interface | Dev implementation | Real implementation |
| --- | --- | --- | --- |
| SMS | `SmsProvider` | logs to console | Twilio REST API (set `TWILIO_*`) |
| Email | `EmailProvider` | logs to console | Resend API (set `RESEND_API_KEY`) |
| Payments | `PaymentProvider` | `/pay/dev` simulated checkout | Stripe Checkout Sessions (set `STRIPE_SECRET_KEY`) |
| File storage | `StorageProvider` | local disk under `/public/uploads` | S3 (implement `S3StorageProvider.save`) |

Business logic never imports a concrete provider — it calls
`getSmsProvider()` / `getPaymentProvider()` / etc., which pick an
implementation based on which environment variables are set. No code changes
are needed to go from "demo mode" to "live" once credentials are configured.

Because there's no background job queue, the estimate follow-up sequence and
post-payment review requests are **scheduled** as rows with a future
`scheduledAt`/delay and picked up by a "process due" sweep
(`processDueFollowUps`, `processDueReviewRequests` in
`src/lib/automations.ts`) — triggerable from the Estimate Recovery Center's
"Run due follow-ups now" button, or by pointing an external cron at
`/api/cron/run-automations` (add a shared-secret check there before exposing
it publicly).

### Payments without a card processor

`/pay/dev` is a clearly-labeled simulated checkout page reachable only when
no `STRIPE_SECRET_KEY` is configured. It mimics Stripe Checkout's redirect
flow (including honoring the `{CHECKOUT_SESSION_ID}` template Stripe uses) so
the exact same call sites (`startDepositCheckoutAction`,
`startInvoiceCheckoutAction`) work unmodified against either provider. No raw
card data is ever collected or stored; only a `providerReference` string is
persisted on the `Payment` row.

## Scope — what's Phase 1 vs. later

Every model in the master spec's database section exists in
`prisma/schema.prisma` (SOP/Checklist, Vendor/Purchase/Receipt, ChangeOrder,
Automation, Integration, AuditLog, and so on), but only the following have a
working UI in this build — this is the Phase 1 list from the spec:

Auth & multi-tenant companies · roles · customers & properties · leads & CRM
pipeline · service price book · estimate builder with live profitability ·
Good/Better/Best options · estimate sending, status, and follow-up sequence ·
Estimate Recovery Center · customer approval portal with e-signature and
deposit collection · estimate → job conversion · scheduling (technician ×
day board with capacity) · technician mobile field view · job photos ·
time/labor tracking · materials (estimated vs. actual) · job completion ·
invoicing generated from the job · payments (dev + Stripe) · estimated vs.
actual job profitability · main dashboard with "Money Sitting on the Table" ·
basic reporting.

**Deliberately not built yet** (schema is ready, matches the spec's own
Phase 2/3 phasing): change orders, the customer-facing review-automation UI,
SOP/checklist authoring and the technician skill matrix, vendor/purchase
tracking UI, QuickBooks/Google Calendar/Google Maps live sync, AI-assisted
drafting, and voice intake. Also out of scope for this build: a background
job queue (see the "process due" note above) and drag-and-drop on the
scheduling board (technician/date assignment is a form instead).

## Demonstrating the MVP success test

The spec's end-to-end acceptance scenario — fence-repair lead through paid
invoice and profit reporting — works like this in the seeded data /
live app:

1. **Leads → CRM**: `/leads` — create a lead (or use the seeded "Fence
   Repair" lead), optionally logging it as a missed call to see the
   automatic SMS reply logged to the server console.
2. **Estimate**: from the lead, "Build estimate" → add the Fence Panel
   Repair service from the price book → the profitability panel updates
   live as you adjust labor/material/markup.
3. **Send → customer portal**: "Send to customer" copies a portal link
   (`/portal/<token>`) — open it to approve, e-sign on the canvas, and pay
   the deposit through the simulated checkout.
4. **Job created automatically** — no re-entry — visible on `/jobs` and the
   `/schedule` board; assign a technician and a time slot.
5. **Field work**: sign in as a technician, open the job under
   `/field/today`, clock in, log actual materials, upload before/after
   photos, and mark the job complete.
6. **Invoice + payment**: completing the job generates the invoice
   automatically (`/invoices`); pay it via the customer invoice-portal link
   or record a manual payment.
7. **Profitability**: the job's "Profitability" tab shows quoted vs. actual
   margin; `/reports` rolls this up by service and technician; `/dashboard`
   shows the resulting revenue and gross profit.
8. **Recovery path**: an estimate nobody responds to shows up in
   `/estimates/recovery`, prioritized and ready to work like a sales queue —
   try the seeded "Deck Board Repair" estimate.
