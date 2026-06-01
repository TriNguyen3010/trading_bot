/**
 * Pair format converter — UI display ↔ Freqtrade JSON format.
 *
 * UI (display, easy to read):
 *   "BTC-USDC", "ETH-USDT"
 *
 * JSON (Freqtrade convention "BASE/QUOTE:SETTLE" for perp futures or
 * "BASE/QUOTE" for spot):
 *   futures: "BTC/USDC:USDC"
 *   spot:    "BTC/USDC"
 *
 * NOTE: The user will provide a definitive CSV mapping (e.g. some pairs
 * settle in a different currency than the quote). Until then we apply the
 * default heuristic SETTLE = QUOTE for futures.
 */

import { STAKE_CURRENCIES } from './constants';

export interface PairParts {
  base: string;
  quote: string;
}

const DASH = '-';

export function parseUiPair(pair: string): PairParts | null {
  const trimmed = pair.trim().toUpperCase();
  if (!trimmed.includes(DASH)) return null;
  const [base, quote] = trimmed.split(DASH);
  if (!base || !quote) return null;
  return { base, quote };
}

export function uiPairToJson(
  uiPair: string,
  market: 'spot' | 'futures',
): string {
  const parts = parseUiPair(uiPair);
  if (!parts) return uiPair; // pass through if malformed; caller validates
  if (market === 'futures')
    return `${parts.base}/${parts.quote}:${parts.quote}`;
  return `${parts.base}/${parts.quote}`;
}

/**
 * Stake currency MUST equal the pair's quote currency: Freqtrade funds the
 * (paper or live) wallet in `stake_currency`, so a USDT wallet cannot trade
 * a USDC-quoted pair — the BE rejects that combo (was surfacing as a 500).
 * When the user picks a pair we auto-align the stake currency to its quote,
 * but only if that quote is one we actually offer; otherwise leave the
 * current choice untouched and let {@link validateBuilder} flag the mismatch.
 */
export function deriveStakeCurrency(uiPair: string, current: string): string {
  const parts = parseUiPair(uiPair);
  if (!parts) return current;
  return (STAKE_CURRENCIES as readonly string[]).includes(parts.quote)
    ? parts.quote
    : current;
}

export function jsonPairToUi(jsonPair: string): string {
  // "BTC/USDC:USDC" -> "BTC-USDC", "BTC/USDC" -> "BTC-USDC"
  const [main] = jsonPair.split(':');
  if (!main || !main.includes('/')) return jsonPair;
  const [base, quote] = main.split('/');
  return `${base}-${quote}`;
}
