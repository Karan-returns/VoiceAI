import { llm } from '@livekit/agents';
import { z } from 'zod';

import {
  findBillingAccountByLastFour,
  notFoundLookup,
  processBillingLookup,
  processPaymentHistory,
} from '../db/billingRepository.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('billing-tools');

async function lookupAccount(lastFour: string, billMonth?: string) {
  try {
    const account = await findBillingAccountByLastFour(lastFour);

    if (!account) {
      logger.warn({ lastFour }, 'No billing account found for last four digits');
      return notFoundLookup(lastFour, billMonth);
    }

    return processBillingLookup(account, billMonth);
  } catch (err) {
    logger.error({ err, lastFour }, 'Billing lookup failed');
    throw err;
  }
}

async function lookupPaymentHistory(lastFour: string, paymentDate: string) {
  try {
    const account = await findBillingAccountByLastFour(lastFour);

    if (!account) {
      logger.warn({ lastFour, paymentDate }, 'No billing account for payment history lookup');
      return {
        found: false,
        accountLastFour: lastFour,
        paymentInitiated: null,
        paymentPosted: null,
        paymentAmount: null,
        paymentStatus: null,
        onTime: false,
        lateFeeEligibleForWaiver: false,
      };
    }

    return processPaymentHistory(account, paymentDate);
  } catch (err) {
    logger.error({ err, lastFour, paymentDate }, 'Payment history lookup failed');
    throw err;
  }
}

export const lookupBillingAccount = llm.tool({
  description:
    'Look up a NovaTel customer billing account by the last four digits of their account or phone number.',
  parameters: z.object({
    lastFour: z.string().length(4).describe('Last four digits of account or phone'),
    billMonth: z.string().optional().describe('Bill month in YYYY-MM if known'),
  }),
  execute: async ({ lastFour, billMonth }) => {
    const result = await lookupAccount(lastFour, billMonth);
    return JSON.stringify(result);
  },
});

export const checkPaymentHistory = llm.tool({
  description: 'Check whether a payment was received and when it posted for a billing dispute.',
  parameters: z.object({
    lastFour: z.string().length(4),
    paymentDate: z.string().describe('Date customer says they paid, YYYY-MM-DD'),
  }),
  execute: async ({ lastFour, paymentDate }) => {
    const result = await lookupPaymentHistory(lastFour, paymentDate);
    return JSON.stringify(result);
  },
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
