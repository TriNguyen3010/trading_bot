import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyBotsDialog } from './MyBotsDialog';
import { useMyBotsDialogStore } from './my-bots-dialog.store';

vi.mock('./bot.api', () => ({
  botApi: {
    list: vi.fn(),
    getConfig: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return { ...actual, useNavigate: () => mockNavigate };
});

import { botApi } from './bot.api';

const mockList = vi.mocked(botApi.list);
const mockGetConfig = vi.mocked(botApi.getConfig);

function openDialog() {
  useMyBotsDialogStore.getState().setOpen(true);
}

function renderDialog() {
  return render(
    <MemoryRouter>
      <MyBotsDialog />
    </MemoryRouter>,
  );
}

describe('MyBotsDialog', () => {
  beforeEach(() => {
    useMyBotsDialogStore.setState({ open: false });
    mockList.mockReset();
    mockGetConfig.mockReset();
    mockNavigate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when dialog is closed', () => {
    renderDialog();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows skeleton while loading list', () => {
    mockList.mockImplementation(() => new Promise(() => {})); // never resolves
    openDialog();
    renderDialog();
    expect(screen.getAllByTestId('my-bots-skeleton').length).toBeGreaterThan(0);
  });

  it('renders bot cards when list resolves', async () => {
    mockList.mockResolvedValueOnce([
      {
        id: 80,
        bot_name: 'Tribot',
        status: 'stopped',
        strategy_name: 'TriStrategy',
        desired_status: null,
        error_message: null,
      },
    ]);
    mockGetConfig.mockResolvedValueOnce({
      config: {
        dry_run: true,
        timeframe: '5m',
        exchange: { pair_whitelist: ['BTC/USDT:USDT'] },
      },
    });

    openDialog();
    renderDialog();

    expect(await screen.findByText('Tribot')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('BTC-USDT')).toBeInTheDocument();
    });
    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('DRY-RUN')).toBeInTheDocument();
  });

  it('renders em-dash placeholders for fields BE does not expose', async () => {
    mockList.mockResolvedValueOnce([
      {
        id: 1,
        bot_name: 'X',
        status: 'stopped',
        strategy_name: 'S',
        desired_status: null,
        error_message: null,
      },
    ]);
    mockGetConfig.mockResolvedValueOnce({
      config: {
        dry_run: true,
        timeframe: '5m',
        exchange: { pair_whitelist: ['BTC/USDT:USDT'] },
      },
    });

    openDialog();
    renderDialog();

    await screen.findByText('X');
    // 3 stats placeholders (TODAY/WIN/TRADES) + 1 uptime
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(4);
  });

  it('renders empty state when list is empty', async () => {
    mockList.mockResolvedValueOnce([]);
    openDialog();
    renderDialog();
    expect(await screen.findByText(/no bots yet/i)).toBeInTheDocument();
  });

  it('navigates to /bots/{id} when a card is clicked', async () => {
    mockList.mockResolvedValueOnce([
      {
        id: 80,
        bot_name: 'Tribot',
        status: 'stopped',
        strategy_name: 'S',
        desired_status: null,
        error_message: null,
      },
    ]);
    mockGetConfig.mockResolvedValueOnce({
      config: {
        dry_run: true,
        timeframe: '5m',
        exchange: { pair_whitelist: ['BTC/USDT:USDT'] },
      },
    });

    openDialog();
    renderDialog();

    const card = await screen.findByRole('link', { name: /tribot/i });
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith('/bots/80');
    // Closing the dialog on navigation is handled by setOpen(false)
    expect(useMyBotsDialogStore.getState().open).toBe(false);
  });

  it('renders error state + retry button when list fetch fails', async () => {
    const { HttpError } = await import('@/lib/http');
    mockList.mockRejectedValueOnce(new HttpError(500, 'boom'));

    openDialog();
    renderDialog();

    expect(await screen.findByText(/500: boom/i)).toBeInTheDocument();

    // Now make the retry succeed
    mockList.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findByText(/no bots yet/i)).toBeInTheDocument();
  });

  it('keeps showing the card when per-bot config fetch fails', async () => {
    mockList.mockResolvedValueOnce([
      {
        id: 80,
        bot_name: 'Tribot',
        status: 'stopped',
        strategy_name: 'S',
        desired_status: null,
        error_message: null,
      },
    ]);
    mockGetConfig.mockRejectedValueOnce(new Error('config down'));

    openDialog();
    renderDialog();

    expect(await screen.findByText('Tribot')).toBeInTheDocument();
    // pair/timeframe should fall back to '?' (small grey)
    await waitFor(() => {
      expect(screen.getAllByText('?').length).toBeGreaterThan(0);
    });
  });
});
