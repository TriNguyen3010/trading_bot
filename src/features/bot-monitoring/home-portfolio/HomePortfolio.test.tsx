import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// Mock collaborators. vi.fn() is created INSIDE each hoisted factory (no outer
// reference → no TDZ), then grabbed via vi.mocked() after the imports below.
vi.mock('../usePortfolioOverview', () => ({
  usePortfolioOverview: vi.fn(),
}));
vi.mock('@/features/agent-wallet/useActiveAgent', () => ({
  useActiveAgent: vi.fn(),
}));
vi.mock('@/features/wallet-auth/wallet.store', () => ({
  useIsWalletConnected: vi.fn(),
  useWalletStore: vi.fn((sel: (s: { address: string | null }) => unknown) =>
    sel({ address: '0x1234567890abcdef' }),
  ),
}));
// AgentOnboardingDialog is heavy (radix + sign flow) — stub it.
vi.mock('@/features/agent-wallet/AgentOnboardingDialog', () => ({
  AgentOnboardingDialog: () => null,
}));

import { HomePortfolio } from './HomePortfolio';
import {
  usePortfolioOverview,
  type PortfolioOverview,
} from '../usePortfolioOverview';
import { useActiveAgent } from '@/features/agent-wallet/useActiveAgent';
import { useIsWalletConnected } from '@/features/wallet-auth/wallet.store';
import type { DashboardBot } from '../bot-list.helpers';
import type { BotPerformance } from '../bot-performance';
import type { AgentInfoResponse } from '@/types/api-helpers';

const mockOverview = vi.mocked(usePortfolioOverview);
const mockAgent = vi.mocked(useActiveAgent);
const mockConnected = vi.mocked(useIsWalletConnected);

function mkBot(id: number, mode: DashboardBot['mode']): DashboardBot {
  return {
    id,
    name: `Bot ${id}`,
    pair: 'ETH-USDC',
    timeframe: '5m',
    strategyName: null,
    uptime: null,
    mode,
    dryRun: mode === 'DRY-RUN',
    createdAt: null,
    leverage: null,
    stakeAmount: null,
    maxOpenTrades: null,
    tradingMode: null,
    errorMsg: null,
    pnl: null,
    pnlPct: null,
    pnlDirection: 'flat',
    trades: null,
    winRate: null,
    sharpe: null,
    sparkline: null,
    isDemo: false,
  };
}

function baseOverview(
  over: Partial<PortfolioOverview> = {},
): PortfolioOverview {
  return {
    bots: [],
    perfById: new Map(),
    btById: new Map(),
    stats: {
      capitalDeployed: 0,
      openTrades: 0,
      total: 0,
      active: 0,
      transitioning: 0,
      idle: 0,
      error: 0,
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
    updateOneBot: vi.fn(),
    removeOneBot: vi.fn(),
    ...over,
  };
}

const ACTIVE_AGENT: AgentInfoResponse = {
  id: 1,
  agent_address: '0xfeedface0000000000000000000000000000feed',
  label: null,
  spending_limit_usd: 5000,
  spent_today_usd: 0,
  is_active: true,
  created_at: '2026-06-08T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockConnected.mockReturnValue(true);
  mockAgent.mockReturnValue({ agent: null, loading: false, refresh: vi.fn() });
});

const noop = () => {};
const props = { onBuild: noop, onImport: noop, onBotClick: noop };

