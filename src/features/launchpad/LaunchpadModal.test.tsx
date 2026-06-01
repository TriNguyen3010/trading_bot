import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LaunchpadModal, type LaunchpadBot } from './LaunchpadModal';
import { launchBot, AgentNotActiveError } from './launch-actions';

vi.mock('./launch-actions', async () => {
  const actual =
    await vi.importActual<typeof import('./launch-actions')>(
      './launch-actions',
    );
  return {
    ...actual,
    launchBot: vi.fn(),
  };
});
vi.mock('@/features/bot-monitoring/bot.api', () => ({
  botApi: { sync: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/agent-wallet/AgentOnboardingDialog', () => ({
  AgentOnboardingDialog: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onSuccess: (agent: { id: number }) => void;
  }) =>
    open ? (
      <button onClick={() => onSuccess({ id: 1 })}>onboarding-success</button>
    ) : null,
}));

const mockLaunch = vi.mocked(launchBot);

const bot: LaunchpadBot = {
  id: 42,
  name: 'Bollinger breakout',
  strategyName: 'BollingerBreakout',
  pair: 'BTC/USDT',
  timeframe: '5m',
  mode: 'PAUSED',
  errorMsg: null,
};

beforeEach(() => {
  mockLaunch
    .mockReset()
    .mockResolvedValue({ id: 42, status: 'starting' } as never);
});

describe('LaunchpadModal', () => {
  it('renders 3 mode cards + bot name', () => {
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={() => {}}
      />,
    );
    expect(screen.getByText('Bollinger breakout')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /run backtest/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start dry-run/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /go live/i }),
    ).toBeInTheDocument();
  });

  it('dry-run launches immediately and calls onLaunched', async () => {
    const onLaunched = vi.fn();
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={onLaunched}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /start dry-run/i }));
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledWith(42, 'dry-run'));
    await waitFor(() => expect(onLaunched).toHaveBeenCalled());
  });

  it('Go Live calls launchBot(id, "live")', async () => {
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /go live/i }));
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledWith(42, 'live'));
  });

  it('AgentNotActiveError opens onboarding dialog', async () => {
    mockLaunch.mockRejectedValueOnce(new AgentNotActiveError());
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /go live/i }));
    expect(await screen.findByText('onboarding-success')).toBeInTheDocument();
  });

  it('onboarding success resumes live launch', async () => {
    mockLaunch
      .mockRejectedValueOnce(new AgentNotActiveError())
      .mockResolvedValueOnce({ id: 42, status: 'starting' } as never);
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={() => {}}
        onLaunched={() => {}}
      />,
    );
    // First click: AgentNotActiveError → opens onboarding
    fireEvent.click(screen.getByRole('button', { name: /go live/i }));
    const successBtn = await screen.findByText('onboarding-success');
    // Click onboarding success button to resume launch
    fireEvent.click(successBtn);
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledTimes(2));
    expect(mockLaunch).toHaveBeenNthCalledWith(1, 42, 'live');
    expect(mockLaunch).toHaveBeenNthCalledWith(2, 42, 'live');
  });

  it('backtest card delegates to onBacktest', () => {
    const onBacktest = vi.fn();
    render(
      <LaunchpadModal
        open
        bot={bot}
        onOpenChange={() => {}}
        onBacktest={onBacktest}
        onLaunched={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }));
    expect(onBacktest).toHaveBeenCalled();
  });
});
