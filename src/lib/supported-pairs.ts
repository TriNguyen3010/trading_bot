/**
 * Supported trading pairs — sourced from the BE-provided list of the top-100
 * Hyperliquid perpetuals by volume: `BE/hyperliquid_top100_volume_by_dayNtlVlm.csv`.
 *
 * Hyperliquid perps are USDC-margined, so every pair is `<TOKEN>/USDC:USDC`
 * (UI form `<TOKEN>-USDC`). Keep this list in sync with the CSV.
 *
 * NOTE: a few tokens carry a meaningful lowercase prefix (`kPEPE`, `kSHIB`,
 * `kBONK` = the 1000× variants). Their case MUST be preserved when building the
 * pair string — see {@link normalizePairInput}.
 */
export const HYPERLIQUID_TOKENS: readonly string[] = [
  'BTC',
  'ETH',
  'SOL',
  'HYPE',
  'TAO',
  'XRP',
  'ZEC',
  'VVV',
  'PAXG',
  'FARTCOIN',
  'AAVE',
  'PUMP',
  'SUI',
  'DOGE',
  'kPEPE',
  'LINK',
  'ADA',
  'ZRO',
  'BNB',
  'LIT',
  'WLD',
  'MON',
  'AVAX',
  'XMR',
  'TRUMP',
  'NEAR',
  'BCH',
  'XPL',
  'WLFI',
  'ENA',
  'CRV',
  'ASTER',
  'JUP',
  'VIRTUAL',
  'APT',
  'FET',
  'CC',
  'DOT',
  'LDO',
  'DOOD',
  'LTC',
  'TRX',
  'ARB',
  'SKY',
  'SEI',
  'GOAT',
  'WIF',
  'OP',
  'SPX',
  'UNI',
  'kSHIB',
  'ONDO',
  'XLM',
  'MORPHO',
  'DYDX',
  'PENGU',
  'TON',
  'kBONK',
  'TIA',
  'RENDER',
  'HEMI',
  'PENDLE',
  'MOODENG',
  'USUAL',
  'KAITO',
  'BERA',
  'INJ',
  'ETC',
  'KAS',
  'CAKE',
  'FIL',
  'STABLE',
  'POL',
  '2Z',
  'AERO',
  'EIGEN',
  'SCR',
  'GRIFFAIN',
  'JTO',
  'AXS',
  'IP',
  'PROMPT',
  'YGG',
  'HBAR',
  'ETHFI',
  'STRK',
  'FTT',
  'MNT',
  'RESOLV',
  'ALGO',
  'AIXBT',
  'REZ',
  'ZEREBRO',
  'MAVIA',
  'PYTH',
  'SOPH',
  'ANIME',
  'TURBO',
  'AR',
  'ICP',
];

/** UI-form pairs (`<TOKEN>-USDC`) for the builder pair picker. */
export const SUPPORTED_PAIRS: readonly string[] = HYPERLIQUID_TOKENS.map(
  (t) => `${t}-USDC`,
);

/** Case-insensitive token → canonical-case token (preserves `kPEPE` etc.). */
const TOKEN_BY_UPPER = new Map(
  HYPERLIQUID_TOKENS.map((t) => [t.toUpperCase(), t]),
);

/**
 * Normalize a free-typed / picked pair to canonical form:
 * - base token → its canonical case if it's a supported token (so `kpepe`
 *   becomes `kPEPE`), otherwise uppercased;
 * - quote → uppercased.
 * Replaces a blind `.toUpperCase()` which would mangle `kPEPE`/`kSHIB`/`kBONK`.
 */
export function normalizePairInput(raw: string): string {
  const trimmed = raw.trim();
  const dash = trimmed.indexOf('-');
  if (dash < 0) return trimmed.toUpperCase();
  const base = trimmed.slice(0, dash);
  const quote = trimmed.slice(dash + 1);
  const canonicalBase =
    TOKEN_BY_UPPER.get(base.toUpperCase()) ?? base.toUpperCase();
  return `${canonicalBase}-${quote.toUpperCase()}`;
}
