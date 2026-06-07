import type { BillingLookupResult } from '../db/billingTypes.js';

type LookupPayload = BillingLookupResult & {
  invalidInput?: boolean;
  reason?: string;
};

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Compact prose summary for LLM context — avoids shipping full JSON on every turn.
 */
export function summarizeBillingLookup(lookupJson: string): string {
  let data: LookupPayload;
  try {
    data = JSON.parse(lookupJson) as LookupPayload;
  } catch {
    return 'Billing lookup failed to parse. Apologize and offer a callback within twenty-four hours.';
  }

  if (data.invalidInput) {
    return `Invalid digits (${data.reason ?? 'unknown'}). Ask the customer to repeat exactly four digits.`;
  }

  if (!data.found) {
    return `No NovaTel account for digits ${data.accountLastFour}. Tell the customer and ask them to repeat four digits slowly.`;
  }

  const chargeList = data.recentCharges
    .map((c) => `${c.description} $${formatMoney(c.amount)}`)
    .join(', ');

  const duplicate = data.duplicateChargeFlag
    ? 'duplicate charge confirmed — offer full refund in three to five business days'
    : 'no duplicate charges';

  const contract = data.underContract
    ? `under contract (ETF $${formatMoney(data.earlyTerminationFee)})`
    : 'not under contract (no cancellation fee)';

  const lateFee =
    data.lateFeeOnAccount > 0
      ? `late fee $${formatMoney(data.lateFeeOnAccount)} on account`
      : 'no late fee';

  return [
    `Account ending ${data.accountLastFour}, ${data.customerName}.`,
    `${data.billMonth} bill: ${data.plan}, total due $${formatMoney(data.totalDue)}.`,
    `Charges: ${chargeList || 'none'}.`,
    `${duplicate}. ${lateFee}. Status ${data.status}. ${contract}.`,
  ].join(' ');
}
