export const BILLING_ACCOUNTS_COLLECTION = 'billing_accounts';

export interface BillingCharge {
  description: string;
  amount: number;
  date: string;
}

export interface BillingPayment {
  initiatedDate: string;
  postedDate: string | null;
  amount: number;
  status: 'posted' | 'pending' | 'failed';
}

export interface BillingAccountDocument {
  accountLastFour: string;
  customerName: string;
  plan: string;
  monthlyCharge: number;
  billMonth: string;
  recentCharges: BillingCharge[];
  duplicateChargeFlag: boolean;
  lateFeeOnAccount: number;
  contractEndDate: string | null;
  underContract: boolean;
  earlyTerminationFee: number;
  status: 'active' | 'past_due' | 'suspended';
  payments: BillingPayment[];
}

export interface BillingLookupResult {
  found: boolean;
  accountLastFour: string;
  customerName: string;
  billMonth: string;
  plan: string;
  monthlyCharge: number;
  recentCharges: BillingCharge[];
  duplicateChargeFlag: boolean;
  lateFeeOnAccount: number;
  contractEndDate: string | null;
  underContract: boolean;
  earlyTerminationFee: number;
  status: 'active' | 'past_due' | 'suspended';
  totalDue: number;
}

export interface PaymentHistoryResult {
  found: boolean;
  accountLastFour: string;
  paymentInitiated: string | null;
  paymentPosted: string | null;
  paymentAmount: number | null;
  paymentStatus: BillingPayment['status'] | null;
  onTime: boolean;
  lateFeeEligibleForWaiver: boolean;
}
