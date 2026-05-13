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
        ...s.strategy.entryConditions,
        conditions: [
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
        logic: { type: 'AND', threshold: null },
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
