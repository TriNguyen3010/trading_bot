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
    // resetAllMocks (not clearAllMocks) — also resets implementations set via
    // mockReturnValue, preventing leak between tests.
    vi.resetAllMocks();
    useWalletStore.setState({
      address: '0xabc',
      nonce: 'n',
      signature: 's',
      status: 'ready',
      user: null,
      error: null,
      signingMessage: null,
    });
  });

  it('shows skeleton cards while loading', () => {
    vi.mocked(botApi.list).mockReturnValue(new Promise(() => {})); // never resolves
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
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByText(/ETH-USDT/)).toBeInTheDocument();
  });

  it('shows empty banner + demo samples when list is empty', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/haven't built any bots yet/i),
      ).toBeInTheDocument(),
    );
    const demoPills = screen.getAllByText('Demo');
    expect(demoPills.length).toBeGreaterThan(0);
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
      expect(
        screen.getByText(/haven't built any bots yet/i),
      ).toBeInTheDocument(),
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
    // Pair shows '?' because config failed
    expect(screen.getByText(/\?/)).toBeInTheDocument();
  });

  it('Refresh button triggers a refetch', async () => {
    // First load returns empty; second load returns 1 bot — clicking
    // Refresh between them must show the new bot.
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/haven't built any bots/i)).toBeInTheDocument(),
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
    expect(
      screen.queryByText(/haven't built any bots/i),
    ).not.toBeInTheDocument();
  });

  it('Refresh button is hidden during loading / error states', async () => {
    // Loading: never-resolving list → refresh hidden
    vi.mocked(botApi.list).mockReturnValue(new Promise(() => {}));
    const { unmount } = renderPage();
    expect(
      screen.queryByRole('button', { name: /refresh/i }),
    ).not.toBeInTheDocument();
    unmount();

    // Error: list rejects → refresh hidden (Retry inside card replaces it)
    vi.resetAllMocks();
    useWalletStore.setState({
      address: '0xabc',
      nonce: 'n',
      signature: 's',
      status: 'ready',
      user: null,
      error: null,
      signingMessage: null,
    });
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
    // Empty
    vi.mocked(botApi.list).mockResolvedValueOnce([]);
    const { unmount } = renderPage();
    await waitFor(() =>
      expect(screen.getByText(/haven't built any bots/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByPlaceholderText(/search bots/i),
    ).not.toBeInTheDocument();
    unmount();

    // Error
    vi.resetAllMocks();
    useWalletStore.setState({
      address: '0xabc',
      nonce: 'n',
      signature: 's',
      status: 'ready',
      user: null,
      error: null,
      signingMessage: null,
    });
    vi.mocked(botApi.list).mockRejectedValueOnce(new Error('x'));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/couldn't load your bots/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByPlaceholderText(/search bots/i),
    ).not.toBeInTheDocument();
  });

  it('unmount during fetch does not produce a stale state update or crash', async () => {
    // React 18 removed the "setState on unmounted" warning (facebook/react#22114),
    // so this test can't assert on console.error. Instead we (a) confirm we get
    // to the loading state, (b) unmount, (c) resolve the in-flight fetch AFTER
    // unmount, and (d) assert no exception escapes the microtask queue. If the
    // cancelled flag is removed, React will still tolerate the late setState
    // silently in v18, but this test documents the intent.
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

// ── Task 6: lifecycle actions wired on BotCard ─────────────────────────
describe('DashboardPage — lifecycle actions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useWalletStore.setState({
      address: '0xabc',
      nonce: 'n',
      signature: 's',
      status: 'ready',
      user: null,
      error: null,
      signingMessage: null,
    });
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

    // C-1 (R5 Critical): the Start button must open the Launchpad mode-gate,
    // never fire botApi.start directly — otherwise a PAUSED ex-Live bot
    // (dry_run=false) restarts in LIVE mode without picking a mode.
    expect(botApi.start).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /start dry-run/i }),
      ).toBeInTheDocument(),
    );
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

    // Click the Stop button on the card → confirm dialog opens.
    fireEvent.click(screen.getByRole('button', { name: /^stop$/i }));
    expect(screen.getByText(/Stop "Lifecycle bot"\?/)).toBeInTheDocument();

    // Click the Stop button INSIDE the dialog (it's the last "Stop" on screen).
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

  it('Sync button visible only in ERROR mode', async () => {
    loadOne({ status: 'stopped', error_message: 'Process crashed' });
    vi.mocked(botApi.sync).mockResolvedValueOnce({
      id: 7,
      bot_name: 'Lifecycle bot',
      status: 'stopped',
      desired_status: null,
      is_process_running: false,
      error_message: null,
    });

    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /fix connection/i }),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /fix connection/i }));
    expect(botApi.sync).toHaveBeenCalledWith(7);
  });

  it('demo cards do not call real lifecycle endpoints', async () => {
    vi.mocked(botApi.list).mockResolvedValueOnce([]); // empty → demos render
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText(/haven't built any bots yet/i),
      ).toBeInTheDocument(),
    );
    // The demo cards render the action UI in disabled state. Even if the
    // user clicks Start, no real botApi call should fire.
    const startBtns = screen.queryAllByRole('button', { name: /^start$/i });
    for (const b of startBtns) {
      fireEvent.click(b);
    }
    expect(botApi.start).not.toHaveBeenCalled();
  });
});
