import { llm } from '@livekit/agents';
import { z } from 'zod';

export const lookupBillingAccount = llm.tool({
  description:
    'Look up a NovaTel customer billing account by the last four digits of their account or phone number.',
  parameters: z.object({
    lastFour: z.string().length(4).describe('Last four digits of account or phone'),
    billMonth: z.string().optional().describe('Bill month in YYYY-MM if known'),
  }),
  execute: async ({ lastFour, billMonth }) => {
    return JSON.stringify({
      accountLastFour: lastFour,
      billMonth: billMonth ?? '2026-05',
      plan: 'NovaTel Unlimited 50',
      monthlyCharge: 79.99,
      recentCharges: [
        { description: 'Monthly plan fee', amount: 79.99 },
        { description: 'Device installment', amount: 15.0 },
      ],
      duplicateChargeFlag: lastFour.endsWith('7'),
      lateFeeOnAccount: 10.0,
      contractEndDate: '2026-11-01',
    });
  },
});

export const checkPaymentHistory = llm.tool({
  description: 'Check whether a payment was received and when it posted for a billing dispute.',
  parameters: z.object({
    lastFour: z.string().length(4),
    paymentDate: z.string().describe('Date customer says they paid, YYYY-MM-DD'),
  }),
  execute: async ({ lastFour, paymentDate }) => {
    return JSON.stringify({
      accountLastFour: lastFour,
      paymentInitiated: paymentDate,
      paymentPosted: paymentDate,
      onTime: true,
      lateFeeEligibleForWaiver: true,
    });
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
