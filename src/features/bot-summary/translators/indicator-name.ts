/**
 * Translate an FE indicator-output id (the canonical form produced by
 * `indicator-registry.buildId`) into a friendly English phrase.
 *
 * Examples:
 *   'RSI-14'         → 'RSI(14)'
 *   'MA-50'          → 'the 50-period moving average'
 *   'MACD-12-26-9'   → 'MACD line'
 *   'BB-20'          → 'Bollinger Bands(20)'
 *   'ATR-14'         → 'ATR(14)'
 *   'Stoch-14-3-3'   → 'Stochastic %K'
 *   'candle.close'   → 'candle close'
 *   anything else    → raw id + push gap
 */
import type {
  SummaryBlockId,
  SummaryInline,
  TranslationGap,
} from '../types';
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

  // RSI-14, MA-50, BB-20, ATR-14 → "{Friendly}({period})"
  const periodMatch = rawId.match(/^([A-Z]+)-(\d+)$/);
  if (periodMatch) {
    const [, base, period] = periodMatch;
    switch (base) {
      case 'RSI':
        return [t(`RSI(${period})`)];
      case 'MA':
        return [t(`the ${period}-period moving average`)];
      case 'BB':
        return [t(`Bollinger Bands(${period})`)];
      case 'ATR':
        return [t(`ATR(${period})`)];
      default:
        // Falls through to gap below.
        break;
    }
  }

  // MACD-12-26-9 — multiple periods, just say "MACD line"
  if (rawId.startsWith('MACD-')) {
    return [t('MACD line')];
  }

  // Stoch-14-3-3 — multiple periods, just say "Stochastic %K"
  if (rawId.startsWith('Stoch-')) {
    return [t('Stochastic %K')];
  }

  // Unknown shape — push gap, render raw with warning tone so user sees it.
  opts.gaps.push({
    section: opts.section,
    field: opts.field,
    rawValue: rawId,
    reason: 'Unknown indicator output format',
  });
  return [t(rawId, 'warning')];
}
