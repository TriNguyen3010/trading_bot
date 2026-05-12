/**
 * Templates module entry point. Re-exports the registry + the most
 * useful types so consumers can `import { BUILT_IN_TEMPLATES, applyTemplate }
 * from '@/templates'` without reaching into nested files.
 */
import type { BotTemplate } from './types';
import { cypheusDefault } from './catalog/cypheus-default';
import { rsiOversoldEth1h } from './catalog/rsi-oversold-eth-1h';
import { breakoutBtc15m } from './catalog/breakout-btc-15m';
import { gridStableUsdtPairs } from './catalog/grid-stable-usdt-pairs';
import { multiTfTrendAlts } from './catalog/multi-tf-trend-alts';
import { macdMomentumBnb } from './catalog/macd-momentum-bnb';
import { conservativeDcaBtc } from './catalog/conservative-dca-btc';
import { scalpingBtc1m } from './catalog/scalping-btc-1m';

/** Built-in starter templates shipped with the bundle. Order = display
 * order in the gallery — currently grouped beginner → advanced so the
 * most approachable picks land in the first row of the grid. */
export const BUILT_IN_TEMPLATES: readonly BotTemplate[] = [
  // Beginner
  rsiOversoldEth1h,
  conservativeDcaBtc,
  gridStableUsdtPairs,
  // Intermediate
  cypheusDefault,
  breakoutBtc15m,
  macdMomentumBnb,
  // Advanced
  multiTfTrendAlts,
  scalpingBtc1m,
] as const;

export function getTemplateById(id: string): BotTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}

export type {
  BotTemplate,
  TemplateDifficulty,
  TemplateRisk,
  TemplateStateSnapshot,
} from './types';

export { TEMPLATE_SCHEMA_VERSION } from './types';
export { applyTemplate, TemplateConflictError } from './apply';
export type { ApplyTemplateOptions } from './apply';
export { useTemplateTrackingStore } from './store';
