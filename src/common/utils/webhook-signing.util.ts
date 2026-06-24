import * as crypto from 'crypto';

export const WEBHOOK_SIGNATURE_HEADER = 'X-Kigalipack-Signature';
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export interface ParsedWebhookSignature {
  timestamp: number;
  signature: string;
}

export function computeWebhookHmac(
  secret: string,
  rawPayload: string,
  timestamp: number,
): string {
  const signedContent = `${timestamp}.${rawPayload}`;
  return crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('hex');
}

export function buildSignatureHeader(
  secret: string,
  rawPayload: string,
  timestamp: number,
): string {
  const hash = computeWebhookHmac(secret, rawPayload, timestamp);
  return `t=${timestamp},v1=${hash}`;
}

export function parseSignatureHeader(
  headerValue: string,
): ParsedWebhookSignature | null {
  const parts = headerValue
    .split(',')
    .reduce<Record<string, string>>((acc, part) => {
      const [key, ...rest] = part.trim().split('=');
      if (key && rest.length > 0) {
        acc[key] = rest.join('=');
      }
      return acc;
    }, {});

  const timestamp = Number(parts['t']);
  const signature = parts['v1'];

  if (!Number.isFinite(timestamp) || !signature) {
    return null;
  }

  return { timestamp, signature };
}

export function verifyWebhookSignature(
  secret: string,
  rawPayload: string,
  headerValue: string,
  toleranceSeconds = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
): { valid: boolean; reason?: string } {
  const parsed = parseSignatureHeader(headerValue);
  if (!parsed) {
    return { valid: false, reason: 'Malformed signature header' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) {
    return {
      valid: false,
      reason: 'Timestamp outside tolerance window (replay protection)',
    };
  }

  const expected = computeWebhookHmac(secret, rawPayload, parsed.timestamp);
  if (expected.length !== parsed.signature.length) {
    return { valid: false, reason: 'Signature length mismatch' };
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(parsed.signature),
  );

  return valid
    ? { valid: true }
    : { valid: false, reason: 'Signature mismatch' };
}
