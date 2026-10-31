import { describe, it, expect } from 'vitest';
import {
  canTransitionAgreement, canTransitionRelease, releaseAllowed, assertFourEyes,
  commitmentEntries, releaseApprovedEntries, releasePaidEntries, releaseFailedEntries, isBalanced,
} from '../public-api';

const base = { entryGroup: 'g1', agreementId: 'a1', amountMinor: 500000n, currency: 'NGN', idempotencyKey: 'k1' };

describe('agreement state machine', () => {
  it('allows the happy path', () => {
    expect(canTransitionAgreement('draft', 'proposed')).toBe(true);
    expect(canTransitionAgreement('proposed', 'funder_approved')).toBe(true);
    expect(canTransitionAgreement('funder_approved', 'treatment_started')).toBe(true);
    expect(canTransitionAgreement('treatment_started', 'completed')).toBe(true);
  });
  it('blocks skipping funder approval', () => {
    expect(canTransitionAgreement('proposed', 'treatment_started')).toBe(false);
    expect(canTransitionAgreement('draft', 'funder_approved')).toBe(false);
  });
  it('only allows releases after funder approval', () => {
    expect(releaseAllowed('draft')).toBe(false);
    expect(releaseAllowed('proposed')).toBe(false);
    expect(releaseAllowed('funder_approved')).toBe(true);
  });
  it('release cannot be submitted without approval', () => {
    expect(canTransitionRelease('requested', 'submitted')).toBe(false);
    expect(canTransitionRelease('funder_approved', 'submitted')).toBe(true);
  });
});

describe('four eyes', () => {
  it('rejects self approval', () => expect(() => assertFourEyes('u1', 'u1')).toThrow());
  it('accepts a different approver', () => expect(() => assertFourEyes('u1', 'u2')).not.toThrow());
});

describe('ledger', () => {
  it('every posting balances', () => {
    for (const fn of [commitmentEntries, releaseApprovedEntries, releasePaidEntries, releaseFailedEntries]) {
      expect(isBalanced(fn(base))).toBe(true);
    }
  });
  it('rejects zero or negative amounts', () => {
    expect(() => commitmentEntries({ ...base, amountMinor: 0n })).toThrow();
  });
});
