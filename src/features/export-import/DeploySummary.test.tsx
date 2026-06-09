import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeploySummary } from './DeploySummary';
// The summary TYPE and the COMPONENT share the name "DeploySummary" — alias the type.
import type { DeploySummary as DeploySummaryData } from './deploy-summary';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';

const summary: DeploySummaryData = {
  botName: 'RSI Oversold ETH',
  pair: 'ETH/USDC:USDC',
  pairDisplay: 'ETH/USDC',
  pairBase: 'ETH',
  pairQuote: 'USDC',
  timeframe: '1h',
  exchangeId: 'hyperliquid',
  exchangeLabel: 'Hyperliquid',
  stakeAmount: 100,
  stakeCurrency: 'USDC',
  maxOpenTrades: 3,
  leverage: 1,
  maxExposure: 300,
  dryRun: true,
  dryRunWallet: 1000,
  marketType: 'futures',
  marginMode: 'cross',
  liquidationBuffer: 0.05,
  direction: 'long',
  canShort: false,
  strategyDisplayName: 'RSI Oversold ETH',
  strategyClassName: 'RsiOversoldEth',
  strategyMeta: '1 indicator · 1 entry condition · TP/SL',
};

describe('DeploySummary', () => {
  // summaryMode is a shared persisted store; reset so test order can't leak it.
  beforeEach(() => {
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
  });

  it('does not show DRY-RUN / LIVE / margin badges (chosen at launch, not here)', () => {
    render(<DeploySummary summary={summary} />);
    expect(screen.queryByText('DRY-RUN')).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
    expect(screen.queryByText(/^CROSS$/i)).not.toBeInTheDocument();
  });

  it('toggles the strategy view between conditions and text', () => {
    useLayoutPrefsStore.setState({ summaryMode: 'visual' });
    render(<DeploySummary summary={summary} />);
    // SummaryModeToggle's aria-label in visual mode = "Switch to narrative summary".
    const toggle = screen.getByRole('button', {
      name: /switch to (narrative|visual) summary/i,
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(useLayoutPrefsStore.getState().summaryMode).toBe('narrative');
  });
});
