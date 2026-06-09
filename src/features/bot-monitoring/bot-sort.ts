import type { BotCardData } from './BotCard';
import type { PresentationalState } from './presentational-state';

/** Bucket priority — lower renders first (top-left). See spec §6.2. */
const BUCKET: Record<PresentationalState, number> = {
  ERROR: 0,
  BACKTEST_FAILED: 0,
  STARTING: 1,
  STOPPING: 1,
  BACKTESTING: 1,
  LIVE: 2,
  'DRY-RUN': 2,
  NEW: 3,
  PAUSED: 4,
};

function byBalanceDesc(a: BotCardData, b: BotCardData): number {
  return (b.balance ?? -Infinity) - (a.balance ?? -Infinity);
}

/** ISO date strings sort lexicographically; newest first = descending. */
function byCreatedDesc(a: BotCardData, b: BotCardData): number {
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

function compareCards(a: BotCardData, b: BotCardData): number {
  const ba = BUCKET[a.state];
  const bb = BUCKET[b.state];
  if (ba !== bb) return ba - bb;

  switch (ba) {
    case 0: {
      // Needs attention: ERROR before BACKTEST_FAILED, then name.
      const sa = a.state === 'ERROR' ? 0 : 1;
      const sb = b.state === 'ERROR' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
      break;
    }
    case 1: {
      // Working: balance desc, then name.
      const c = byBalanceDesc(a, b);
      if (c !== 0) return c;
      const n = a.name.localeCompare(b.name);
      if (n !== 0) return n;
      break;
    }
    case 2: {
      // Running: LIVE before DRY-RUN, then balance desc.
      const sa = a.state === 'LIVE' ? 0 : 1;
      const sb = b.state === 'LIVE' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const c = byBalanceDesc(a, b);
      if (c !== 0) return c;
      break;
    }
    case 3:
    case 4: {
      // New (bucket 3) then Idle/Paused (bucket 4): newest first within each.
      const c = byCreatedDesc(a, b);
      if (c !== 0) return c;
      break;
    }
  }
  return a.id - b.id; // stable final tiebreak
}

export function sortCards(cards: BotCardData[]): BotCardData[] {
  return [...cards].sort(compareCards);
}
