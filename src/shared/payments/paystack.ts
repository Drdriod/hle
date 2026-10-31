import { PayoutProvider, TransferRequest, TransferResult, hmacSha512, safeEqual } from './provider';

export class PaystackProvider implements PayoutProvider {
  readonly name = 'paystack' as const;
  constructor(private secretKey: string, private base = 'https://api.paystack.co') {}

  async initiateTransfer(req: TransferRequest): Promise<TransferResult> {
    const res = await fetch(`${this.base}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'balance',
        amount: Number(req.amountMinor), // Paystack uses kobo
        recipient: req.recipientCode,
        reference: req.reference,
        reason: req.reason,
        currency: req.currency,
      }),
    });
    const json: any = await res.json();
    if (!res.ok || !json.status) throw new Error(`Paystack transfer failed: ${json.message ?? res.status}`);
    return { provider: 'paystack', providerReference: json.data.transfer_code, status: 'pending' };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>) {
    const sig = headers['x-paystack-signature'] ?? '';
    if (!safeEqual(sig, hmacSha512(this.secretKey, rawBody))) throw new Error('Invalid Paystack signature');
    const body = JSON.parse(rawBody);
    const status = body.event === 'transfer.success' ? 'succeeded'
      : body.event === 'transfer.failed' || body.event === 'transfer.reversed' ? 'failed' : 'pending';
    return { event: body.event as string, reference: body.data?.reference as string, status } as const;
  }
}
