import { llm } from '@livekit/agents';

import { runBillingLookup } from '../tools/billing.js';
import { createLogger } from '../utils/logger.js';
import { normalizeLastFour } from '../utils/normalizeLastFour.js';

const logger = createLogger('billingPrefetch');

export const BILLING_PREFETCH_MESSAGE_ID = 'lk.billing.prefetch';

const MONTH_NAMES: Record<string, string> = {
  january: '01',
  jan: '01',
  february: '02',
  feb: '02',
  march: '03',
  mar: '03',
  april: '04',
  apr: '04',
  may: '05',
  june: '06',
  jun: '06',
  july: '07',
  jul: '07',
  august: '08',
  aug: '08',
  september: '09',
  sep: '09',
  sept: '09',
  october: '10',
  oct: '10',
  november: '11',
  nov: '11',
  december: '12',
  dec: '12',
};

export function extractBillMonth(text: string): string | undefined {
  const match = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/i,
  );
  if (!match) {
    return undefined;
  }

  const month = MONTH_NAMES[match[1]!.toLowerCase()];
  if (!month) {
    return undefined;
  }

  const year = new Date().getFullYear();
  return `${year}-${month}`;
}

function clearBillingPrefetch(chatCtx: llm.ChatContext): void {
  const idx = chatCtx.indexById(BILLING_PREFETCH_MESSAGE_ID);
  if (idx !== undefined) {
    chatCtx.items.splice(idx, 1);
  }
}

function injectBillingPrefetch(chatCtx: llm.ChatContext, content: string): void {
  const message = llm.ChatMessage.create({
    id: BILLING_PREFETCH_MESSAGE_ID,
    role: 'system',
    content,
  });

  const idx = chatCtx.indexById(BILLING_PREFETCH_MESSAGE_ID);
  if (idx !== undefined) {
    chatCtx.items[idx] = message;
    return;
  }

  chatCtx.insert(message);
}

/**
 * When the customer provides four account digits (numeric or spoken words),
 * run billing lookup before the LLM turn so the agent cannot skip the tool.
 */
export async function injectBillingPrefetchIfDigits(
  chatCtx: llm.ChatContext,
  userText: string,
): Promise<boolean> {
  clearBillingPrefetch(chatCtx);

  const normalized = normalizeLastFour(userText);
  if (!normalized.ok) {
    return false;
  }

  const billMonth = extractBillMonth(userText);

  try {
    const lookupJson = await runBillingLookup(normalized.lastFour, billMonth);

    injectBillingPrefetch(
      chatCtx,
      [
        `Billing lookup already completed for account digits ${normalized.lastFour}.`,
        `Tool result: ${lookupJson}`,
        'Use this data in your spoken response now.',
        'Do not ask the customer to repeat their digits unless the account was not found.',
        'Do not say you will check — the lookup is already done.',
      ].join(' '),
    );

    logger.info(
      { lastFour: normalized.lastFour, billMonth },
      'Billing lookup prefetched from customer digits',
    );

    return true;
  } catch (err) {
    logger.error({ err, lastFour: normalized.lastFour }, 'Billing prefetch failed');
    return false;
  }
}
