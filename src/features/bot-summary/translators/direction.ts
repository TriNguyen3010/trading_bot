/**
 * Action block: direction + order type + (optional) limit offset.
 *
 * Examples:
 *   "Goes Long with Market orders (fills immediately at best price)."
 *   "Goes Short with Limit orders, placed 0.05% below market."
 */
import type { DirectionForm } from '@/types/builder.types';
import type { SummaryLine } from '../types';
import { t, line } from '../types';

export function translateDirection(d: DirectionForm): SummaryLine[] {
  const dirText = d.direction === 'long' ? 'Long' : 'Short';
  const dirTone = d.direction === 'long' ? 'bullish' : 'bearish';

  const lines: SummaryLine[] = [];

  if (d.orderType === 'market') {
    lines.push(
      line(
        t('Goes '),
        t(dirText, dirTone),
        t(' with Market orders (fills immediately at best price).'),
      ),
    );
  } else {
    // Limit order
    let offsetSuffix = '';
    if (d.limitOffsetPct != null && Number.isFinite(d.limitOffsetPct)) {
      const abs = Math.abs(d.limitOffsetPct);
      const side = d.limitOffsetPct < 0 ? 'below' : 'above';
      offsetSuffix = `, placed ${abs}% ${side} market`;
    }
    lines.push(
      line(
        t('Goes '),
        t(dirText, dirTone),
        t(` with Limit orders${offsetSuffix}.`),
      ),
    );
  }

  return lines;
}
