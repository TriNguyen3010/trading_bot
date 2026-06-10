import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  LaunchpadModal,
  type LaunchpadBot,
  type LaunchpadModalProps,
} from './LaunchpadModal';
import { launchBot, AgentNotActiveError } from './launch-actions';
import { backtestApi } from '@/features/backtest/backtest.api';
import { useActiveAgent } from '@/features/agent-wallet/useActiveAgent';

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
vi.mock('@/features/backtest/backtest.api', () => ({
  backtestApi: { start: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/features/agent-wallet/useActiveAgent', () => ({
  useActiveAgent: vi.fn(),
}));
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
vi.mock('@/features/agent-wallet/ManageAgentsModal', () => ({
  ManageAgentsModal: () => null,
}));

const mockLaunch = vi.mocked(launchBot);
const mockBacktestStart = vi.mocked(backtestApi.start);
const mockUseActiveAgent = vi.mocked(useActiveAgent);

const bot: LaunchpadBot = {
  id: 42,
  name: 'Bollinger breakout',
  strategyName: 'BollingerBreakout',
  pair: 'BTC/USDT',
  timeframe: '5m',
  mode: 'PAUSED',
  errorMsg: null,
  stakeAmount: 100,
};

const API_WALLET_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678';

const AGENT = {
  id: 1,
  agent_address: '0xAbCdEf1234567890aBcDeF1234567890abcdef12',
  label: 'bot-agent',
  spending_limit_usd: null,
  spent_today_usd: 0,
  is_active: true,
  created_at: '2026-06-01T00:00:00Z',
};

function renderModal(overrides: Partial<LaunchpadModalProps> = {}) {
  return render(
    <LaunchpadModal
      open
      bot={bot}
      onOpenChange={() => {}}
      onBacktestStarted={() => {}}
      onLaunched={() => {}}
      {...overrides}
    />,
  );
}

const selectMode = (name: RegExp) =>
  fireEvent.click(screen.getByRole('radio', { name }));

const ackRisk = () => fireEvent.click(screen.getByRole('checkbox'));

const actionButton = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  mockLaunch
    .mockReset()
    .mockResolvedValue({ id: 42, status: 'starting' } as never);
  mockBacktestStart.mockReset().mockResolvedValue({
    job_id: 1,
    backtest_id: 99,
    status: 'queued',
    message: 'ok',
    poll_url: '/backtest/99',
  });
  mockUseActiveAgent
    .mockReset()
    .mockReturnValue({ agent: AGENT, loading: false, refresh: vi.fn() });
});

