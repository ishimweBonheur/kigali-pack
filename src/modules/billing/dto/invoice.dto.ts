export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: 'RWF';
  status: 'PAID' | 'UNPAID';
  billingPeriod: {
    start: Date;
    end: Date;
  };
  createdAt: Date;
}

export interface UsageCounterResponse {
  currentUsage: number;
  planLimit: number;
  planCode: string;
  usagePercent: number;
  resettingAt: string;
}
