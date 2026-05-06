import type { BotPhase, Fill, PerformanceSnapshot } from './types';

/**
 * Cypheus monitoring narrative — translates bot state changes into
 * human-readable messages shown in the left rail.
 *
 * Pure function, deterministic given the same input. No side effects.
 */

export type CypheusEventType =
  | 'scan'
  | 'position-opened'
  | 'tp-hit'
  | 'sl-hit'
  | 'streak-milestone'
  | 'anomaly'
  | 'pnl-milestone'
  | 'idle';

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

/**
 * Compare prev vs next state and produce any narrative messages that
 * should be emitted. Multiple messages can fire in one diff (e.g. a fill
 * closes profitable AND crosses a PnL milestone).
 */
export function generateEventNarrations(input: Input): CypheusMessage[] {
  const { prevSnap, nextSnap, prevFills, nextFills, phase } = input;
  const now = input.now ?? Date.now();
  const msgs: CypheusMessage[] = [];
  let counter = 0;
  const mk = (
    type: CypheusEventType,
    text: string,
    ts = now,
  ): CypheusMessage => ({
    id: `cy-${ts}-${counter++}`,
    type,
    text,
    ts,
  });

  // 1. Just-deployed bots get scanning messages instead of trade narrative.
  if (phase === 'just-deployed') {
    msgs.push(mk('scan', 'Scanning markets · est. first signal in 1–3h'));
    msgs.push(
      mk('scan', "I'll watch BB upper band cross + RSI <70 for you."),
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
      msgs.push(
        mk(
          'position-opened',
          `Just opened ${f.side} @ ${entry} · stop at ${stop}`,
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
            : ' · entry conditions met cleanly.';
        msgs.push(
          mk(
            'tp-hit',
            `${f.status} hit! +$${f.pnl.toFixed(2)}${tail}`,
            f.closedAt,
          ),
        );
      } else {
        msgs.push(
          mk(
            'sl-hit',
            `SL hit · -$${Math.abs(f.pnl).toFixed(2)}.`,
            f.closedAt,
          ),
        );
      }
    }
  }

  // 4. Streak milestone (new high water mark, >= threshold).
  if (
    prevSnap &&
    nextSnap.winStreak > prevSnap.winStreak &&
    nextSnap.winStreak >= STREAK_MILESTONE_MIN
  ) {
    msgs.push(
      mk(
        'streak-milestone',
        `Win streak ${nextSnap.winStreak} · personal best!`,
      ),
    );
  }

  // 5. Anomaly: 3+ SL in last 5 closed trades.
  const lastClosed = nextFills.filter((f) => f.closedAt !== null).slice(-ANOMALY_LOSS_WINDOW);
  const slCount = lastClosed.filter((f) => f.status === 'SL').length;
  if (slCount >= ANOMALY_LOSS_THRESHOLD) {
    msgs.push(
      mk(
        'anomaly',
        `${slCount} SL hits in last ${lastClosed.length} trades · maybe revisit your stop level?`,
      ),
    );
  }

  // 6. PnL crossed a round threshold.
  if (prevSnap) {
    for (const t of PNL_THRESHOLDS) {
      if (prevSnap.totalPnL < t && nextSnap.totalPnL >= t) {
        msgs.push(
          mk(
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
 * Bootstrap message — emitted once when the page first loads with mature
 * data, so the rail isn't empty even if no events have fired since the
 * page mounted.
 */
export function bootstrapNarrative(
  snap: PerformanceSnapshot,
  fills: Fill[],
): CypheusMessage[] {
  const now = Date.now();
  const msgs: CypheusMessage[] = [];

  if (snap.winStreak >= STREAK_MILESTONE_MIN) {
    msgs.push({
      id: `cy-boot-streak-${now}`,
      type: 'streak-milestone',
      text: `Win streak ${snap.winStreak} · personal best!`,
      ts: now,
    });
  }

  // Pull the most recent closed fill as a "what just happened" anchor.
  const lastClosed = [...fills]
    .filter((f) => f.closedAt !== null)
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))[0];
  if (lastClosed) {
    if (lastClosed.pnl > 0) {
      msgs.push({
        id: `cy-boot-tp-${now}`,
        type: 'tp-hit',
        text: `${lastClosed.status} hit! +$${lastClosed.pnl.toFixed(2)}`,
        ts: lastClosed.closedAt ?? now,
      });
    } else if (lastClosed.pnl < 0) {
      msgs.push({
        id: `cy-boot-sl-${now}`,
        type: 'sl-hit',
        text: `SL hit · -$${Math.abs(lastClosed.pnl).toFixed(2)}.`,
        ts: lastClosed.closedAt ?? now,
      });
    }
  }

  msgs.push({
    id: `cy-boot-scan-${now}`,
    type: 'scan',
    text: 'Watching for Bollinger upper band cross + RSI <70.',
    ts: now,
  });

  return msgs;
}
