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

export function jsonPairToUi(jsonPair: string): string {
  // "BTC/USDC:USDC" -> "BTC-USDC", "BTC/USDC" -> "BTC-USDC"
  const [main] = jsonPair.split(':');
  if (!main || !main.includes('/')) return jsonPair;
  const [base, quote] = main.split('/');
  return `${base}-${quote}`;
}
