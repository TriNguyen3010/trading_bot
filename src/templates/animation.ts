/**
 * Generic Cypheus magic-build engine, parameterised by a `BotTemplate`.
 * See Spec/Phase 1/bot_templates_plan.md §4.
 *
 * The 4-step hard-coded `magic-build.script.ts` is now a thin wrapper
 * that delegates here with the `cypheus-default` template.
 *
 * Engine timeline (~6s for the default template):
 *   1. Reset state, set Cypheus to thinking → building.
 *   2. Play `script.intro` lines.
 *   3. Phase 1 — Bot Basics:
 *        - pin bot-config (legacy tabs drawer)
 *        - apply botConfig (typewriter `pair`, snap the rest)
 *        - mark bot-config configured.
 *   4. Phase 2 — Strategy (composite drawer, single pin):
 *        - pin entry-strategy ONCE → BotBuilderCanvas detects the stepId
 *          ∈ STRATEGY_SUB_STEPS and renders the composite drawer body.
 *        - apply strategy (entry conditions) → direction → closeMethod
 *          back-to-back inside the same drawer.
 *        - mark all 3 strategy sub-steps configured.
 *   5. Outro:
 *        - play preSummary line(s), open summary view, play postSummary.
 *        - record applied template id for the future "Based on …" badge.
 */
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import {
  isCurrent,
  sleep,
  startScript,
  type RunContext,
  typewriterMessage,
  typewriterValue,
} from '@/features/cypheus/script/script-runner';
import { useTemplateTrackingStore } from './store';
import type {
  BotTemplate,
  Narration,
  TemplateStateSnapshot,
} from './types';

/* -------------------------------------------------------------------------- */
/*  Narration helpers                                                          */
/* -------------------------------------------------------------------------- */

function asLines(n: Narration | undefined): readonly string[] {
  if (!n) return [];
  return typeof n === 'string' ? [n] : n;
}

async function playNarration(
  n: Narration | undefined,
  ctx: RunContext,
  /** Sleep between successive lines in this slot (ms). */
  betweenMs = 300,
): Promise<void> {
  const lines = asLines(n);
  for (let i = 0; i < lines.length; i++) {
    if (!isCurrent(ctx)) return;
    await typewriterMessage(lines[i], ctx);
    if (i < lines.length - 1) await sleep(betweenMs, ctx);
  }
}

/* -------------------------------------------------------------------------- */
/*  Field application — typewriter for free-text, snap for the rest           */
/* -------------------------------------------------------------------------- */

async function applyBotConfigAnimated(
  c: TemplateStateSnapshot['botConfig'],
  ctx: RunContext,
): Promise<void> {
  const builder = () => useBuilderStore.getState();
  // Type out `pair` so the user sees the most "human" field appear character
  // by character. Other bot-config fields are radio/select/numeric — snap-set
  // them with mild delays for a sense of work.
  await typewriterValue(
    (v) => builder().patchBotConfig({ pair: v }),
    c.pair,
    ctx,
    140,
  );
  if (!isCurrent(ctx)) return;
  await sleep(300, ctx);
  builder().patchBotConfig({ timeframe: c.timeframe });
  await sleep(300, ctx);
  builder().patchBotConfig({ tradingMode: c.tradingMode });
  await sleep(300, ctx);

  // leverage typewriter for drama (it's a small numeric value users tweak
  // a lot in real life)
  await typewriterValue(
    (v) => {
      const n = Number(v);
      builder().patchBotConfig({ leverage: Number.isFinite(n) ? n : 1 });
    },
    String(c.leverage),
    ctx,
    160,
  );
  if (!isCurrent(ctx)) return;
  await sleep(200, ctx);
  // Remaining fields snap-applied — no UI advantage to typewriter.
  builder().patchBotConfig({
    exchange: c.exchange,
    marketType: c.marketType,
    marginMode: c.marginMode,
    maxOpenTrades: c.maxOpenTrades,
    stakeCurrency: c.stakeCurrency,
    stakeAmount: c.stakeAmount,
    dryRunWallet: c.dryRunWallet,
  });
}

async function applyStrategyAnimated(
  s: TemplateStateSnapshot['strategy'],
  ctx: RunContext,
): Promise<void> {
  const builder = () => useBuilderStore.getState();
  // Stage candlesticks one-by-one for the chip-toggle effect users see in
  // the existing magic build. If a template lists 3+ chips we still chunk
  // them in pairs so the animation doesn't drag.
  const allCandle = s.candlestick;
  for (let i = 0; i < allCandle.length; i++) {
    if (!isCurrent(ctx)) return;
    builder().patchStrategy({ candlestick: allCandle.slice(0, i + 1) });
    await sleep(300, ctx);
  }
  // Indicators: one batch — re-rendering them per-item caused noisy reflow.
  builder().patchStrategy({
    indicators: s.indicators,
    name: s.name,
    startupCandleCount: s.startupCandleCount,
    informativeTimeframes: s.informativeTimeframes,
  });
  await sleep(400, ctx);
  if (!isCurrent(ctx)) return;
  builder().patchStrategy({ entryConditions: s.entryConditions });
  await sleep(500, ctx);
}

async function applyDirectionAnimated(
  d: TemplateStateSnapshot['directionForm'],
  ctx: RunContext,
): Promise<void> {
  const builder = () => useBuilderStore.getState();
  builder().patchDirection({ direction: d.direction });
  await sleep(400, ctx);
  if (!isCurrent(ctx)) return;
  builder().patchDirection({
    orderType: d.orderType,
    limitOffsetPct: d.limitOffsetPct,
    slippageTolerance: d.slippageTolerance,
  });
  await sleep(400, ctx);
}

