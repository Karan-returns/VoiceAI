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

export type BillingPrefetchSource = 'user' | 'known';

export interface BillingPrefetchResult {
  injected: boolean;
  lastFour?: string;
  source?: BillingPrefetchSource;
}

/**
 * Pick account digits from the current utterance, or reuse the account already
 * identified earlier in this call.
 */
export function resolveAccountLastFour(
  userText: string,
  knownLastFour?: string,
): { lastFour: string; billMonth?: string; source: BillingPrefetchSource } | null {
  const normalized = normalizeLastFour(userText);
  if (normalized.ok) {
    const billMonth = extractBillMonth(userText);
    return billMonth
      ? { lastFour: normalized.lastFour, billMonth, source: 'user' }
      : { lastFour: normalized.lastFour, source: 'user' };
  }

  if (knownLastFour) {
    return { lastFour: knownLastFour, source: 'known' };
  }

  return null;
}

/**
 * Inject billing lookup results before the LLM turn.
 *
 * Runs on digit turns and on follow-up turns once an account is known so the
 * agent never re-calls lookupBillingAccount mid-call (which caused "please hold"
 * stalls when prefetch was cleared after the digit turn).
 */
export async function refreshBillingPrefetch(
  chatCtx: llm.ChatContext,
  options: { userText: string; knownLastFour?: string },
): Promise<BillingPrefetchResult> {
  const resolved = resolveAccountLastFour(options.userText, options.knownLastFour);

  if (!resolved) {
    clearBillingPrefetch(chatCtx);
    return { injected: false };
  }

  try {
    const lookupJson = await runBillingLookup(resolved.lastFour, resolved.billMonth);

    const intro =
      resolved.source === 'user'
        ? `Billing lookup already completed for account digits ${resolved.lastFour}.`
        : `Billing lookup for account digits ${resolved.lastFour} is still current for this call.`;

    injectBillingPrefetch(
      chatCtx,
      [
        intro,
        `Tool result: ${lookupJson}`,
        'Billing data is loaded — answer the customer now in this same turn.',
        'Use duplicateChargeFlag, recentCharges, plan, and totalDue from the result.',
        'Do not call lookupBillingAccount again for this account.',
        'Do not say please hold, let me check, or one moment.',
        'Do not ask for digits again unless found is false.',
      ].join(' '),
    );

    logger.info(
      { lastFour: resolved.lastFour, billMonth: resolved.billMonth, source: resolved.source },
      'Billing lookup prefetched',
    );

    return { injected: true, lastFour: resolved.lastFour, source: resolved.source };
  } catch (err) {
    logger.error({ err, lastFour: resolved.lastFour }, 'Billing prefetch failed');
    return { injected: false, lastFour: resolved.lastFour, source: resolved.source };
  }
}

/** @deprecated Use refreshBillingPrefetch */
export async function injectBillingPrefetchIfDigits(
  chatCtx: llm.ChatContext,
  userText: string,
): Promise<boolean> {
  const result = await refreshBillingPrefetch(chatCtx, { userText });
  return result.injected;
}
