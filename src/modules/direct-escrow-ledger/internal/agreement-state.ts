export type AgreementStatus =
  | 'draft' | 'proposed' | 'funder_approved' | 'treatment_started'
  | 'completed' | 'cancelled' | 'disputed';

export type ReleaseStatus =
  | 'requested' | 'funder_approved' | 'submitted' | 'succeeded' | 'failed' | 'cancelled';

const AGREEMENT_TRANSITIONS: Record<AgreementStatus, AgreementStatus[]> = {
  draft: ['proposed', 'cancelled'],
  proposed: ['funder_approved', 'cancelled'],
  funder_approved: ['treatment_started', 'cancelled', 'disputed'],
  treatment_started: ['completed', 'disputed', 'cancelled'],
  completed: [],
  cancelled: [],
  disputed: ['treatment_started', 'cancelled'],
};

const RELEASE_TRANSITIONS: Record<ReleaseStatus, ReleaseStatus[]> = {
  requested: ['funder_approved', 'cancelled'],
  funder_approved: ['submitted', 'cancelled'],
  submitted: ['succeeded', 'failed'],
  succeeded: [],
  failed: ['requested'],
  cancelled: [],
};

export function canTransitionAgreement(from: AgreementStatus, to: AgreementStatus): boolean {
  return AGREEMENT_TRANSITIONS[from].includes(to);
}

export function canTransitionRelease(from: ReleaseStatus, to: ReleaseStatus): boolean {
  return RELEASE_TRANSITIONS[from].includes(to);
}

/** Releases are only allowed once the funder has approved the agreement. */
export function releaseAllowed(status: AgreementStatus): boolean {
  return status === 'funder_approved' || status === 'treatment_started';
}

/** Four-eyes rule: the person who creates or requests something cannot approve it. */
export function assertFourEyes(requesterId: string, approverId: string): void {
  if (requesterId === approverId) {
    throw new Error('Approver must be a different person from the requester');
  }
}
