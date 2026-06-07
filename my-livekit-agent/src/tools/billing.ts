import { llm } from '@livekit/agents';
import { z } from 'zod';

import {
  findBillingAccountByLastFour,
  notFoundLookup,
  processBillingLookup,
  processPaymentHistory,
} from '../db/billingRepository.js';
import { createLogger } from '../utils/logger.js';
import { normalizeLastFour } from '../utils/normalizeLastFour.js';

const logger = createLogger('billing-tools');

function invalidDigitsResult(
  reason: 'no_digits' | 'too_few' | 'too_many',
  raw: string,
  digits: string,
): string {
  const messages: Record<typeof reason, string> = {
    no_digits:
      'Could not detect four account digits. Ask the customer to say only the last four digits of their account or phone number.',
    too_few: `Only ${digits.length} digit(s) detected ("${digits}"). Ask the customer for exactly four digits.`,
    too_many: `${digits.length} digits detected ("${digits}"). Ask the customer for exactly four digits, not more.`,
  };

  return JSON.stringify({
    found: false,
    invalidInput: true,
    reason,
    rawInput: raw,
    digitsDetected: digits,
    message: messages[reason],
  });
}

export async function runBillingLookup(lastFour: string, billMonth?: string): Promise<string> {
  return lookupAccount(lastFour, billMonth);
}

async function lookupAccount(lastFour: string, billMonth?: string) {
  const normalized = normalizeLastFour(lastFour);
  if (!normalized.ok) {
    logger.warn({ lastFour, reason: normalized.reason }, 'Invalid last-four digits for billing lookup');
    return invalidDigitsResult(normalized.reason, lastFour, normalized.digits);
  }

  try {
    const account = await findBillingAccountByLastFour(normalized.lastFour);

    if (!account) {
      logger.warn({ lastFour: normalized.lastFour }, 'No billing account found for last four digits');
      return JSON.stringify(notFoundLookup(normalized.lastFour, billMonth));
    }

    return JSON.stringify(processBillingLookup(account, billMonth));
  } catch (err) {
    logger.error({ err, lastFour: normalized.lastFour }, 'Billing lookup failed');
    throw err;
  }
}

async function lookupPaymentHistory(lastFour: string, paymentDate: string) {
  const normalized = normalizeLastFour(lastFour);
  if (!normalized.ok) {
    return invalidDigitsResult(normalized.reason, lastFour, normalized.digits);
  }

  try {
    const account = await findBillingAccountByLastFour(normalized.lastFour);

    if (!account) {
      logger.warn({ lastFour: normalized.lastFour, paymentDate }, 'No billing account for payment history lookup');
      return JSON.stringify({
        found: false,
        accountLastFour: normalized.lastFour,
        paymentInitiated: null,
        paymentPosted: null,
        paymentAmount: null,
        paymentStatus: null,
        onTime: false,
        lateFeeEligibleForWaiver: false,
        message:
          'No NovaTel account matches those last four digits. Confirm the digits before checking payment history.',
      });
    }

    return JSON.stringify(processPaymentHistory(account, paymentDate));
  } catch (err) {
    logger.error({ err, lastFour: normalized.lastFour, paymentDate }, 'Payment history lookup failed');
    throw err;
  }
}

export const lookupBillingAccount = llm.tool({
  description:
    'Look up a NovaTel customer billing account by the last four digits of their account or phone number. Only call after the customer has provided exactly four digits.',
  parameters: z.object({
    lastFour: z.string().describe('Last four digits of account or phone as spoken or written'),
    billMonth: z.string().optional().describe('Bill month in YYYY-MM if known'),
  }),
  execute: async ({ lastFour, billMonth }) => lookupAccount(lastFour, billMonth),
});

export const checkPaymentHistory = llm.tool({
  description: 'Check whether a payment was received and when it posted for a billing dispute.',
  parameters: z.object({
    lastFour: z.string().describe('Last four digits of account or phone as spoken or written'),
    paymentDate: z.string().describe('Date customer says they paid, YYYY-MM-DD'),
  }),
  execute: async ({ lastFour, paymentDate }) => lookupPaymentHistory(lastFour, paymentDate),
});

export const escalateToManager = llm.tool({
  description:
    'Escalate the call to a billing supervisor when the customer requests a manager or policy requires it.',
  parameters: z.object({
    reason: z.string().describe('Brief reason for escalation'),
    summary: z.string().describe('One-sentence summary of the customer issue'),
  }),
  execute: async ({ reason, summary }) => {
    return JSON.stringify({
      escalated: true,
      queue: 'billing-supervisor',
      estimatedWaitMinutes: 2,
      reason,
      summary,
      referenceId: `ESC-${Date.now().toString(36).toUpperCase()}`,
    });
  },
});

export const billingTools = {
  lookupBillingAccount,
  checkPaymentHistory,
  escalateToManager,
};
