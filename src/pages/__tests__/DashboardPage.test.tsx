import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../DashboardPage';
import { botApi, type BotOut } from '@/features/bot-monitoring/bot.api';
import { RequireWalletProvider } from '@/features/wallet-auth/RequireWalletProvider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';

vi.mock('@/features/bot-monitoring/bot.api', () => ({
  botApi: {
    list: vi.fn(),
    getConfig: vi.fn(),
    getStatus: vi.fn(),
    getPerformance: vi.fn(),
    getBacktestHistory: vi.fn(),
    disableTelegram: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    sync: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner');
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
      warning: vi.fn(),
    },
  };
});

/** Default enrichment mocks so the dashboard's perf + backtest fetches resolve.
 * A single completed backtest item → PAUSED bots show the "Paused" badge
 * (not "New"). */
function setEnrichmentDefaults() {
  vi.mocked(botApi.getPerformance).mockResolvedValue({
    balance: 1000,
    openTrades: 1,
  });
  vi.mocked(botApi.getBacktestHistory).mockResolvedValue({
    items: [
      {
        id: 1,
        status: 'completed',
        win_rate: 50,
        trade_count: 10,
        total_profit: 5,
      },
    ],
    total: 1,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function setWallet() {
  useWalletStore.setState({
    address: '0xabc',
    nonce: 'n',
    signature: 's',
    status: 'ready',
    user: null,
    error: null,
    signingMessage: null,
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RequireWalletProvider>
        <DashboardPage />
      </RequireWalletProvider>
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setWallet();
    setEnrichmentDefaults();
  });

  it('shows skeleton cards while loading', () => {
    vi.mocked(botApi.list).mockReturnValue(new Promise(() => {}));
    renderPage();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('shows real bots when list returns items', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 42,
        bot_name: 'My ETH bot',
        status: 'running',
        desired_status: null,
        error_message: null,
        strategy_name: 'RsiLong',
      },
    ]);
    vi.mocked(botApi.getConfig).mockResolvedValueOnce({
      config: {
        dry_run: false,
        timeframe: '5m',
        exchange: { pair_whitelist: ['ETH/USDT'] },
      },
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('My ETH bot')).toBeInTheDocument(),
    );
    // "Live" appears in the hero indicator + the card badge → at least one.
    expect(screen.getAllByText('Live').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/ETH-USDT/)).toBeInTheDocument();
  });

  it('shows capital deployed from running bots performance', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 86,
        bot_name: 'Gamma',
        status: 'running',
        desired_status: null,
        error_message: null,
        strategy_name: 'Gamma',
      },
    ]);
    vi.mocked(botApi.getConfig).mockResolvedValueOnce({
      config: {
        dry_run: true,
        timeframe: '5m',
        exchange: { pair_whitelist: ['BTC/USDC:USDC'] },
        leverage: 10,
        stake_amount: 100,
        max_open_trades: 10,
      },
    });
    vi.mocked(botApi.getPerformance).mockResolvedValue({
      balance: 967.94,
      openTrades: 1,
    });

    renderPage();
    await waitFor(() => expect(screen.getByText('Gamma')).toBeInTheDocument());
    // hero capital deployed + card balance both show 967.94
    expect(screen.getAllByText(/967\.94/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state (no demo bots) when list is empty', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/No bots yet/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText('My ETH bot')).not.toBeInTheDocument();
    expect(screen.queryByText(/Demo/)).not.toBeInTheDocument();
  });

  it('shows error state with retry button when list fails', async () => {
    vi.mocked(botApi.list).mockRejectedValueOnce(new Error('Network down'));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/couldn't load your bots/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retry button refetches', async () => {
    vi.mocked(botApi.list)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/couldn't load your bots/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() =>
      expect(screen.getByText(/No bots yet/i)).toBeInTheDocument(),
    );
  });

  it('renders bot card even when its config fetch fails', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 99,
        bot_name: 'Orphan bot',
        status: 'stopped',
        desired_status: null,
        error_message: null,
        strategy_name: 'X',
      },
    ]);
    vi.mocked(botApi.getConfig).mockRejectedValueOnce(new Error('500'));

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Orphan bot')).toBeInTheDocument(),
    );
    // Pair + timeframe both fall back to '?' when config fails.
    expect(screen.getAllByText(/\?/).length).toBeGreaterThanOrEqual(1);
  });

  it('clicking a card navigates to the bot detail page', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 55,
        bot_name: 'Routed bot',
        status: 'stopped',
        desired_status: null,
        error_message: null,
        strategy_name: 'X',
      },
    ]);
    vi.mocked(botApi.getConfig).mockResolvedValueOnce({
      config: {
        dry_run: true,
        timeframe: '1h',
        exchange: { pair_whitelist: ['BTC/USDT'] },
      },
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Routed bot')).toBeInTheDocument(),
    );
    // Even a PAUSED bot's card is a clickable link → routes to /bots/{id}.
    expect(
      screen.getByText('Routed bot').closest('[role="link"]'),
    ).not.toBeNull();
  });

  it('Refresh button triggers a refetch', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/No bots yet/i)).toBeInTheDocument(),
    );

    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 7,
        bot_name: 'Fresh bot',
        status: 'stopped',
        desired_status: null,
        error_message: null,
        strategy_name: 'X',
      },
    ]);
    vi.mocked(botApi.getConfig).mockResolvedValueOnce({
      config: {
        dry_run: true,
        timeframe: '1h',
        exchange: { pair_whitelist: ['BTC/USDT'] },
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() =>
      expect(screen.getByText('Fresh bot')).toBeInTheDocument(),
    );
    expect(screen.queryByText(/No bots yet/i)).not.toBeInTheDocument();
  });

  it('Refresh button is hidden during loading / error states', async () => {
    vi.mocked(botApi.list).mockReturnValue(new Promise(() => {}));
    const { unmount } = renderPage();
    expect(
      screen.queryByRole('button', { name: /refresh/i }),
    ).not.toBeInTheDocument();
    unmount();

    vi.resetAllMocks();
    setWallet();
    setEnrichmentDefaults();
    vi.mocked(botApi.list).mockRejectedValueOnce(new Error('boom'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/couldn't load your bots/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: /refresh/i }),
    ).not.toBeInTheDocument();
  });

  it('Search input is hidden in empty / error / loading states', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No bots yet/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByPlaceholderText(/search bots/i),
    ).not.toBeInTheDocument();
    unmount();

    vi.resetAllMocks();
    setWallet();
    setEnrichmentDefaults();
    vi.mocked(botApi.list).mockRejectedValueOnce(new Error('x'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/couldn't load your bots/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByPlaceholderText(/search bots/i),
    ).not.toBeInTheDocument();
  });

  it('unmount during fetch does not crash', async () => {
    let resolveList!: (value: BotOut[]) => void;
    vi.mocked(botApi.list).mockReturnValueOnce(
      new Promise((res) => {
        resolveList = res;
      }),
    );

    const { unmount } = renderPage();
    expect(
      document.querySelectorAll('.animate-pulse').length,
    ).toBeGreaterThanOrEqual(3);

    unmount();
    resolveList([]);
    await new Promise((r) => setTimeout(r, 0));

    expect(vi.mocked(botApi.list)).toHaveBeenCalledOnce();
  });
});

