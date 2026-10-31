-- Row Level Security. Writes to ledger, disbursements and audit logs happen only through
-- server-side code using the service role. Clients get read access scoped to their own records.

alter table profiles enable row level security;
alter table hospitals enable row level security;
alter table hospital_staff enable row level security;
alter table hospital_payout_accounts enable row level security;
alter table funders enable row level security;
alter table funder_members enable row level security;
alter table patient_invoices enable row level security;
alter table invoice_line_items enable row level security;
alter table funding_agreements enable row level security;
alter table disbursement_instructions enable row level security;
alter table ledger_entries enable row level security;
alter table audit_logs enable row level security;

create function my_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create policy profiles_self on profiles for select using (id = auth.uid() or my_role() = 'auditor');
create policy hospitals_read on hospitals for select to authenticated using (verified_at is not null or my_role() in ('auditor','grant_manager'));

create policy invoices_patient on patient_invoices for select using (patient_id = auth.uid());
create policy invoices_patient_insert on patient_invoices for insert with check (patient_id = auth.uid());
create policy invoices_hospital on patient_invoices for select using (
  exists (select 1 from hospital_staff s where s.user_id = auth.uid() and s.hospital_id = patient_invoices.hospital_id));
create policy invoices_funder on patient_invoices for select using (
  exists (select 1 from funding_agreements a join funder_members m on m.funder_id = a.funder_id
          where a.invoice_id = patient_invoices.id and m.user_id = auth.uid()));
create policy invoices_auditor on patient_invoices for select using (my_role() = 'auditor');

create policy lines_follow_invoice on invoice_line_items for select using (
  exists (select 1 from patient_invoices i where i.id = invoice_line_items.invoice_id));

create policy agreements_funder on funding_agreements for select using (
  exists (select 1 from funder_members m where m.funder_id = funding_agreements.funder_id and m.user_id = auth.uid()));
create policy agreements_hospital on funding_agreements for select using (
  exists (select 1 from hospital_staff s where s.hospital_id = funding_agreements.hospital_id and s.user_id = auth.uid()));
create policy agreements_auditor on funding_agreements for select using (my_role() = 'auditor');

create policy disb_read_funder on disbursement_instructions for select using (
  exists (select 1 from funding_agreements a join funder_members m on m.funder_id = a.funder_id
          where a.id = disbursement_instructions.agreement_id and m.user_id = auth.uid()));
create policy disb_read_auditor on disbursement_instructions for select using (my_role() = 'auditor');

create policy ledger_read_auditor on ledger_entries for select using (my_role() = 'auditor');
create policy ledger_read_funder on ledger_entries for select using (
  exists (select 1 from funding_agreements a join funder_members m on m.funder_id = a.funder_id
          where a.id = ledger_entries.agreement_id and m.user_id = auth.uid()));

create policy audit_read_auditor on audit_logs for select using (my_role() = 'auditor');

-- Payout accounts and staff/member tables have no client policies: service role only.
