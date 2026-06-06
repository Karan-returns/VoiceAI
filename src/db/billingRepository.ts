import type { Collection } from 'mongodb';

import { createLogger } from '../utils/logger.js';
import { getDb } from './client.js';
import { TEST_BILLING_ACCOUNTS } from './billingSeed.js';
import {
  BILLING_ACCOUNTS_COLLECTION,
  type BillingAccountDocument,
  type BillingLookupResult,
  type PaymentHistoryResult,
} from './billingTypes.js';

const logger = createLogger('billing-db');

function accounts(): Collection<BillingAccountDocument> {
  return getDb().collection<BillingAccountDocument>(BILLING_ACCOUNTS_COLLECTION);
}

export async function findBillingAccountByLastFour(
  lastFour: string,
): Promise<BillingAccountDocument | null> {
  return accounts().findOne({ accountLastFour: lastFour });
}

export async function seedBillingAccounts(): Promise<number> {
  const collection = accounts();
  let upserted = 0;

  for (const account of TEST_BILLING_ACCOUNTS) {
    const result = await collection.updateOne(
      { accountLastFour: account.accountLastFour },
      { $set: account },
      { upsert: true },
    );

    if (result.upsertedCount > 0 || result.modifiedCount > 0) {
      upserted += 1;
    }
  }

  logger.info({ count: upserted }, 'Billing test accounts seeded');
  return upserted;
}

export function processBillingLookup(
  account: BillingAccountDocument,
  billMonth?: string,
): BillingLookupResult {
  const effectiveBillMonth = billMonth ?? account.billMonth;
  const totalDue =
    account.recentCharges.reduce((sum, charge) => sum + charge.amount, 0) +
    account.lateFeeOnAccount;

  return {
    found: true,
    accountLastFour: account.accountLastFour,
    customerName: account.customerName,
    billMonth: effectiveBillMonth,
    plan: account.plan,
    monthlyCharge: account.monthlyCharge,
    recentCharges: account.recentCharges,
    duplicateChargeFlag: account.duplicateChargeFlag,
    lateFeeOnAccount: account.lateFeeOnAccount,
    contractEndDate: account.contractEndDate,
    underContract: account.underContract,
    earlyTerminationFee: account.earlyTerminationFee,
    status: account.status,
    totalDue,
  };
}

export function processPaymentHistory(
  account: BillingAccountDocument,
  paymentDate: string,
): PaymentHistoryResult {
  const payment =
    account.payments.find(
      (entry) =>
        entry.initiatedDate === paymentDate ||
        entry.postedDate === paymentDate ||
        (entry.initiatedDate <= paymentDate &&
          (entry.postedDate === null || entry.postedDate >= paymentDate)),
    ) ?? account.payments.at(-1);

  if (!payment) {
    return {
      found: false,
      accountLastFour: account.accountLastFour,
      paymentInitiated: null,
      paymentPosted: null,
      paymentAmount: null,
      paymentStatus: null,
      onTime: false,
      lateFeeEligibleForWaiver: false,
    };
  }

  const onTime =
    payment.status === 'posted' &&
    payment.postedDate !== null &&
    daysBetween(payment.initiatedDate, payment.postedDate) <= 3;

  const lateFeeEligibleForWaiver =
    account.lateFeeOnAccount > 0 && onTime && payment.status === 'posted';

  return {
    found: true,
    accountLastFour: account.accountLastFour,
    paymentInitiated: payment.initiatedDate,
    paymentPosted: payment.postedDate,
    paymentAmount: payment.amount,
    paymentStatus: payment.status,
    onTime,
    lateFeeEligibleForWaiver,
  };
}

function daysBetween(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Math.round((endMs - startMs) / (1000 * 60 * 60 * 24));
}

export function notFoundLookup(lastFour: string, billMonth?: string): BillingLookupResult {
  return {
    found: false,
    message:
      'No NovaTel account matches those last four digits. Ask the customer to repeat only the last four digits of their account or phone number.',
    accountLastFour: lastFour,
    customerName: '',
    billMonth: billMonth ?? '',
    plan: '',
    monthlyCharge: 0,
    recentCharges: [],
    duplicateChargeFlag: false,
    lateFeeOnAccount: 0,
    contractEndDate: null,
    underContract: false,
    earlyTerminationFee: 0,
    status: 'active',
    totalDue: 0,
  };
}
