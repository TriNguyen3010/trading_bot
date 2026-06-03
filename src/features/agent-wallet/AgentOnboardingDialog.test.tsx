import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgentOnboardingDialog } from './AgentOnboardingDialog';
import { useAgentSignFlow } from './useAgentSignFlow';

vi.mock('./useAgentSignFlow');

beforeEach(() => vi.clearAllMocks());

describe('AgentOnboardingDialog', () => {
  it('renders explain step when stage=idle', () => {
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'idle' },
      run: vi.fn(),
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/Generate & Sign/i)).toBeInTheDocument();
  });

  it('clicking Generate calls run with parsed limit', () => {
    const run = vi.fn();
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'idle' },
      run,
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        suggestedLimit={5000}
        onSuccess={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Generate & Sign/i }));
    expect(run).toHaveBeenCalledWith({ spendingLimitUsd: 5000 });
  });

  it('blocks Generate on a negative limit (no silent no-limit launch)', () => {
    const run = vi.fn();
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'idle' },
      run,
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />,
    );
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '-5' },
    });
    const btn = screen.getByRole('button', { name: /Generate & Sign/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(run).not.toHaveBeenCalled();
  });

  it('renders spinner during creating/signing/confirming', () => {
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'signing', agentAddress: '0xagent' },
      run: vi.fn(),
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/ký trên ví/i)).toBeInTheDocument();
  });

  it('calls onSuccess when state transitions to success', async () => {
    const onSuccess = vi.fn();
    const agent = {
      id: 1,
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      is_active: true,
      spent_today_usd: 0,
      created_at: '2026-05-28T00:00:00Z',
    };
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'success', agent },
      run: vi.fn(),
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={onSuccess}
      />,
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(agent));
  });

  it('fires onSuccess at most once even when the parent re-renders with a new onSuccess ref (no relaunch loop)', () => {
    const agent = {
      id: 1,
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      is_active: true,
      spent_today_usd: 0,
      created_at: '2026-05-28T00:00:00Z',
    };
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'success', agent },
      run: vi.fn(),
      reset: vi.fn(),
    });
    const onSuccess1 = vi.fn();
    const { rerender } = render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={onSuccess1}
      />,
    );
    expect(onSuccess1).toHaveBeenCalledTimes(1);

    // LaunchpadModal passes an inline (non-memoized) onSuccess, so each parent
    // re-render hands a fresh reference. While the flow state stays 'success'
    // this must NOT re-fire onSuccess — otherwise doLaunch('live') loops and
    // fires repeated real-money launches (Devin PR #19 critical finding).
    const onSuccess2 = vi.fn();
    rerender(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={onSuccess2}
      />,
    );
    expect(onSuccess2).not.toHaveBeenCalled();
    expect(onSuccess1).toHaveBeenCalledTimes(1);
  });

  it('success Continue button calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    const agent = {
      id: 1,
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      is_active: true,
      spent_today_usd: 0,
      created_at: '2026-05-28T00:00:00Z',
    };
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'success', agent },
      run: vi.fn(),
      reset: vi.fn(),
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={onOpenChange}
        onSuccess={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('error state shows retry + cancel', () => {
    const reset = vi.fn();
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: { stage: 'error', message: 'Bạn đã huỷ ký', userRejected: true },
      run: vi.fn(),
      reset,
    });
    render(
      <AgentOnboardingDialog
        open
        onOpenChange={() => {}}
        onSuccess={() => {}}
      />,
    );
    expect(screen.getByText(/huỷ ký/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(reset).toHaveBeenCalled();
  });
});

describe('AgentOnboardingDialog — cap-full state', () => {
  it('renders CapFullStep with "Quản lý agent" button when error is cap-full', () => {
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: {
        stage: 'error',
        message: 'Too many extra agents — limit is 3',
        userRejected: false,
      },
      run: vi.fn(),
      reset: vi.fn(),
    });

    const onManageAgents = vi.fn();
    render(
      <AgentOnboardingDialog
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        onManageAgents={onManageAgents}
      />,
    );

    expect(
      screen.getByText(/Đã đạt giới hạn agent Hyperliquid/),
    ).toBeInTheDocument();

    const manageBtn = screen.getByRole('button', { name: /Quản lý agent/i });
    fireEvent.click(manageBtn);
    expect(onManageAgents).toHaveBeenCalledTimes(1);
  });

  it('renders generic ErrorStep (not CapFullStep) for a non-cap-full error', () => {
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: {
        stage: 'error',
        message: 'Network error',
        userRejected: false,
      },
      run: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <AgentOnboardingDialog
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        onManageAgents={vi.fn()}
      />,
    );

    // Should show generic error retry UI, NOT the cap-full text
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/Đã đạt giới hạn agent Hyperliquid/),
    ).not.toBeInTheDocument();
  });

  // F5: cap-full with no manage handler must NOT dead-end on a no-op button —
  // fall back to the generic ErrorStep so Retry/Cancel are always available.
  it('falls back to ErrorStep (working Retry, no dead-end) when cap-full but onManageAgents omitted', () => {
    const reset = vi.fn();
    vi.mocked(useAgentSignFlow).mockReturnValue({
      state: {
        stage: 'error',
        message: 'Too many extra agents — limit is 3',
        userRejected: false,
      },
      run: vi.fn(),
      reset,
    });

    render(
      <AgentOnboardingDialog
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
        // onManageAgents intentionally omitted
      />,
    );

    // No cap-full banner and no no-op "Quản lý agent" button…
    expect(
      screen.queryByText(/Đã đạt giới hạn agent Hyperliquid/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Quản lý agent/i }),
    ).not.toBeInTheDocument();
    // …instead a generic error with a working Retry.
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(reset).toHaveBeenCalled();
  });
});
