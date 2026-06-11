import type { BotCardData } from './BotCard';
import type { PresentationalState } from './presentational-state';

export type FilterCategory = 'all' | 'live' | 'dry-run' | 'attention';

/** Non-"all" categories mapped to the presentational states they include. */
const CATEGORY_STATES: Record<
  Exclude<FilterCategory, 'all'>,
  PresentationalState[]
> = {
  live: ['LIVE'],
  'dry-run': ['DRY-RUN'],
  // PAUSED folds in here: an idle bot is capital the user should act on (resume),
  // same "needs your action" framing as ERROR / BACKTEST_FAILED / NEW. It sorts to
  // the bottom of the group though — see bot-sort.ts (PAUSED stays the lowest bucket).
  attention: ['ERROR', 'BACKTEST_FAILED', 'NEW', 'PAUSED'],
};

// NOTE: transient states (STARTING / STOPPING / BACKTESTING) intentionally belong
// to NO chip category — they resolve in seconds, sort to the top of "All" (see
// bot-sort.ts), and carry animated badges, so a dedicated filter added clutter.

export function matchesCategory(
  state: PresentationalState,
  cat: FilterCategory,
): boolean {
  if (cat === 'all') return true;
  return CATEGORY_STATES[cat].includes(state);
}

export function filterByCategory(
  cards: BotCardData[],
  cat: FilterCategory,
): BotCardData[] {
  return cards.filter((c) => matchesCategory(c.state, cat));
}

export function countByCategory(
  cards: BotCardData[],
): Record<FilterCategory, number> {
  const counts: Record<FilterCategory, number> = {
    all: cards.length,
    live: 0,
    'dry-run': 0,
    attention: 0,
  };
  const cats = Object.keys(CATEGORY_STATES) as Array<
    Exclude<FilterCategory, 'all'>
  >;
  for (const c of cards) {
    for (const cat of cats) {
      if (matchesCategory(c.state, cat)) counts[cat] += 1;
    }
  }
  return counts;
}

/** Display order + labels for the chip row. */
export const FILTER_CHIPS: Array<{ key: FilterCategory; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'live', label: 'Live' },
  { key: 'dry-run', label: 'Dry-run' },
];
