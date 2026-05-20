/**
 * End-to-end summary tests on the 8 built-in templates. Each template
 * snapshot is rendered to a flat text shape, asserted as a snapshot.
 *
 * When you add a new template, run vitest with `-u` to update
 * snapshots. When the translator changes wording, snapshot diffs in
 * code review should match the intended copy change.
 */
import { describe, expect, it } from 'vitest';
import { BUILT_IN_TEMPLATES } from '@/templates';
import type { BotTemplate } from '@/templates';
import type { BuilderState } from '@/types/builder.types';
import { summarizeBot } from '../summarize';

/** Wrap a template's TemplateStateSnapshot into a full BuilderState
 * so summarizeBot can run. */
function toBuilderState(template: BotTemplate): BuilderState {
  return {
    ...template.state,
    stepStatus: {
      'bot-config': 'configured',
      'entry-strategy': 'configured',
      direction: 'configured',
      'close-method': 'configured',
    },
    isDirty: false,
    lastSavedAt: 0,
  };
}

/** Render a SummaryBlock[] as a flat human-readable string for
 * snapshot stability — ordering matters, but tone class doesn't
 * (covered separately in unit tests). */
function renderBlocks(
  blocks: ReturnType<typeof summarizeBot>['blocks'],
): string {
  return blocks
    .map((b) => {
      const header = b.warning
        ? `## ${b.title} ⚠ ${b.warning}`
        : `## ${b.title}`;
      const body = b.lines
        .map((line) => line.map((i) => i.text).join(''))
        .join('\n');
      return `${header}\n${body}`;
    })
    .join('\n\n');
}

describe('summarizeBot — 8 built-in templates', () => {
  it.each(BUILT_IN_TEMPLATES.map((t) => [t.id, t]))(
    'summarizes %s with no translation gaps',
    (_id, template) => {
      const result = summarizeBot(toBuilderState(template));
      // Built-in templates are designed to fully translate. Any gap
      // indicates a translator missing a case the template uses.
      expect(result.gaps).toEqual([]);
      // Snapshot the rendered text. New template → vitest -u to bless.
      expect(renderBlocks(result.blocks)).toMatchSnapshot();
    },
  );
});

describe('summarizeBot — edge cases', () => {
  it('pristine state: pair empty + no conditions', () => {
    const empty: BuilderState = {
      botName: 'Untitled bot',
      botConfig: {
        pair: '',
        timeframe: '5m',
        tradingMode: 'dry-run',
        leverage: 1,
        exchange: 'binance',
        marketType: 'futures',
        marginMode: 'cross',
        maxOpenTrades: 10,
        stakeCurrency: 'USDT',
        stakeAmount: 100,
        dryRunWallet: 1000,
      },
      strategy: {
        id: 'strategy-1',
        name: 'Entry Strategy 1',
        candlestick: [],
        indicators: [],
        entryConditions: { groupConnector: 'AND', groups: [] },
        startupCandleCount: 200,
        informativeTimeframes: [],
      },
      directionForm: {
        direction: 'long',
        orderType: 'market',
        limitOffsetPct: null,
      },
      closeMethod: {
        type: 'tp_sl',
        tpEnabled: true,
        tpLevels: [],
        slEnabled: true,
        slValue: -3,
        trailingEnabled: false,
        trailingPositive: 1,
        trailingOffset: 1.5,
        roiSteps: [],
        exitConditions: { groupConnector: 'AND', groups: [] },
      },
      stepStatus: {
        'bot-config': 'pending',
        'entry-strategy': 'pending',
        direction: 'pending',
        'close-method': 'pending',
      },
      isDirty: false,
      lastSavedAt: null,
    };

    const result = summarizeBot(empty);
    // Market block surfaces the pair-not-set warning text.
    const market = result.blocks.find((b) => b.id === 'market');
    expect(market?.lines[0][0].text).toBe('Pair not set yet.');
    // Entry block surfaces the no-conditions phrase.
    const entry = result.blocks.find((b) => b.id === 'entry');
    expect(entry?.lines[0][0].text).toContain('No entry conditions');
    // Translator emits a tp-empty gap because tpEnabled=true but no
    // levels.
    expect(result.gaps.some((g) => g.field === 'tpLevels')).toBe(true);
  });

  it('high leverage on live mode → warning on risk block', () => {
    const state = toBuilderState(BUILT_IN_TEMPLATES[0]);
    state.botConfig.tradingMode = 'live';
    state.botConfig.leverage = 50;
    state.botConfig.marketType = 'futures';
    const result = summarizeBot(state);
    const risk = result.blocks.find((b) => b.id === 'risk');
    expect(risk?.warning).toContain('50× leverage');
  });

  it('always emits the 6 sections in canonical order', () => {
    const result = summarizeBot(toBuilderState(BUILT_IN_TEMPLATES[0]));
    expect(result.blocks.map((b) => b.id)).toEqual([
      'market',
      'risk',
      'entry',
      'action',
      'exit',
      'notifications',
    ]);
  });
});
