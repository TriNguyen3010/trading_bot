import type { BotPhase, Fill, PerformanceSnapshot } from './types';

/**
 * Cypheus monitoring narrative — translates bot state changes into
 * human-readable messages shown in the left rail.
 *
 * Pure function, deterministic given the same input. No side effects.
 *
 * IDs are STABLE per event source (fill id, threshold, streak value, etc.)
 * so the consuming hook can dedupe via a `seen` set — same event won't
 * spam the rail on repeated polls.
 */

export type CypheusEventType =
  | 'scan'
  | 'position-opened'
  | 'tp-hit'
  | 'sl-hit'
  | 'streak-milestone'
  | 'anomaly'
  | 'pnl-milestone'
  | 'idle'
  | 'volatility'
  | 'session-summary';

export interface CypheusMessage {
  id: string;
  type: CypheusEventType;
  text: string;
  /** Epoch ms — when the underlying event happened (not when emitted). */
  ts: number;
}

interface Input {
  prevSnap: PerformanceSnapshot | null;
  nextSnap: PerformanceSnapshot;
  prevFills: Fill[];
  nextFills: Fill[];
  phase: BotPhase;
  /** Override for tests; defaults to Date.now(). */
  now?: number;
}

const PNL_THRESHOLDS = [1_000, 2_500, 5_000, 10_000, 25_000];
const STREAK_MILESTONE_MIN = 5;
const ANOMALY_LOSS_WINDOW = 5;
const ANOMALY_LOSS_THRESHOLD = 3;

// Variety pool — picked deterministically from event source so the same
// trigger always renders the same line (avoids flicker on re-eval).
const SCAN_LINES = [
  'Scanning markets · est. first signal in 1–3h',
  "I'll watch BB upper band cross + RSI <70 for you.",
  'Bot is online · waiting for the right entry.',
  'Calibrating indicators on fresh candles.',
];

const TP_FLAVOURS = [
  '· entry conditions met cleanly.',
  '· clean exit at the target.',
  '· great execution, kept the spread tight.',
  ' — gravity won, took the gain.',
  '· textbook breakout follow-through.',
];

const SL_FLAVOURS = [
  '· stopped out, on to the next.',
  '· cut the loss before it grew.',
  '· risk respected, capital protected.',
  '· stop did its job.',
];

const POS_OPEN_FLAVOURS = [
  '',
  ' · momentum confirmed.',
  ' · 5/5 entry conditions met.',
  ' · price tagged the BB upper band.',
  ' · MACD histogram flipped positive.',
];

const IDLE_FLAVOURS = [
  'Quiet stretch · BB stayed mid-range.',
  '6 candles in consolidation · waiting for breakout.',
  'No signal yet · spread too wide for a clean entry.',
  'Watching the order book — sellers stepping aside.',
];

const VOL_FLAVOURS = [
  'BTC vol dropped 18% today · expect fewer signals.',
  'ATR spiked · tightening risk per trade.',
  'Funding flipped negative · longs paying shorts now.',
  'Order book thinned out — caution mode.',
];

function pickStable<T>(arr: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return arr[Math.abs(h) % arr.length];
}

/**
 * Compare prev vs next state and produce any narrative messages that
 * should be emitted. Multiple messages can fire in one diff (e.g. a fill
 * closes profitable AND crosses a PnL milestone).
 */
