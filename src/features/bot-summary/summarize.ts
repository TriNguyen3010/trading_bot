/**
 * Orchestrator: turns a `BuilderState` into structured summary blocks.
 * Pure function — no side effects, no React. Returns blocks + an
 * accumulated list of "translation gaps" (fields the translators
 * couldn't decode), so the renderer can show an honest "couldn't fully
 * translate" footer instead of guessing.
 *
 * Memoise in the React component on the state reference.
 *
 * See Spec/Phase 1/bot_summary_plan.md §13 for the architecture.
 */
import type { BuilderState } from '@/types/builder.types';
import type { SummarizeResult, SummaryBlock, TranslationGap } from './types';
import { translateMarket } from './translators/market';
import { translateRisk } from './translators/risk';
import { translateConditionGroup } from './translators/condition';
import { translateDirection } from './translators/direction';
import { translateExit } from './translators/close-method';
import { flattenTreeToLegacy } from '@/lib/condition-tree';

export function summarizeBot(state: BuilderState): SummarizeResult {
  const gaps: TranslationGap[] = [];

  // ── Market ────────────────────────────────────────────────────
  const market: SummaryBlock = {
    id: 'market',
    icon: 'MapPin',
    title: 'Market',
    lines: translateMarket(state.botConfig, gaps),
  };

  // ── Risk ──────────────────────────────────────────────────────
  const riskResult = translateRisk(state.botConfig);
  const risk: SummaryBlock = {
    id: 'risk',
    icon: 'Shield',
    title: 'Risk',
    lines: riskResult.lines,
    warning: riskResult.warning,
  };

  // ── Entry ─────────────────────────────────────────────────────
  const entryVerb =
    state.directionForm.direction === 'long'
      ? 'Buys long when'
      : 'Sells short when';
  const entry: SummaryBlock = {
    id: 'entry',
    icon: 'TrendingUp',
    title: 'Entry',
    lines: translateConditionGroup(
      flattenTreeToLegacy(state.strategy.entryConditions),
      {
        verb: entryVerb,
        emptyPhrase:
          "No entry conditions defined yet — bot won't enter trades.",
        section: 'entry',
        gaps,
      },
    ),
  };

  // ── Action ────────────────────────────────────────────────────
  const action: SummaryBlock = {
    id: 'action',
    icon: 'Target',
    title: 'Action',
    lines: translateDirection(state.directionForm),
  };

  // ── Exit ──────────────────────────────────────────────────────
  const exitResult = translateExit(
    state.closeMethod,
    state.directionForm.direction,
    gaps,
  );
  const exit: SummaryBlock = {
    id: 'exit',
    icon: 'LogOut',
    title: 'Exit',
    lines: exitResult.lines,
    warning: exitResult.warning,
  };

  // ── Notifications ─────────────────────────────────────────────
  // No telegram form yet — serializer hardcodes telegram disabled, so
  // the summary just states that. When a telegram UI lands, expand to
  // honor enabled/event flags from state.
  const notifications: SummaryBlock = {
    id: 'notifications',
    icon: 'Bell',
    title: 'Notifications',
    lines: [
      [
        {
          text: 'Telegram notifications disabled.',
        },
      ],
    ],
  };

  return {
    blocks: [market, risk, entry, action, exit, notifications],
    gaps,
  };
}
