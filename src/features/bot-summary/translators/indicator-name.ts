/**
 * Translate an FE indicator-output id (the canonical form produced by
 * `indicator-registry.buildId`) into a friendly English phrase.
 *
 * Examples:
 *   'RSI-14'         → 'RSI(14)'
 *   'SMA-50'         → 'the 50-period simple moving average'
 *   'EMA-20'         → 'the 20-period exponential moving average'
 *   'MACD-12-26-9'   → 'MACD line'
 *   'BBANDS-20-2-2'  → 'Bollinger Bands'
 *   'STOCH-5-3-3'    → 'Stochastic %K'
 *   'candle.close'   → 'candle close'
 *   anything else    → raw id + push gap
 */
import type { SummaryBlockId, SummaryInline, TranslationGap } from '../types';
import { t } from '../types';

interface TranslateOpts {
  section: SummaryBlockId;
  field: string;
  gaps: TranslationGap[];
}

export function translateIndicatorRef(
  rawId: string | null | undefined,
  opts: TranslateOpts,
): SummaryInline[] {
  if (!rawId) {
    return [t('?', 'warning')];
  }

  // candle channels
  if (rawId.startsWith('candle.')) {
    const channel = rawId.slice('candle.'.length);
    return [t(`candle ${channel}`)];
  }

  // RSI-14, SMA-50, EMA-20, ADX-14 → "{Friendly}"
  const periodMatch = rawId.match(/^([A-Z]+)-(\d+)$/);
  if (periodMatch) {
    const [, base, period] = periodMatch;
    switch (base) {
      case 'RSI':
        return [t(`RSI(${period})`)];
      case 'SMA':
        return [t(`the ${period}-period simple moving average`)];
      case 'EMA':
        return [t(`the ${period}-period exponential moving average`)];
      case 'ADX':
        return [t(`ADX(${period})`)];
      default:
        // Falls through to prefix checks / gap below.
        break;
    }
  }

  // Multi-segment ids — match by prefix (STOCHRSI before STOCH).
  if (rawId.startsWith('BBANDS-')) return [t('Bollinger Bands')];
  if (rawId.startsWith('MACD-')) return [t('MACD line')];
  if (rawId.startsWith('STOCHRSI-')) return [t('Stochastic RSI')];
  if (rawId.startsWith('STOCH-')) return [t('Stochastic %K')];

  // Unknown shape — push gap, render raw with warning tone so user sees it.
  opts.gaps.push({
    section: opts.section,
    field: opts.field,
    rawValue: rawId,
    reason: 'Unknown indicator output format',
  });
  return [t(rawId, 'warning')];
}
