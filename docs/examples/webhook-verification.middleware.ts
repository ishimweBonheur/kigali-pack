/**
 * Kigali-Pack V2 — Webhook Signature Verification Middleware
 *
 * Copy this file into your external Node.js / Express / NestJS application.
 * Set WEBHOOK_SECRET to the secret returned when you registered your webhook.
 *
 * Expected header: X-Kigalipack-Signature: t={unix_timestamp},v1={hmac_sha256_hex}
 * Signed payload format: `${timestamp}.${rawJsonBody}`
 */

import * as crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const SIGNATURE_HEADER = 'x-kigalipack-signature';
const TOLERANCE_SECONDS = 300;

interface ParsedSignature {
  timestamp: number;
  signature: string;
}

function parseSignatureHeader(headerValue: string): ParsedSignature | null {
  const parts = headerValue.split(',').reduce<Record<string, string>>((acc, part) => {
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

function computeExpectedSignature(
  secret: string,
  rawBody: string,
  timestamp: number,
): string {
  const signedContent = `${timestamp}.${rawBody}`;
  return crypto.createHmac('sha256', secret).update(signedContent).digest('hex');
}

export function verifyKigaliPackWebhook(
  secret: string,
  rawBody: string,
  headerValue: string,
  toleranceSeconds = TOLERANCE_SECONDS,
): { valid: boolean; reason?: string } {
  const parsed = parseSignatureHeader(headerValue);
  if (!parsed) {
    return { valid: false, reason: 'Malformed X-Kigalipack-Signature header' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) {
    return {
      valid: false,
      reason: 'Timestamp outside tolerance window — possible replay attack',
    };
  }

  const expected = computeExpectedSignature(secret, rawBody, parsed.timestamp);
  if (expected.length !== parsed.signature.length) {
    return { valid: false, reason: 'Signature length mismatch' };
  }

  const valid = crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(parsed.signature),
  );

  return valid ? { valid: true } : { valid: false, reason: 'Signature mismatch' };
}

/**
 * Express middleware — requires express.raw() or body-parser raw middleware
 * so req.body is a Buffer containing the exact bytes Kigali-Pack signed.
 */
export function kigaliPackWebhookMiddleware(webhookSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const headerValue = req.headers[SIGNATURE_HEADER];
    if (typeof headerValue !== 'string') {
      res.status(401).json({ error: 'Missing X-Kigalipack-Signature header' });
      return;
    }

    const rawBody =
      Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    const result = verifyKigaliPackWebhook(webhookSecret, rawBody, headerValue);
    if (!result.valid) {
      res.status(401).json({ error: result.reason ?? 'Invalid webhook signature' });
      return;
    }

    try {
      req.body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      res.status(400).json({ error: 'Invalid JSON payload' });
      return;
    }

    next();
  };
}

/**
 * NestJS guard equivalent — use with @UseGuards(KigaliPackWebhookGuard)
 * and enable rawBody: true in NestFactory.create options.
 */
export class KigaliPackWebhookGuard {
  constructor(private readonly webhookSecret: string) {}

  canActivate(context: { switchToHttp: () => { getRequest: () => Request } }): boolean {
    const request = context.switchToHttp().getRequest();
    const headerValue = request.headers[SIGNATURE_HEADER];
    if (typeof headerValue !== 'string') {
      return false;
    }

    const rawBody =
      Buffer.isBuffer(request.body)
        ? request.body.toString('utf8')
        : JSON.stringify(request.body);

    return verifyKigaliPackWebhook(this.webhookSecret, rawBody, headerValue).valid;
  }
}
