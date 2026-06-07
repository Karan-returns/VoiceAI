const DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  oh: '0',
  o: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

export type LastFourNormalizeResult =
  | { ok: true; lastFour: string }
  | { ok: false; reason: 'no_digits' | 'too_few' | 'too_many'; digits: string };

function tokenizeDigits(input: string): string {
  const lower = input.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = lower.split(/\s+/).filter(Boolean);
  let digits = '';

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      digits += token;
      continue;
    }

    const mapped = DIGIT_WORDS[token];
    if (mapped !== undefined) {
      digits += mapped;
    }
  }

  if (digits.length > 0) {
    return digits;
  }

  return input.replace(/\D/g, '');
}

/** Last contiguous run of exactly four single-digit tokens (numeric or spoken). */
function findFourDigitRun(input: string): string | null {
  const lower = input.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = lower.split(/\s+/).filter(Boolean);
  let run = '';

  for (const token of tokens) {
    if (/^\d{4}$/.test(token)) {
      return token;
    }

    let digit: string | undefined;
    if (/^\d$/.test(token)) {
      digit = token;
    } else {
      digit = DIGIT_WORDS[token];
    }

    if (digit === undefined || digit.length !== 1) {
      run = '';
      continue;
    }

    run += digit;
    if (run.length > 4) {
      run = run.slice(-4);
    }

    if (run.length === 4) {
      return run;
    }
  }

  const embedded = input.match(/\b(\d{4})\b/);
  return embedded?.[1] ?? null;
}

export function normalizeLastFour(input: string): LastFourNormalizeResult {
  const trimmed = input.trim();
  const digits = tokenizeDigits(trimmed);

  if (digits.length === 4) {
    return { ok: true, lastFour: digits };
  }

  const run = findFourDigitRun(trimmed);
  if (run) {
    return { ok: true, lastFour: run };
  }

  if (digits.length === 0) {
    return { ok: false, reason: 'no_digits', digits: '' };
  }

  if (digits.length < 4) {
    return { ok: false, reason: 'too_few', digits };
  }

  return { ok: false, reason: 'too_many', digits };
}