async function applyCloseMethodAnimated(
  c: TemplateStateSnapshot['closeMethod'],
  ctx: RunContext,
): Promise<void> {
  const builder = () => useBuilderStore.getState();
  // Type/method first so the matching form section appears in the
  // composite drawer.
  builder().patchCloseMethod({ type: c.type });
  await sleep(400, ctx);
  if (!isCurrent(ctx)) return;
  // Stage TP levels one-by-one if we have multiple (mirrors the real magic
  // build feel).
  if (c.type === 'tp_sl') {
    if (c.tpEnabled && c.tpLevels.length > 0) {
      for (let i = 0; i < c.tpLevels.length; i++) {
        if (!isCurrent(ctx)) return;
        builder().patchCloseMethod({
          tpEnabled: true,
          tpLevels: c.tpLevels.slice(0, i + 1),
        });
        await sleep(700, ctx);
      }
    }
    builder().patchCloseMethod({
      slEnabled: c.slEnabled,
      slValue: c.slValue,
      trailingEnabled: c.trailingEnabled,
      trailingPositive: c.trailingPositive,
      trailingOffset: c.trailingOffset,
    });
  } else if (c.type === 'roi') {
    builder().patchCloseMethod({ roiSteps: c.roiSteps });
  } else if (c.type === 'indicator') {
    builder().patchCloseMethod({ exitConditions: c.exitConditions });
  }
  await sleep(400, ctx);
}

/* -------------------------------------------------------------------------- */
/*  Main engine                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Run the magic-build animation for the given template. Caller should
 * have already shown a confirm dialog if `state.isDirty` (see `apply.ts`).
 *
 * The function `resetAll`s before applying so the template snapshot is
 * the canonical starting point — partial pre-existing state would just
 * confuse the timeline.
 */
export async function runTemplateAnimation(
  template: BotTemplate,
): Promise<void> {
  const ctx = startScript();
  const cy = () => useCypheusStore.getState();
  const builder = () => useBuilderStore.getState();
  const script = template.script ?? {};

  /* ──────── 0. Reset + warm-up ──────── */
  builder().resetAll();
  cy().setState('thinking');
  cy().setAvatar('coding');
  await sleep(1000, ctx);
  if (!isCurrent(ctx)) return;
  cy().setState('building');

  /* ──────── 1. Intro narration ──────── */
  await playNarration(
    script.intro ?? `Setting up "${template.name}" for you...`,
    ctx,
  );
  if (!isCurrent(ctx)) return;
  await sleep(500, ctx);

  /* ──────── 2. Phase 1 — Bot Basics ──────── */
  builder().setBotName(template.state.botName);
  builder().setStepStatus('bot-config', 'editing');
  builder().setDrawerTab('setup');
  cy().startCypheusDrawer('bot-config');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;

  await playNarration(
    script.phaseNarration?.botBasics?.pre ?? 'Configuring bot basics…',
    ctx,
  );
  if (!isCurrent(ctx)) return;

  await applyBotConfigAnimated(template.state.botConfig, ctx);
  if (!isCurrent(ctx)) return;

  await playNarration(script.phaseNarration?.botBasics?.post, ctx);
  await sleep(800, ctx);
  builder().setStepStatus('bot-config', 'configured');
  if (!isCurrent(ctx)) return;

  /* ──────── 3. Phase 2 — Strategy composite ──────── */
  builder().setStepStatus('entry-strategy', 'editing');
  builder().setStepStatus('direction', 'editing');
  builder().setStepStatus('close-method', 'editing');
  // Pin entry-strategy ONCE — BotBuilderCanvas detects this stepId is in
  // STRATEGY_SUB_STEPS and dispatches into the composite drawer body, so
  // direction + closeMethod patches stream into the same Sheet.
  cy().switchCypheusStep('entry-strategy');
  await sleep(500, ctx);
  if (!isCurrent(ctx)) return;

  const sn = script.phaseNarration?.strategy;
  await playNarration(sn?.pre, ctx);

  // Entry conditions
  await playNarration(sn?.preEntry ?? 'Defining entry conditions…', ctx);
  await applyStrategyAnimated(template.state.strategy, ctx);
  if (!isCurrent(ctx)) return;
  await playNarration(sn?.postEntry, ctx);
  if (!isCurrent(ctx)) return;
  await sleep(400, ctx);

  // Direction
  await playNarration(sn?.preDirection, ctx);
  await applyDirectionAnimated(template.state.directionForm, ctx);
  if (!isCurrent(ctx)) return;
  await playNarration(sn?.postDirection, ctx);
  await sleep(300, ctx);

  // Close method
  await playNarration(sn?.preClose, ctx);
  await applyCloseMethodAnimated(template.state.closeMethod, ctx);
  if (!isCurrent(ctx)) return;
  await playNarration(sn?.postClose, ctx);

  await playNarration(sn?.post, ctx);
  await sleep(600, ctx);
  builder().setStepStatus('entry-strategy', 'configured');
  builder().setStepStatus('direction', 'configured');
  builder().setStepStatus('close-method', 'configured');
  if (!isCurrent(ctx)) return;

  /* ──────── 4. Outro + summary ──────── */
  await playNarration(script.outro?.preSummary, ctx);
  cy().showCypheusSummary();
  await sleep(400, ctx);
  await playNarration(script.outro?.postSummary, ctx);

  cy().setAvatar('idle');
  cy().setState('done');

  /* ──────── 5. Track origin for the badge ──────── */
  useTemplateTrackingStore.getState().setApplied(template.id);
  // Drawer dismissal handled by CypheusSummaryView's 2s auto-close timer.
}
