import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BacktestPanel, DryRunPanel, LivePanel } from './LaunchpadPanels';
import { shortAddress } from './launchpad-helpers';
import type { AgentInfoResponse } from '@/types/api-helpers';

const AGENT: AgentInfoResponse = {
  id: 1,
  agent_address: '0xAbCdEf1234567890aBcDeF1234567890abcdef12',
  label: 'bot-agent',
  spending_limit_usd: null,
  spent_today_usd: 0,
  is_active: true,
  created_at: '2026-06-01T00:00:00Z',
};

const backtestProps = {
  pair: 'BTC/USDT',
  timeframe: '5m',
  currency: 'USDT',
  strategyMissing: false,
  days: 7,
  stake: '100',
  wallet: '1000',
  onDaysChange: vi.fn(),
  onStakeChange: vi.fn(),
  onWalletChange: vi.fn(),
};

const telegramProps = {
  token: '',
  chatId: '',
  onTokenChange: vi.fn(),
  onChatIdChange: vi.fn(),
};

const liveProps = {
  agent: AGENT,
  agentLoading: false,
  stakeAmount: 100,
  currency: 'USDT',
  apiWalletAddress: '',
  onApiWalletAddressChange: vi.fn(),
  ...telegramProps,
  ack: false,
  onAckChange: vi.fn(),
  onManageAgents: vi.fn(),
};

describe('shortAddress', () => {
  it('keeps 0x + 4 head chars and 4 tail chars', () => {
    expect(shortAddress('0xAbCdEf1234567890aBcDeF1234567890abcdef12')).toBe(
      '0xAbCd…ef12',
    );
  });
});

describe('BacktestPanel', () => {
  it('reports preset clicks', () => {
    const onDaysChange = vi.fn();
    render(<BacktestPanel {...backtestProps} onDaysChange={onDaysChange} />);
    fireEvent.click(screen.getByRole('button', { name: /30 days/i }));
    expect(onDaysChange).toHaveBeenCalledWith(30);
  });

  it('warns when the bot has no strategy name', () => {
    render(<BacktestPanel {...backtestProps} strategyMissing />);
    expect(screen.getByText(/no strategy name/i)).toBeInTheDocument();
  });
});

describe('DryRunPanel', () => {
  it('keeps Telegram fields collapsed until expanded', () => {
    render(<DryRunPanel {...telegramProps} />);
    const toggle = screen.getByRole('button', {
      name: /telegram notifications/i,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText(/telegram bot token/i)).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText(/telegram bot token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/telegram chat id/i)).toBeInTheDocument();
  });

  it('starts expanded when a token is prefilled', () => {
    render(<DryRunPanel {...telegramProps} token="123:abc" />);
    expect(screen.getByLabelText(/telegram bot token/i)).toBeInTheDocument();
  });
});

describe('LivePanel', () => {
  it('shows the active agent short address and label', () => {
    render(<LivePanel {...liveProps} />);
    expect(screen.getByText(/0xAbCd…ef12/)).toBeInTheDocument();
    expect(screen.getByText(/bot-agent/)).toBeInTheDocument();
  });

  it('explains onboarding when there is no active agent', () => {
    render(<LivePanel {...liveProps} agent={null} />);
    expect(screen.getByText(/agent onboarding/i)).toBeInTheDocument();
  });

  it('reports risk acknowledgement changes', () => {
    const onAckChange = vi.fn();
    render(<LivePanel {...liveProps} onAckChange={onAckChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onAckChange).toHaveBeenCalledWith(true);
  });

  it('reveals API wallet + Telegram inputs under Optional settings', () => {
    render(<LivePanel {...liveProps} />);
    expect(screen.queryByLabelText(/api wallet address/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /optional settings/i }));
    expect(screen.getByLabelText(/api wallet address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/telegram bot token/i)).toBeInTheDocument();
  });
});
