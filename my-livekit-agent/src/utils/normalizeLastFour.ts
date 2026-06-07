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

export function normalizeLastFour(input: string): LastFourNormalizeResult {
  const digits = tokenizeDigits(input.trim());

  if (digits.length === 0) {
    return { ok: false, reason: 'no_digits', digits: '' };
  }

  if (digits.length < 4) {
    return { ok: false, reason: 'too_few', digits };
  }

  if (digits.length > 4) {
    return { ok: false, reason: 'too_many', digits };
  }

  return { ok: true, lastFour: digits };
}
