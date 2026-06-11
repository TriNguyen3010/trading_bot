/**
 * Templates module entry point. Re-exports the registry + the most
 * useful types so consumers can `import { BUILT_IN_TEMPLATES, applyTemplate }
 * from '@/templates'` without reaching into nested files.
 */
import type { BotTemplate } from './types';
import { cypheusDefault } from './catalog/cypheus-default';
import { rsiOversoldEth1h } from './catalog/rsi-oversold-eth-1h';
import { breakoutBtc15m } from './catalog/breakout-btc-15m';
import { roiScalpEth5m } from './catalog/roi-scalp-eth-5m';
import { multiTfTrendAlts } from './catalog/multi-tf-trend-alts';
import { macdMomentumBnb } from './catalog/macd-momentum-bnb';
import { conservativeDcaBtc } from './catalog/conservative-dca-btc';
import { scalpingBtc1m } from './catalog/scalping-btc-1m';
import { testAlwaysOnBtc1m } from './catalog/test-always-on-btc-1m';

/** QA-only templates — exist purely to exercise the live/dry-run pipeline and
 * deliberately churn trades / lose fees. They must NEVER reach a production
 * build where a real user could pick one and Go Live (see PR #42 review), so
 * they are gated behind the dev flag below. */
const TEST_ONLY_TEMPLATES: readonly BotTemplate[] = [testAlwaysOnBtc1m];

/** Real starter templates shipped to every build. Order = display order in
 * the gallery — grouped beginner → advanced so the most approachable picks
 * land in the first row of the grid. */
const PRODUCTION_TEMPLATES: readonly BotTemplate[] = [
  // Beginner
  rsiOversoldEth1h,
  conservativeDcaBtc,
  roiScalpEth5m,
  // Intermediate
  cypheusDefault,
  breakoutBtc15m,
  macdMomentumBnb,
  // Advanced
  multiTfTrendAlts,
  scalpingBtc1m,
];

/** Assemble the gallery list. In dev the QA test template is prepended so it's
 * easy to find; production builds strip it entirely. Pure function of the flag
 * so it's unit-testable without rebuilding for prod mode. */
export function buildBuiltInTemplates(
  includeTestOnly: boolean,
): readonly BotTemplate[] {
  return includeTestOnly
    ? [...TEST_ONLY_TEMPLATES, ...PRODUCTION_TEMPLATES]
    : PRODUCTION_TEMPLATES;
}

/** Built-in starter templates shipped with the bundle. */
export const BUILT_IN_TEMPLATES: readonly BotTemplate[] = buildBuiltInTemplates(
  import.meta.env.DEV,
);

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