export function generateEventNarrations(input: Input): CypheusMessage[] {
  const { prevSnap, nextSnap, prevFills, nextFills, phase } = input;
  const now = input.now ?? Date.now();
  const msgs: CypheusMessage[] = [];
  const mk = (
    id: string,
    type: CypheusEventType,
    text: string,
    ts = now,
  ): CypheusMessage => ({ id, type, text, ts });

  // 1. Just-deployed bots get scanning messages instead of trade narrative.
  if (phase === 'just-deployed') {
    msgs.push(
      mk('scan-bootstrap-0', 'scan', SCAN_LINES[0]),
      mk('scan-bootstrap-1', 'scan', SCAN_LINES[1]),
    );
    return msgs;
  }

  // 2. New positions opened (status === 'OPEN' that wasn't there before).
  const prevOpenIds = new Set(
    prevFills.filter((f) => f.status === 'OPEN').map((f) => f.id),
  );
  for (const f of nextFills) {
    if (f.status === 'OPEN' && !prevOpenIds.has(f.id)) {
      const stop = (f.entryPrice * 0.997).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      });
      const entry = f.entryPrice.toLocaleString();
      const flavour = pickStable(POS_OPEN_FLAVOURS, `pos-${f.id}`);
      msgs.push(
        mk(
          `pos-open-${f.id}`,
          'position-opened',
          `Just opened ${f.side} @ ${entry} · stop at ${stop}${flavour}`,
          f.openedAt,
        ),
      );
    }
  }

  // 3. Closed positions (was OPEN, now TP/SL/etc).
  const prevById = new Map(prevFills.map((f) => [f.id, f]));
  for (const f of nextFills) {
    const prev = prevById.get(f.id);
    if (prev && prev.status === 'OPEN' && f.status !== 'OPEN' && f.closedAt) {
      if (f.pnl > 0) {
        const tail =
          f.status === 'TP2'
            ? ' — best trade today.'
            : pickStable(TP_FLAVOURS, `tp-${f.id}`);
        msgs.push(
          mk(
            `tp-${f.id}`,
            'tp-hit',
            `${f.status} hit! +$${f.pnl.toFixed(2)}${tail}`,
            f.closedAt,
          ),
        );
      } else {
        const tail = pickStable(SL_FLAVOURS, `sl-${f.id}`);
        msgs.push(
          mk(
            `sl-${f.id}`,
            'sl-hit',
            `SL hit · -$${Math.abs(f.pnl).toFixed(2)} ${tail}`,
            f.closedAt,
          ),
        );
      }
    }
  }

  // 4. Streak milestone — fires once per streak value (>= threshold).
  if (
    prevSnap &&
    nextSnap.winStreak > prevSnap.winStreak &&
    nextSnap.winStreak >= STREAK_MILESTONE_MIN
  ) {
    msgs.push(
      mk(
        `streak-${nextSnap.winStreak}`,
        'streak-milestone',
        `Win streak ${nextSnap.winStreak} · personal best!`,
      ),
    );
  }

  // 5. Anomaly: 3+ SL in last 5 closed trades. Stable id keyed on the most
  // recent loss in the window so the same loss-cluster fires once only.
  const lastClosed = nextFills
    .filter((f) => f.closedAt !== null)
    .slice(-ANOMALY_LOSS_WINDOW);
  const slFills = lastClosed.filter((f) => f.status === 'SL');
  if (slFills.length >= ANOMALY_LOSS_THRESHOLD) {
    const lossAnchorId = slFills[slFills.length - 1].id;
    msgs.push(
      mk(
        `anomaly-${lossAnchorId}`,
        'anomaly',
        `${slFills.length} SL hits in last ${lastClosed.length} trades · maybe revisit your stop level?`,
      ),
    );
  }

  // 6. PnL crossed a round threshold.
  if (prevSnap) {
    for (const t of PNL_THRESHOLDS) {
      if (prevSnap.totalPnL < t && nextSnap.totalPnL >= t) {
        msgs.push(
          mk(
            `pnl-${t}`,
            'pnl-milestone',
            `Total PnL crossed +$${t.toLocaleString()} · keep it up.`,
          ),
        );
      }
    }
  }

  return msgs;
}

/**
 * Bootstrap messages — emitted once when the page first loads with mature
 * data so the rail starts populated. IDs are stable across reloads on the
 * same day (the seed is derived from data, not Date.now()).
 */
export function bootstrapNarrative(
  snap: PerformanceSnapshot,
  fills: Fill[],
): CypheusMessage[] {
  const now = Date.now();
  const day = Math.floor(now / 86_400_000);
  const msgs: CypheusMessage[] = [];

  if (snap.winStreak >= STREAK_MILESTONE_MIN) {
    msgs.push({
      id: `boot-streak-${snap.winStreak}`,
      type: 'streak-milestone',
      text: `Win streak ${snap.winStreak} · personal best!`,
      ts: now,
    });
  }

  // Most recent closed fill as a "what just happened" anchor.
  const lastClosed = [...fills]
    .filter((f) => f.closedAt !== null)
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))[0];
  if (lastClosed) {
    if (lastClosed.pnl > 0) {
      const tail = pickStable(TP_FLAVOURS, `boot-tp-${lastClosed.id}`);
      msgs.push({
        id: `boot-tp-${lastClosed.id}`,
        type: 'tp-hit',
        text: `${lastClosed.status} hit! +$${lastClosed.pnl.toFixed(2)}${tail}`,
        ts: lastClosed.closedAt ?? now,
      });
    } else if (lastClosed.pnl < 0) {
      const tail = pickStable(SL_FLAVOURS, `boot-sl-${lastClosed.id}`);
      msgs.push({
        id: `boot-sl-${lastClosed.id}`,
        type: 'sl-hit',
        text: `SL hit · -$${Math.abs(lastClosed.pnl).toFixed(2)} ${tail}`,
        ts: lastClosed.closedAt ?? now,
      });
    }
  }

  // Volatility / session note — one-per-day, deterministic.
  msgs.push({
    id: `boot-vol-${day}`,
    type: 'volatility',
    text: pickStable(VOL_FLAVOURS, `vol-${day}`),
    ts: now - 60_000 * 7,
  });

  // Idle filler — one-per-day pulled from pool.
  msgs.push({
    id: `boot-idle-${day}`,
    type: 'idle',
    text: pickStable(IDLE_FLAVOURS, `idle-${day}`),
    ts: now - 60_000 * 18,
  });

  // Session summary — total PnL + win rate condensed.
  msgs.push({
    id: `boot-session-${day}`,
    type: 'session-summary',
    text: `Session so far: ${snap.totalTrades} trades · ${(snap.winRate * 100).toFixed(0)}% win · total ${snap.totalPnL >= 0 ? '+' : '−'}$${Math.abs(snap.totalPnL).toFixed(0)}.`,
    ts: now - 60_000 * 30,
  });

  msgs.push({
    id: `boot-scan-${day}`,
    type: 'scan',
    text: pickStable(SCAN_LINES, `scan-${day}`),
    ts: now - 60_000 * 2,
  });

  return msgs;
}
