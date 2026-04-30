/**
 * Market block: pair / market type / exchange / timeframe.
 * Output:
 *   "BTC/USDC perpetual futures on Binance, 5-minute candles."
 *   "ETH/USDC spot on Binance, 1-hour candles."
 *   "Pair not set yet." (when empty / malformed)
 */
import type { BotConfigForm } from '@/types/builder.types';
import type { SummaryLine, TranslationGap } from '../types';
import { t, line } from '../types';
import { parseUiPair } from '@/lib/pair-format';

const TIMEFRAME_LABEL: Record<string, string> = {
  '1m': '1-minute candles',
  '3m': '3-minute candles',
  '5m': '5-minute candles',
  '15m': '15-minute candles',
  '30m': '30-minute candles',
  '1h': '1-hour candles',
  '2h': '2-hour candles',
  '4h': '4-hour candles',
  '6h': '6-hour candles',
  '8h': '8-hour candles',
  '12h': '12-hour candles',
  '1d': 'daily candles',
  '3d': '3-day candles',
  '1w': 'weekly candles',
};

function exchangeLabel(raw: string): string {
  // Canonical-case the exchange name. The codebase only uses
  // lower-case ids ('binance', 'bybit', …) so a simple title-case is
  // sufficient.
  if (!raw) return 'an exchange';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function translateMarket(
  c: BotConfigForm,
  gaps: TranslationGap[],
): SummaryLine[] {
  if (!c.pair.trim()) {
    return [line(t('Pair not set yet.', 'warning'))];
  }

  const parsed = parseUiPair(c.pair);
  if (!parsed) {
    gaps.push({
      section: 'market',
      field: 'pair',
      rawValue: c.pair,
      reason: 'Pair format expected BASE-QUOTE',
    });
    return [line(t(`Pair "${c.pair}" not in BASE-QUOTE format.`, 'warning'))];
  }

  const marketLabel =
    c.marketType === 'futures' ? 'perpetual futures' : 'spot';
  const tfLabel = TIMEFRAME_LABEL[c.timeframe] ?? `${c.timeframe} candles`;

  return [
    line(
      t(
        `${parsed.base}/${parsed.quote} ${marketLabel} on ${exchangeLabel(c.exchange)}, ${tfLabel}.`,
      ),
    ),
  ];
}
