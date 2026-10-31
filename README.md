# Healthcare Lifeline Engine (HLE)

Connects patients facing a funding gap mid-treatment with NGOs and other funders. Zero cash goes to patients. Payments go only to verified hospital accounts.

## Product rules

1. HLE does not hold money. The funder, or a licensed escrow/trust partner, holds funds. HLE keeps the agreement, approvals, ledger and payout instructions.
2. Before treatment starts, the funder's representative approves the agreement (four-eyes: creator and approver must differ).
3. Each release to a hospital needs its own funder approval, goes only to a verified hospital payout account, and is confirmed by the payment provider webhook before the ledger marks it paid.
4. Nigeria first (Paystack, Flutterwave), then Africa, with Stripe slot ready for global donors.

## Layout

- `supabase/migrations`: schema, ledger triggers, RLS
- `src/modules/direct-escrow-ledger`: agreement and release state machines, double-entry postings (tested)
- `src/shared/payments`: provider adapters behind one interface

## Setup

1. In the repo root run `npx create-next-app@latest . --ts --tailwind --app --src-dir --import-alias "@/*"`
2. `npm i zod @supabase/supabase-js && npm i -D vitest`
3. Copy these folders into the repo, add `"test": "vitest run"` to package.json scripts
4. Create a Supabase project, run the two migrations in order in the SQL editor
5. Copy `.env.example` to `.env.local` and fill in sandbox keys
6. `npm test`

## Before real patient data

Register with the Nigeria Data Protection Commission as required under NDPA 2023, get a lawyer to confirm the funds-flow model with CBN rules, and use synthetic data until then.