// ── lifecycle actions wired on BotCard ─────────────────────────
describe('DashboardPage — lifecycle actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setWallet();
    setEnrichmentDefaults();
  });

  function loadOne(over: Partial<BotOut> = {}, dryRun = true) {
    vi.mocked(botApi.list).mockResolvedValueOnce([
      {
        id: 7,
        bot_name: 'Lifecycle bot',
        status: 'stopped',
        desired_status: null,
        error_message: null,
        strategy_name: 'X',
        ...over,
      },
    ]);
    vi.mocked(botApi.getConfig).mockResolvedValueOnce({
      config: {
        dry_run: dryRun,
        timeframe: '5m',
        exchange: { pair_whitelist: ['BTC/USDT'] },
      },
    });
  }

  it('Start button routes through the Launchpad and does NOT call botApi.start directly', async () => {
    loadOne();

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Lifecycle bot')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));

    expect(botApi.start).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /start dry-run/i }),
      ).toBeInTheDocument(),
    );
  });

  it('after Stop, auto-polls status until the bot settles (no manual refresh)', async () => {
    loadOne({ status: 'running' }, false); // LIVE bot → renders a Stop button
    vi.mocked(botApi.stop).mockResolvedValueOnce({
      id: 7,
      bot_name: 'Lifecycle bot',
      status: 'stopping',
      desired_status: 'stopped',
      is_process_running: true,
      error_message: null,
    });
    vi.mocked(botApi.getStatus).mockResolvedValue({
      id: 7,
      bot_name: 'Lifecycle bot',
      status: 'stopped',
      desired_status: 'stopped',
      is_process_running: false,
      error_message: null,
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Lifecycle bot')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    const stopButtons = screen.getAllByRole('button', { name: /^stop$/i });
    fireEvent.click(stopButtons[stopButtons.length - 1]);
    expect(botApi.stop).toHaveBeenCalledWith(7);

    // Auto-poll flips the card to the stopped "Paused" badge on its own.
    await waitFor(
      () => expect(screen.getByText('Paused')).toBeInTheDocument(),
      {
        timeout: 4000,
      },
    );
    expect(botApi.getStatus).toHaveBeenCalledWith(7);
  });

  it('Stop button shows confirm dialog and calls botApi.stop on confirm', async () => {
    loadOne({ status: 'running' });
    vi.mocked(botApi.stop).mockResolvedValueOnce({
      id: 7,
      bot_name: 'Lifecycle bot',
      status: 'stopping',
      desired_status: 'stopped',
      is_process_running: true,
      error_message: null,
    });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Lifecycle bot')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(screen.getByText(/Stop "Lifecycle bot"\?/)).toBeInTheDocument();

    const stopButtons = screen.getAllByRole('button', { name: /^stop$/i });
    fireEvent.click(stopButtons[stopButtons.length - 1]);
    expect(botApi.stop).toHaveBeenCalledWith(7);
  });

  it('Delete button confirms then removes the row', async () => {
    loadOne();
    vi.mocked(botApi.remove).mockResolvedValueOnce(undefined);

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Lifecycle bot')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /delete bot/i }));
    expect(screen.getByText(/Delete "Lifecycle bot"\?/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(botApi.remove).toHaveBeenCalledWith(7);
    await waitFor(() =>
      expect(screen.queryByText('Lifecycle bot')).not.toBeInTheDocument(),
    );
  });

  it('ERROR bot shows Start (not Fix connection) and routes through the Launchpad', async () => {
    loadOne({ status: 'error', error_message: 'Process crashed' });

    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Lifecycle bot')).toBeInTheDocument(),
    );
    // The Sync / "Fix connection" affordance is gone from the card — an errored
    // bot recovers by relaunching through the Launchpad mode picker.
    expect(
      screen.queryByRole('button', { name: /fix connection/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    expect(botApi.start).not.toHaveBeenCalled();
    expect(botApi.sync).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /start dry-run/i }),
      ).toBeInTheDocument(),
    );
  });

  it('empty state shows a create CTA and fires no lifecycle calls', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No bots yet/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /Create your first bot/i }),
    ).toBeInTheDocument();
    expect(botApi.start).not.toHaveBeenCalled();
  });
});
