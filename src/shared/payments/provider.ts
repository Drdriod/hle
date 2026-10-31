import { createHmac, timingSafeEqual } from 'node:crypto';

export type ProviderName = 'paystack' | 'flutterwave' | 'stripe';

export interface TransferRequest {
  amountMinor: bigint;      // kobo / cents
  currency: string;
  recipientCode: string;    // provider-side recipient or beneficiary id (no raw bank details stored by HLE)
  reference: string;        // our idempotency key
  reason: string;
}

export interface TransferResult {
  provider: ProviderName;
  providerReference: string;
  status: 'pending' | 'succeeded' | 'failed';
}

export interface PayoutProvider {
  readonly name: ProviderName;
  initiateTransfer(req: TransferRequest): Promise<TransferResult>;
  /** Returns the parsed event if the signature is valid, otherwise throws. */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): { event: string; reference: string; status: TransferResult['status'] };
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function hmacSha512(secret: string, body: string): string {
  return createHmac('sha512', secret).update(body).digest('hex');
}

/** Pick providers for a country, in order of preference, from PAYMENT_ROUTING. */
export function routeFor(country: string, routing: Record<string, ProviderName[]>): ProviderName[] {
  return routing[country] ?? routing['DEFAULT'] ?? [];
}
