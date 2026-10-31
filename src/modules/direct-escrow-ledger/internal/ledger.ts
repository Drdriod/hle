export type LedgerAccount = 'funds_committed' | 'funder_pledge' | 'pending_release' | 'paid_to_hospital';

export interface LedgerEntry {
  entryGroup: string;
  agreementId: string;
  account: LedgerAccount;
  direction: 'debit' | 'credit';
  amountMinor: bigint;
  currency: string;
  idempotencyKey: string;
}

interface Base { entryGroup: string; agreementId: string; amountMinor: bigint; currency: string; idempotencyKey: string }

function pair(b: Base, debit: LedgerAccount, credit: LedgerAccount): LedgerEntry[] {
  if (b.amountMinor <= 0n) throw new Error('Amount must be positive');
  const common = { entryGroup: b.entryGroup, agreementId: b.agreementId, amountMinor: b.amountMinor, currency: b.currency, idempotencyKey: b.idempotencyKey };
  return [
    { ...common, account: debit, direction: 'debit' },
    { ...common, account: credit, direction: 'credit' },
  ];
}

/** Funder approves the agreement: the commitment is recorded. */
export const commitmentEntries = (b: Base) => pair(b, 'funds_committed', 'funder_pledge');

/** A release is approved by the funder: reduces remaining pledge, marks amount as pending. */
export const releaseApprovedEntries = (b: Base) => pair(b, 'funder_pledge', 'pending_release');

/** Provider confirms the transfer to the hospital succeeded. */
export const releasePaidEntries = (b: Base) => pair(b, 'pending_release', 'paid_to_hospital');

/** Provider reports failure: put the amount back into the pledge. */
export const releaseFailedEntries = (b: Base) => pair(b, 'pending_release', 'funder_pledge');

export function isBalanced(entries: LedgerEntry[]): boolean {
  const sum = (d: 'debit' | 'credit') =>
    entries.filter((e) => e.direction === d).reduce((t, e) => t + e.amountMinor, 0n);
  return sum('debit') === sum('credit');
}
