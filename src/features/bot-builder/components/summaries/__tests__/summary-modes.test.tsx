import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { BotConfigSummary } from '../BotConfigSummary';

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
