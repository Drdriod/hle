import { PayoutProvider, TransferRequest, TransferResult } from './provider';

/** Placeholder so global donors can be added later without touching the escrow module. */
export class StripeProvider implements PayoutProvider {
  readonly name = 'stripe' as const;
  async initiateTransfer(_req: TransferRequest): Promise<TransferResult> {
    throw new Error('Stripe provider not implemented yet');
  }
  verifyWebhook(): never {
    throw new Error('Stripe provider not implemented yet');
  }
}
