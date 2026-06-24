export type PaymentSimulationOutcome =
  | { status: 'SUCCESS'; failureReason: null }
  | { status: 'FAILED'; failureReason: 'INSUFFICIENT_FUNDS' }
  | { status: 'TIMEOUT'; failureReason: 'TIMEOUT' }
  | { status: 'REJECTED'; failureReason: 'REJECTED' }
  | { status: 'FAILED'; failureReason: 'NETWORK_ERROR' };

export function resolvePaymentSimulation(
  amount: number,
): PaymentSimulationOutcome {
  if (amount === 111111) {
    return { status: 'FAILED', failureReason: 'INSUFFICIENT_FUNDS' };
  }
  if (amount === 222222) {
    return { status: 'TIMEOUT', failureReason: 'TIMEOUT' };
  }
  if (amount === 333333) {
    return { status: 'REJECTED', failureReason: 'REJECTED' };
  }
  if (amount === 444444) {
    return { status: 'FAILED', failureReason: 'NETWORK_ERROR' };
  }
  if (amount < 100000) {
    return { status: 'SUCCESS', failureReason: null };
  }
  return { status: 'SUCCESS', failureReason: null };
}

export const SANDBOX_TEST_ACCOUNTS = [
  {
    label: 'Default success',
    phoneNumber: '0781234567',
    amount: 5000,
    expectedStatus: 'SUCCESS',
  },
  {
    label: 'Insufficient funds',
    phoneNumber: '0781234567',
    amount: 111111,
    expectedStatus: 'FAILED',
    failureReason: 'INSUFFICIENT_FUNDS',
  },
  {
    label: 'Gateway timeout',
    phoneNumber: '0781234567',
    amount: 222222,
    expectedStatus: 'TIMEOUT',
    failureReason: 'TIMEOUT',
  },
  {
    label: 'Payment rejected',
    phoneNumber: '0781234567',
    amount: 333333,
    expectedStatus: 'REJECTED',
    failureReason: 'REJECTED',
  },
  {
    label: 'Network error',
    phoneNumber: '0781234567',
    amount: 444444,
    expectedStatus: 'FAILED',
    failureReason: 'NETWORK_ERROR',
  },
  {
    label: 'Airtel Money success',
    phoneNumber: '0731234567',
    amount: 25000,
    expectedStatus: 'SUCCESS',
  },
] as const;
