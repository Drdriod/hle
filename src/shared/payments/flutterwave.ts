import { PayoutProvider, TransferRequest, TransferResult, safeEqual } from './provider';

// Flutterwave amounts are in major units (NGN, not kobo). Verify against sandbox before go-live.
export class FlutterwaveProvider implements PayoutProvider {
  readonly name = 'flutterwave' as const;
  constructor(private secretKey: string, private webhookHash: string, private base = 'https://api.flutterwave.com/v3') {}

  async initiateTransfer(req: TransferRequest): Promise<TransferResult> {
    const major = Number(req.amountMinor) / 100;
    const res = await fetch(`${this.base}/transfers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beneficiary: Number(req.recipientCode),
        amount: major,
        currency: req.currency,
        reference: req.reference,
        narration: req.reason,
      }),
    });
    const json: any = await res.json();
    if (!res.ok || json.status !== 'success') throw new Error(`Flutterwave transfer failed: ${json.message ?? res.status}`);
    return { provider: 'flutterwave', providerReference: String(json.data.id), status: 'pending' };
  }

  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>) {
    if (!safeEqual(headers['verif-hash'] ?? '', this.webhookHash)) throw new Error('Invalid Flutterwave signature');
    const body = JSON.parse(rawBody);
    const d = body.data ?? body['transfer'] ?? {};
    const status = d.status === 'SUCCESSFUL' ? 'succeeded' : d.status === 'FAILED' ? 'failed' : 'pending';
    return { event: body.event as string, reference: d.reference as string, status } as const;
  }
}