describe('HomePortfolio state machine', () => {
  it('A · not connected → renders nothing (parent shows marketing cards)', () => {
    mockConnected.mockReturnValue(false);
    mockOverview.mockReturnValue(baseOverview({ bots: null }));
    const { container } = render(<HomePortfolio {...props} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('B · loading → skeleton', () => {
    mockOverview.mockReturnValue(baseOverview({ bots: null, loading: true }));
    render(<HomePortfolio {...props} />);
    expect(screen.getByTestId('portfolio-skeleton')).toBeInTheDocument();
  });

  it('connect race (bots=null, !loading, !error) → skeleton, never empty flash', () => {
    // After the wallet connects, there is a render where `enabled` just flipped
    // true but the fetch effect has not run yet: loading is stale-false and
    // bots is still null. Must show the skeleton, not a $0.00 empty state.
    mockOverview.mockReturnValue(
      baseOverview({ bots: null, loading: false, error: null }),
    );
    render(<HomePortfolio {...props} />);
    expect(screen.getByTestId('portfolio-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolio-empty')).not.toBeInTheDocument();
  });

  it('G · error → error card', () => {
    mockOverview.mockReturnValue(baseOverview({ bots: null, error: 'boom' }));
    render(<HomePortfolio {...props} />);
    expect(screen.getByTestId('portfolio-error')).toBeInTheDocument();
  });

  it('C · connected no bots → empty + go-live banner (no agent)', () => {
    mockOverview.mockReturnValue(baseOverview({ bots: [] }));
    render(<HomePortfolio {...props} />);
    expect(screen.getByTestId('portfolio-empty')).toBeInTheDocument();
    expect(
      screen.getByText(/Create a Hyperliquid trading wallet/i),
    ).toBeInTheDocument();
  });

  it('D · running bots → hero shows capital deployed = Σ balance', () => {
    mockOverview.mockReturnValue(
      baseOverview({
        bots: [mkBot(1, 'DRY-RUN')],
        perfById: new Map<number, BotPerformance>([
          [1, { balance: 1284.55, openTrades: 2 }],
        ]),
        stats: {
          capitalDeployed: 1284.55,
          openTrades: 2,
          total: 1,
          active: 1,
          transitioning: 0,
          idle: 0,
          error: 0,
        },
      }),
    );
    render(<HomePortfolio {...props} />);
    const hero = screen.getByTestId('portfolio-hero');
    expect(hero).toBeInTheDocument();
    // Scope to the hero — the same balance also appears on the top-bot card.
    expect(within(hero).getByText(/1,284\.55/)).toBeInTheDocument();
    // Top-bot MiniBotCard renders the shared StatusBadge (Dry-run reads blue).
    expect(screen.getByText('Dry-run')).toBeInTheDocument();
  });

  it('agent still loading → no go-live banner (avoid flicker, spec §6)', () => {
    mockAgent.mockReturnValue({ agent: null, loading: true, refresh: vi.fn() });
    mockOverview.mockReturnValue(baseOverview({ bots: [] }));
    render(<HomePortfolio {...props} />);
    expect(
      screen.queryByText(/Create a Hyperliquid trading wallet/i),
    ).not.toBeInTheDocument();
  });

  it('F · bots paused (idle>0), zero deployed → shows resume nudge', () => {
    mockOverview.mockReturnValue(
      baseOverview({
        bots: [mkBot(1, 'PAUSED'), mkBot(2, 'PAUSED')],
        stats: {
          capitalDeployed: 0,
          openTrades: 0,
          total: 2,
          active: 0,
          transitioning: 0,
          idle: 2,
          error: 0,
        },
      }),
    );
    render(<HomePortfolio {...props} />);
    expect(screen.getByText(/2 bots paused/i)).toBeInTheDocument();
  });

  it('zero deployed but no paused bots (all ERROR) → no false "paused" line', () => {
    mockOverview.mockReturnValue(
      baseOverview({
        bots: [mkBot(1, 'ERROR')],
        stats: {
          capitalDeployed: 0,
          openTrades: 0,
          total: 1,
          active: 0,
          transitioning: 0,
          idle: 0,
          error: 1,
        },
      }),
    );
    render(<HomePortfolio {...props} />);
    expect(screen.getByTestId('portfolio-hero')).toBeInTheDocument();
    expect(screen.queryByText(/bots? paused/i)).not.toBeInTheDocument();
  });

  it('E · agent active → no go-live banner', () => {
    mockAgent.mockReturnValue({
      agent: ACTIVE_AGENT,
      loading: false,
      refresh: vi.fn(),
    });
    mockOverview.mockReturnValue(
      baseOverview({
        bots: [mkBot(1, 'LIVE')],
        perfById: new Map<number, BotPerformance>([
          [1, { balance: 500, openTrades: 0 }],
        ]),
        stats: {
          capitalDeployed: 500,
          openTrades: 0,
          total: 1,
          active: 1,
          transitioning: 0,
          idle: 0,
          error: 0,
        },
      }),
    );
    render(<HomePortfolio {...props} />);
    expect(
      screen.queryByText(/Create a Hyperliquid trading wallet/i),
    ).not.toBeInTheDocument();
  });
});
