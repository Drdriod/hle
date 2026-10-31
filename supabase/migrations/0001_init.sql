-- HLE core schema. Money is always stored as integer minor units (kobo, cents). Never floats.
-- HLE does not custody funds. This schema records agreements, approvals, ledger entries and
-- payout instructions. Funds are held by the funder or a licensed trust/escrow partner.

create extension if not exists vector;
create extension if not exists postgis;

create type user_role as enum ('patient','hospital_admin','funder_rep','grant_manager','auditor');
create type agreement_status as enum ('draft','proposed','funder_approved','treatment_started','completed','cancelled','disputed');
create type release_status as enum ('requested','funder_approved','submitted','succeeded','failed','cancelled');
create type funds_holder as enum ('funder_direct','licensed_partner');
create type payment_provider as enum ('paystack','flutterwave','stripe');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country char(2) not null default 'NG',
  accreditation_tier smallint,
  location geography(point, 4326),
  verified_at timestamptz,
  verified_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table hospital_staff (
  user_id uuid not null references profiles(id) on delete cascade,
  hospital_id uuid not null references hospitals(id) on delete cascade,
  primary key (user_id, hospital_id)
);

-- Only provider recipient codes are stored, never full bank account numbers.
create table hospital_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references hospitals(id) on delete cascade,
  provider payment_provider not null,
  recipient_code text not null,
  account_last4 char(4),
  verified_at timestamptz,
  verified_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (provider, recipient_code)
);

create table funders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('ngo','corporate_csr','insurer','government','crowd_pool')),
  country char(2),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table funder_members (
  user_id uuid not null references profiles(id) on delete cascade,
  funder_id uuid not null references funders(id) on delete cascade,
  primary key (user_id, funder_id)
);

create table patient_invoices (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references profiles(id),
  hospital_id uuid not null references hospitals(id),
  currency char(3) not null default 'NGN',
  total_minor bigint not null check (total_minor > 0),
  file_path text,
  status text not null default 'submitted' check (status in ('submitted','verified','rejected','funded','closed')),
  created_at timestamptz not null default now()
);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references patient_invoices(id) on delete cascade,
  description text not null,
  icd10_code text,
  amount_minor bigint not null check (amount_minor > 0)
);

-- The agreement between a funder and HLE/hospital before treatment commences.
create table funding_agreements (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references patient_invoices(id),
  funder_id uuid not null references funders(id),
  hospital_id uuid not null references hospitals(id),
  currency char(3) not null,
  committed_minor bigint not null check (committed_minor > 0),
  holder funds_holder not null default 'funder_direct',
  holder_partner_name text,
  status agreement_status not null default 'draft',
  created_by uuid not null references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (approved_by is null or approved_by <> created_by)
);

create table disbursement_instructions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references funding_agreements(id),
  payout_account_id uuid not null references hospital_payout_accounts(id),
  amount_minor bigint not null check (amount_minor > 0),
  status release_status not null default 'requested',
  requested_by uuid not null references profiles(id),
  approved_by uuid references profiles(id),
  provider payment_provider,
  provider_reference text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  check (approved_by is null or approved_by <> requested_by)
);

-- A payout may only go to a verified account that belongs to the agreement's hospital.
create function enforce_payout_target() returns trigger language plpgsql as $$
declare ok boolean;
begin
  select exists (
    select 1
    from funding_agreements a
    join hospital_payout_accounts p on p.hospital_id = a.hospital_id
    where a.id = new.agreement_id and p.id = new.payout_account_id and p.verified_at is not null
  ) into ok;
  if not ok then
    raise exception 'payout account is not a verified account of the agreement hospital';
  end if;
  return new;
end $$;
create trigger trg_enforce_payout_target before insert or update of payout_account_id, agreement_id
  on disbursement_instructions for each row execute function enforce_payout_target();

-- Immutable double-entry ledger. Each entry_group must balance.
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_group uuid not null,
  agreement_id uuid not null references funding_agreements(id),
  account text not null check (account in ('funds_committed','funder_pledge','pending_release','paid_to_hospital')),
  direction text not null check (direction in ('debit','credit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (idempotency_key, account, direction)
);

create function ledger_immutable() returns trigger language plpgsql as $$
begin raise exception 'ledger_entries is append only'; end $$;
create trigger trg_ledger_no_update before update or delete on ledger_entries
  for each row execute function ledger_immutable();

create function ledger_group_balanced() returns trigger language plpgsql as $$
declare d bigint; c bigint;
begin
  select coalesce(sum(amount_minor) filter (where direction='debit'),0),
         coalesce(sum(amount_minor) filter (where direction='credit'),0)
    into d, c from ledger_entries where entry_group = new.entry_group;
  if d <> c then raise exception 'ledger entry_group % is unbalanced (debit %, credit %)', new.entry_group, d, c; end if;
  return null;
end $$;
create constraint trigger trg_ledger_balanced after insert on ledger_entries
  deferrable initially deferred for each row execute function ledger_group_balanced();

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create trigger trg_audit_no_update before update or delete on audit_logs
  for each row execute function ledger_immutable();
