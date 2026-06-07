import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailHero, type DetailHeroData } from '../DetailHero';

const base: DetailHeroData = {
  name: 'Gamma',
  mode: 'DRY-RUN',
  state: 'DRY-RUN',
  pair: 'BTC/USDC:USDC',
  timeframe: '5m',
  exchange: 'hyperliquid',
  tradingMode: 'futures',
  createdAt: '2026-05-15',
  balance: 967.94,
  openTrades: 1,
  maxOpenTrades: 10,
  lastBacktest: { winRate: 44.2, netAbs: -36.59 },
};
const h = {
  onSync: vi.fn(),
  onRestart: vi.fn(),
  onStop: vi.fn(),
  onStart: vi.fn(),
};

describe('DetailHero', () => {
  it('shows balance and open trades', () => {
    render(<DetailHero bot={base} {...h} />);
    expect(screen.getByText(/967\.94/)).toBeInTheDocument();
  });

  it('shows win rate + net from last backtest, no live-PnL / needs-BE', () => {
    render(<DetailHero bot={base} {...h} />);
    expect(screen.getByText(/44\.2%/)).toBeInTheDocument();
    // Net is ABSOLUTE (history total_profit), not a %, and keeps its sign.
    expect(screen.getByText('-36.59')).toBeInTheDocument();
    expect(screen.queryByText(/PnL today/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/needs BE/i)).not.toBeInTheDocument();
  });

  it('shows created date, not uptime', () => {
    render(<DetailHero bot={base} {...h} />);
    expect(screen.getByText(/2026-05-15/)).toBeInTheDocument();
    expect(screen.queryByText(/uptime/i)).not.toBeInTheDocument();
  });

  it('shows Stop for a running bot', () => {
    render(<DetailHero bot={base} {...h} />);
    expect(screen.getByRole('button', { name: /^stop$/i })).toBeInTheDocument();
  });

  it('shows Start for a not-started bot', () => {
    render(
      <DetailHero
        bot={{ ...base, mode: 'PAUSED', state: 'NEW', balance: null }}
        {...h}
      />,
    );
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });
});