describe('LaunchpadModal', () => {
  it('renders 3 mode radios with dry-run pre-selected', () => {
    renderModal();
    expect(screen.getByText('Bollinger breakout')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /backtest/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('radio', { name: /dry-run/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /live/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(actionButton(/start dry-run/i)).toBeInTheDocument();
  });

  it('switching mode swaps the detail panel and the action button', () => {
    renderModal();
    selectMode(/backtest/i);
    expect(actionButton(/run backtest/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /7 days/i })).toBeInTheDocument();
    selectMode(/live/i);
    expect(actionButton(/go live/i)).toBeInTheDocument();
    expect(screen.getByText(/pre-flight checks/i)).toBeInTheDocument();
  });

  it('starts dry-run and calls onLaunched', async () => {
    const onLaunched = vi.fn();
    renderModal({ onLaunched });
    fireEvent.click(actionButton(/start dry-run/i));
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledWith(42, 'dry-run'));
    await waitFor(() => expect(onLaunched).toHaveBeenCalled());
  });

  it('dry-run passes telegram config when both fields are filled', async () => {
    renderModal();
    fireEvent.click(
      screen.getByRole('button', { name: /telegram notifications/i }),
    );
    fireEvent.change(screen.getByLabelText(/telegram bot token/i), {
      target: { value: '123:abc' },
    });
    fireEvent.change(screen.getByLabelText(/telegram chat id/i), {
      target: { value: '99' },
    });
    fireEvent.click(actionButton(/start dry-run/i));
    await waitFor(() =>
      expect(mockLaunch).toHaveBeenCalledWith(
        42,
        'dry-run',
        { token: '123:abc', chat_id: '99' },
        undefined,
      ),
    );
  });

  it('blocks launch with an error when only one telegram field is filled', async () => {
    renderModal();
    fireEvent.click(
      screen.getByRole('button', { name: /telegram notifications/i }),
    );
    fireEvent.change(screen.getByLabelText(/telegram bot token/i), {
      target: { value: '123:abc' },
    });
    fireEvent.click(actionButton(/start dry-run/i));
    expect(await screen.findByText(/enter both/i)).toBeInTheDocument();
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  it('backtest: starts the run and hands the id to onBacktestStarted', async () => {
    const onBacktestStarted = vi.fn();
    const onOpenChange = vi.fn();
    renderModal({ onBacktestStarted, onOpenChange });
    selectMode(/backtest/i);
    fireEvent.click(actionButton(/run backtest/i));
    await waitFor(() =>
      expect(mockBacktestStart).toHaveBeenCalledWith(
        expect.objectContaining({
          bot_id: 42,
          strategy: 'BollingerBreakout',
          timeframe: '5m',
          stake_amount: 100,
          dry_run_wallet: 1000,
        }),
      ),
    );
    await waitFor(() => expect(onBacktestStarted).toHaveBeenCalledWith(99));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('backtest: start failure shows the error and keeps the modal open', async () => {
    mockBacktestStart.mockRejectedValueOnce(new Error('boom'));
    const onBacktestStarted = vi.fn();
    const onOpenChange = vi.fn();
    renderModal({ onBacktestStarted, onOpenChange });
    selectMode(/backtest/i);
    fireEvent.click(actionButton(/run backtest/i));
    expect(await screen.findByText(/boom/)).toBeInTheDocument();
    expect(onBacktestStarted).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('live: Go Live stays disabled until the risk checkbox is ticked', () => {
    renderModal();
    selectMode(/live/i);
    expect(actionButton(/go live/i)).toBeDisabled();
    ackRisk();
    expect(actionButton(/go live/i)).toBeEnabled();
  });

  it('live: launches after acknowledgement', async () => {
    renderModal();
    selectMode(/live/i);
    ackRisk();
    fireEvent.click(actionButton(/go live/i));
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledWith(42, 'live'));
  });

  it('live: passes API wallet address and telegram config when filled', async () => {
    renderModal();
    selectMode(/live/i);
    fireEvent.click(screen.getByRole('button', { name: /optional settings/i }));
    fireEvent.change(screen.getByLabelText(/api wallet address/i), {
      target: { value: API_WALLET_ADDRESS },
    });
    fireEvent.change(screen.getByLabelText(/telegram bot token/i), {
      target: { value: '123:abc' },
    });
    fireEvent.change(screen.getByLabelText(/telegram chat id/i), {
      target: { value: '99' },
    });
    ackRisk();
    fireEvent.click(actionButton(/go live/i));
    await waitFor(() =>
      expect(mockLaunch).toHaveBeenCalledWith(
        42,
        'live',
        { token: '123:abc', chat_id: '99' },
        { expectedAgentAddress: API_WALLET_ADDRESS },
      ),
    );
  });

  it('live: blocks Go Live when the API wallet address is malformed', async () => {
    renderModal();
    selectMode(/live/i);
    fireEvent.click(screen.getByRole('button', { name: /optional settings/i }));
    fireEvent.change(screen.getByLabelText(/api wallet address/i), {
      target: { value: 'not-an-address' },
    });
    ackRisk();
    fireEvent.click(actionButton(/go live/i));
    expect(await screen.findByText(/valid 0x address/i)).toBeInTheDocument();
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  it('live: AgentNotActiveError opens onboarding, success resumes launch', async () => {
    mockLaunch
      .mockRejectedValueOnce(new AgentNotActiveError())
      .mockResolvedValueOnce({ id: 42, status: 'starting' } as never);
    renderModal();
    selectMode(/live/i);
    ackRisk();
    fireEvent.click(actionButton(/go live/i));
    const successBtn = await screen.findByText('onboarding-success');
    fireEvent.click(successBtn);
    await waitFor(() => expect(mockLaunch).toHaveBeenCalledTimes(2));
    expect(mockLaunch).toHaveBeenNthCalledWith(1, 42, 'live');
    expect(mockLaunch).toHaveBeenNthCalledWith(2, 42, 'live');
  });

  it('live: shows the active agent in the pre-flight checks', () => {
    renderModal();
    selectMode(/live/i);
    // The address renders in both the checklist and the action-bar note.
    expect(screen.getAllByText(/0xAbCd…ef12/).length).toBeGreaterThanOrEqual(1);
  });

  it('live: explains onboarding when there is no active agent', () => {
    mockUseActiveAgent.mockReturnValue({
      agent: null,
      loading: false,
      refresh: vi.fn(),
    });
    renderModal();
    selectMode(/live/i);
    // Both the checklist item and the action-bar note mention onboarding.
    expect(
      screen.getAllByText(/agent onboarding/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('live: re-clicking the selected Live card does not reset the acknowledgement', () => {
    renderModal();
    selectMode(/live/i);
    ackRisk();
    expect(actionButton(/go live/i)).toBeEnabled();
    selectMode(/live/i); // accidental re-click on the already-selected card
    expect(actionButton(/go live/i)).toBeEnabled();
  });

  it('mode radios support arrow-key navigation', () => {
    renderModal();
    // dry-run is selected; ArrowRight moves to live, ArrowLeft back.
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: /live/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: /dry-run/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
