import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '../store/cypheus.store';
import { makeIndicator } from '@/features/indicators/indicator-registry';
import {
  isCurrent,
  sleep,
  startScript,
  typewriterMessage,
  typewriterValue,
} from './script-runner';
import { strings } from '@/i18n/en';

/**
 * Hardcoded magic-build demo, 2-nhịp variant per
 * Spec/Phase 1/two_phase_ui_plan.md §6.6.
 *
 * Phase 1 — Bot Basics:
 *   - Pin bot-config (legacy Setup/Configure tabs drawer).
 *   - Type pair / timeframe / mode / leverage.
 *   - Mark bot-config configured.
 *
 * Phase 2 — Strategy (composite drawer, single pin):
 *   - Pin entry-strategy ONCE — the StepDrawer dispatches to composite mode
 *     (3 accordion sections in one body) so the drawer doesn't unmount when
 *     we patch direction/close-method state. Fields fill in live across all
 *     3 sections.
 *   - Patch entry conditions, then direction, then close method (TP / SL).
 *   - Mark all 3 strategy sub-steps configured at once.
 *
 * Summary view auto-closes via CypheusSummaryView's 2s timer.
 */
export async function runMagicBuild(): Promise<void> {
  const ctx = startScript();
  const cy = () => useCypheusStore.getState();
  const builder = () => useBuilderStore.getState();

  cy().setState('thinking');
  cy().setAvatar('coding');
  await sleep(1000, ctx);
  if (!isCurrent(ctx)) return;

  cy().setState('building');
  await typewriterMessage(strings.cypheus.magicBuild.ack, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(300, ctx);
  await typewriterMessage(strings.cypheus.magicBuild.note, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(500, ctx);

  /* ──────────── Phase 1: Bot Basics ──────────── */

  builder().setBotName('Bollinger Breakout');
  builder().setStepStatus('bot-config', 'editing');
  builder().setDrawerTab('setup');
  cy().startCypheusDrawer('bot-config');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step1, ctx);
  await typewriterValue(
    (v) => builder().patchBotConfig({ pair: v }),
    'BTC-USDC',
    ctx,
    140,
  );
  if (!isCurrent(ctx)) return;
  await sleep(300, ctx);
  builder().patchBotConfig({ timeframe: '5m' });
  await sleep(300, ctx);
  builder().patchBotConfig({ tradingMode: 'dry-run' });
  await sleep(300, ctx);
  await typewriterValue(
    (v) => {
      const n = Number(v);
      builder().patchBotConfig({ leverage: Number.isFinite(n) ? n : 1 });
    },
    '20',
    ctx,
    160,
  );
  if (!isCurrent(ctx)) return;
  await sleep(400, ctx);
  await typewriterMessage(strings.cypheus.magicBuild.step1Comment, ctx);
  await sleep(800, ctx);
  builder().setStepStatus('bot-config', 'configured');
  if (!isCurrent(ctx)) return;

  /* ──────────── Phase 2: Strategy (composite, single pin) ──────────── */

  // Mark all 3 sub-steps as 'editing' — StrategyCard's derivePhaseStatus
  // surfaces this as 'editing' on the canvas, even though we only pin the
  // first sub-step in the drawer.
  builder().setStepStatus('entry-strategy', 'editing');
  builder().setStepStatus('direction', 'editing');
  builder().setStepStatus('close-method', 'editing');

  // Pin entry-strategy: parent BotBuilderCanvas detects this stepId is in
  // STRATEGY_SUB_STEPS and renders the composite drawer body. No further
  // switchCypheusStep() calls are needed for direction / close-method —
  // the drawer body already shows all three sub-step forms simultaneously.
  cy().switchCypheusStep('entry-strategy');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;

  // Entry conditions
  await typewriterMessage(strings.cypheus.magicBuild.step2, ctx);
  builder().patchStrategy({ candlestick: ['close'] });
  await sleep(300, ctx);
  builder().patchStrategy({ candlestick: ['close', 'volume'] });
  await sleep(400, ctx);

  const rsi = makeIndicator('RSI');
  builder().patchStrategy({ indicators: [rsi] });
  await sleep(400, ctx);

  builder().patchStrategy({
    entryConditions: {
      logic: { type: 'AND', threshold: null },
      conditions: [
        {
          id: crypto.randomUUID(),
          left: 'RSI-14',
          op: '<',
          right_type: 'number',
          right_number: 30,
          right_indicator: null,
          lookback: 0,
        },
      ],
    },
  });
  await sleep(600, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step2Comment, ctx);
  await sleep(600, ctx);

  // Direction (composite drawer's Action section reflects live)
  await typewriterMessage(strings.cypheus.magicBuild.step3, ctx);
  builder().patchDirection({ direction: 'long' });
  await sleep(400, ctx);
  builder().patchDirection({ orderType: 'market' });
  await sleep(600, ctx);
  if (!isCurrent(ctx)) return;

  // Close method (still inside composite drawer; no setDrawerTab needed
  // because the composite body has no tabs — TpSlForm renders inline).
  await typewriterMessage(strings.cypheus.magicBuild.step4, ctx);
  builder().patchCloseMethod({ type: 'tp_sl' });
  await sleep(400, ctx);
  builder().patchCloseMethod({
    tpEnabled: true,
    tpLevels: [{ profit: 5, amount: 50 }],
  });
  await sleep(800, ctx);
  builder().patchCloseMethod({
    tpLevels: [
      { profit: 5, amount: 50 },
      { profit: 10, amount: 25 },
    ],
  });
  await sleep(800, ctx);
  builder().patchCloseMethod({ slEnabled: true, slValue: -3 });
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step4Comment, ctx);
  await sleep(800, ctx);

  // Mark the 3 strategy sub-steps configured in a single batch — mirrors
  // the StrategyDrawerContent Save handler's behavior for the composite
  // phase.
  builder().setStepStatus('entry-strategy', 'configured');
  builder().setStepStatus('direction', 'configured');
  builder().setStepStatus('close-method', 'configured');
  if (!isCurrent(ctx)) return;

  /* ──────────── Summary + close ──────────── */
  await typewriterMessage(strings.cypheus.magicBuild.doneA, ctx);
  cy().showCypheusSummary();
  await sleep(400, ctx);
  await typewriterMessage(strings.cypheus.magicBuild.doneB, ctx);

  cy().setAvatar('idle');
  cy().setState('done');
  // Drawer dismissal handled by CypheusSummaryView's auto-close timer.
}
