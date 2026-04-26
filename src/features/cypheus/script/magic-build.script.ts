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
 * Hardcoded magic-build demo. The drawer is opened ONCE at the start of step 1
 * and closed by the summary view's auto-close after step 4; intermediate steps
 * swap the drawer's content via switchCypheusStep so the Sheet stays mounted.
 *
 * See Spec/Phase 1/cypheus/drawer_persistence_spec.md for the timeline.
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

  /* ────────── Step 1: Bot Config ────────── */
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

  /* ────────── Step 2: Entry Strategy ────────── */
  builder().setStepStatus('entry-strategy', 'editing');
  cy().switchCypheusStep('entry-strategy');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
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
  await sleep(800, ctx);
  builder().setStepStatus('entry-strategy', 'configured');
  if (!isCurrent(ctx)) return;

  /* ────────── Step 3: Direction & Order ────────── */
  builder().setStepStatus('direction', 'editing');
  cy().switchCypheusStep('direction');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step3, ctx);
  builder().patchDirection({ direction: 'long' });
  await sleep(400, ctx);
  builder().patchDirection({ orderType: 'market' });
  await sleep(800, ctx);
  builder().setStepStatus('direction', 'configured');
  if (!isCurrent(ctx)) return;

  /* ────────── Step 4: Close Method ────────── */
  builder().setStepStatus('close-method', 'editing');
  builder().setDrawerTab('setup');
  cy().switchCypheusStep('close-method');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;
  await typewriterMessage(strings.cypheus.magicBuild.step4, ctx);
  builder().patchCloseMethod({ type: 'tp_sl' });
  await sleep(400, ctx);
  builder().setDrawerTab('configure');
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
  builder().setStepStatus('close-method', 'configured');
  if (!isCurrent(ctx)) return;

  /* ────────── Summary + close ────────── */
  await typewriterMessage(strings.cypheus.magicBuild.doneA, ctx);
  cy().showCypheusSummary();
  await sleep(400, ctx);
  await typewriterMessage(strings.cypheus.magicBuild.doneB, ctx);

  cy().setAvatar('idle');
  cy().setState('done');
  // Drawer dismissal handled by CypheusSummaryView's auto-close timer (2s).
}
