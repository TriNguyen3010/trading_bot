import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { BotConfigSummary } from '../BotConfigSummary';
import { EntryStrategySummary } from '../EntryStrategySummary';

function seedBotConfig() {
  useBuilderStore.setState((s) => ({
    ...s,
    botConfig: {
      ...s.botConfig,
      pair: 'BTC-USDC',
      timeframe: '1h',
      leverage: 1,
      tradingMode: 'dry-run',
      stakeAmount: 100,
      stakeCurrency: 'USDT',
    },
  }));
}

describe('BotConfigSummary · visual mode', () => {
  beforeEach(() => {
    seedBotConfig();
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('renders BTC-USDC as a hero headline + inline stats', () => {
    render(<BotConfigSummary />);
    expect(screen.getByText('BTC-USDC')).toBeInTheDocument();
    expect(screen.getByText(/1h/i)).toBeInTheDocument();
    expect(screen.getByText(/1×/)).toBeInTheDocument();
    expect(screen.getByText(/\$100/)).toBeInTheDocument();
    expect(screen.getByText(/dry-run/i)).toBeInTheDocument();
  });
});

describe('BotConfigSummary · narrative mode', () => {
  beforeEach(() => {
    seedBotConfig();
    useLayoutPrefsStore.setState({ summaryMode: 'narrative' });
  });

  it('renders a prose sentence containing pair + tf + lev + mode + stake', () => {
    const { container } = render(<BotConfigSummary />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/BTC-USDC/);
    expect(text).toMatch(/1h/);
    expect(text).toMatch(/1×/);
    expect(text).toMatch(/Dry-run/i);
    expect(text).toMatch(/\$100/);
    expect(text.toLowerCase()).toMatch(/trade|with|on/);
  });
});

function seedEntryStrategy() {
  useBuilderStore.setState((s) => ({
    ...s,
    strategy: {
      ...s.strategy,
      candlestick: ['close'],
      indicators: [
        {
          id: 'rsi-1',
          name: 'RSI',
          type: 'talib',
          parameters: { timeperiod: 14 },
        },
      ],
      entryConditions: {
        groupConnector: 'AND',
        groups: [
          {
            id: 'grp-1',
            intraConnector: 'AND',
            rules: [
              {
                id: 'cond-1',
                left: 'RSI-14',
                op: '<',
                right_type: 'number',
                right_number: 40,
                right_indicator: null,
                lookback: 0,
              },
            ],
          },
        ],
      },
    },
  }));
}

describe('EntryStrategySummary · visual mode (mockup B)', () => {
  beforeEach(() => {
    seedEntryStrategy();
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('renders the rule expression in a code-styled block', () => {
    const { container } = render(<EntryStrategySummary />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/RSI-14/);
    expect(text).toMatch(/<\s*40/);
  });

  it('shows the Close candle channel as selected', () => {
    render(<EntryStrategySummary />);
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('shows indicator pill', () => {
    const { container } = render(<EntryStrategySummary />);
    expect(container.textContent ?? '').toMatch(/RSI-14/);
  });
});

import { DirectionSummary } from '../DirectionSummary';

function seedDirection() {
  useBuilderStore.setState((s) => ({
    ...s,
    directionForm: {
      ...s.directionForm,
      direction: 'long',
      orderType: 'market',
      limitOffsetPct: null,
    },
  }));
}

describe('DirectionSummary · visual mode (mockup B)', () => {
  beforeEach(() => {
    seedDirection();
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('shows a Long pill and a Market pill connected by an arrow', () => {
    render(<DirectionSummary />);
    expect(screen.getByText('Long')).toBeInTheDocument();
    expect(screen.getByText('Market')).toBeInTheDocument();
  });
});

import { CloseMethodSummary } from '../CloseMethodSummary';

function seedTpSl() {
  useBuilderStore.setState((s) => ({
    ...s,
    closeMethod: {
      ...s.closeMethod,
      type: 'tp_sl',
      tpEnabled: true,
      tpLevels: [{ profit: 1.5, amount: 100 }],
      slEnabled: true,
      slValue: -10,
      trailingEnabled: false,
    },
  }));
}

describe('CloseMethodSummary · visual mode (mockup B)', () => {
  beforeEach(() => {
    seedTpSl();
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('renders TP and SL as a 2-cell grid with values', () => {
    const { container } = render(<CloseMethodSummary />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/take profit/i);
    expect(text).toMatch(/stop loss/i);
    expect(text).toMatch(/\+?1\.5%/);
    expect(text).toMatch(/-?−?10%/);
  });
});

import { StrategyNarrativeSummary } from '../StrategyNarrativeSummary';

function seedFullStrategy() {
  useBuilderStore.setState((s) => ({
    ...s,
    botConfig: { ...s.botConfig, pair: 'BTC-USDC', timeframe: '1h' },
    strategy: {
      ...s.strategy,
      candlestick: ['close'],
      indicators: [
        {
          id: 'rsi-1',
          name: 'RSI',
          type: 'talib' as const,
          parameters: { timeperiod: 14 },
        },
      ],
      entryConditions: {
        groupConnector: 'AND' as const,
        groups: [
          {
            id: 'grp-1',
            intraConnector: 'AND' as const,
            rules: [
              {
                id: 'cond-1',
                left: 'RSI-14',
                op: '<' as const,
                right_type: 'number' as const,
                right_number: 40,
                right_indicator: null,
                lookback: 0,
              },
            ],
          },
        ],
      },
    },
    directionForm: {
      ...s.directionForm,
      direction: 'long' as const,
      orderType: 'market' as const,
      limitOffsetPct: null,
    },
    closeMethod: {
      ...s.closeMethod,
      type: 'tp_sl' as const,
      tpEnabled: true,
      tpLevels: [{ profit: 1.5, amount: 100 }],
      slEnabled: true,
      slValue: -10,
      trailingEnabled: false,
    },
  }));
}

describe('StrategyNarrativeSummary (Phase 2 composite)', () => {
  beforeEach(() => {
    seedFullStrategy();
    useLayoutPrefsStore.setState({ summaryMode: 'narrative' });
  });

  it('renders a single prose paragraph covering trigger + direction + exit', () => {
    const { container } = render(<StrategyNarrativeSummary />);
    const text = container.textContent ?? '';
    // Trigger
    expect(text).toMatch(/RSI-14/);
    expect(text).toMatch(/40/);
    expect(text).toMatch(/Close/);
    expect(text).toMatch(/1h/);
    // Direction
    expect(text).toMatch(/Long/i);
    expect(text).toMatch(/Market/i);
    // Exit
    expect(text).toMatch(/take profit/i);
    expect(text).toMatch(/1\.5/);
    expect(text).toMatch(/stop loss|cut loss/i);
    expect(text).toMatch(/10/);
    // Sentence connectors so the prose reads naturally
    expect(text.toLowerCase()).toMatch(/when/);
    expect(text.toLowerCase()).toMatch(/enter|then/);
  });

  it('uses human-readable operator label (< becomes <, not raw token)', () => {
    const { container } = render(<StrategyNarrativeSummary />);
    const text = container.textContent ?? '';
    // RSI-14 < 40 — the '<' op should render as '<' (OP_LABEL maps it to '<')
    expect(text).toMatch(/RSI-14\s*</);
  });
});

describe('StrategyNarrativeSummary · tp_sl quadrants', () => {
  beforeEach(() => {
    useLayoutPrefsStore.setState({ summaryMode: 'narrative' });
  });

  it('SL-only: renders "Hold until stop loss" and "no take profit target"', () => {
    seedFullStrategy();
    useBuilderStore.setState((s) => ({
      ...s,
      closeMethod: {
        ...s.closeMethod,
        type: 'tp_sl',
        tpEnabled: false,
        tpLevels: [],
        slEnabled: true,
        slValue: -8,
        trailingEnabled: false,
      },
    }));
    const { container } = render(<StrategyNarrativeSummary />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/hold until/i);
    expect(text).toMatch(/stop loss/i);
    expect(text).toMatch(/no take profit/i);
  });

  it('TP-only: renders "Take profit" and "no stop loss"', () => {
    seedFullStrategy();
    useBuilderStore.setState((s) => ({
      ...s,
      closeMethod: {
        ...s.closeMethod,
        type: 'tp_sl',
        tpEnabled: true,
        tpLevels: [{ profit: 2, amount: 100 }],
        slEnabled: false,
        slValue: -10,
        trailingEnabled: false,
      },
    }));
    const { container } = render(<StrategyNarrativeSummary />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/take profit/i);
    expect(text).toMatch(/no stop loss/i);
  });

  it('Neither: renders "No TP or SL configured"', () => {
    seedFullStrategy();
    useBuilderStore.setState((s) => ({
      ...s,
      closeMethod: {
        ...s.closeMethod,
        type: 'tp_sl',
        tpEnabled: false,
        tpLevels: [],
        slEnabled: false,
        slValue: -10,
        trailingEnabled: false,
      },
    }));
    const { container } = render(<StrategyNarrativeSummary />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/no tp or sl/i);
    expect(text).toMatch(/manually closed/i);
  });
});
