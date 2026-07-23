/**
 * Payment Provider Abstraction Layer
 *
 * This interface defines the contract for all payment providers.
 * New providers (MTN Mobile Money, Flutterwave, Paystack, etc.)
 * can be added by implementing this interface without changing
 * the core billing system.
 */

export interface PaymentProvider {
  /** Unique identifier for the provider */
  readonly name: string;

  /**
   * Create a payment request with the provider.
   * Returns a provider-specific reference and any additional data.
   */
  createPayment(
    amount: number,
    currency: string,
    metadata: Record<string, unknown>,
  ): Promise<CreatePaymentResult>;

  /**
   * Verify the status of a payment with the provider.
   */
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;

  /**
   * Process a refund for a completed payment.
   */
  refundPayment(
    reference: string,
    amount?: number,
    reason?: string,
  ): Promise<RefundPaymentResult>;
}

export interface CreatePaymentResult {
  success: boolean;
  providerReference: string;
  paymentUrl?: string;
  redirectUrl?: string;
  qrCode?: string;
  expiresAt?: Date;
  raw?: Record<string, unknown>;
}

export interface VerifyPaymentResult {
  success: boolean;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED';
  providerReference: string;
  amount?: number;
  currency?: string;
  paidAt?: Date;
  payerInfo?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

export interface RefundPaymentResult {
  success: boolean;
  providerReference: string;
  refundReference?: string;
  amount?: number;
  status: string;
  raw?: Record<string, unknown>;
}
