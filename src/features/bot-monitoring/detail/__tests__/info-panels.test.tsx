import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPanel } from '../StatusPanel';
import { ConfigPanel } from '../ConfigPanel';
import { ActivityLogPanel } from '../ActivityLogPanel';

describe('info panels', () => {
  it('StatusPanel shows state + process', () => {
    render(
      <StatusPanel
        status={
          {
            id: 7,
            status: 'running',
            desired_status: 'running',
            is_process_running: true,
            last_heartbeat: '2026-06-06T00:00:00Z',
            error_message: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        }
      />,
    );
    // State + Desired status both 'running'
    expect(screen.getAllByText('running').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('up')).toBeInTheDocument();
  });

  it('StatusPanel renders dashes for a null status', () => {
    render(<StatusPanel status={null} />);
    expect(screen.getByText('down')).toBeInTheDocument();
    // State / Desired status / Last heartbeat / Error all fall back to '—'.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('ConfigPanel renders only keys present in the raw config', () => {
    render(
      <ConfigPanel
        config={{
          exchange: { name: 'hyperliquid', pair_whitelist: ['BTC/USDC:USDC'] },
          stake_currency: 'USDC',
          stake_amount: 100,
          max_open_trades: 10,
          trading_mode: 'futures',
          dry_run: true,
          // leverage intentionally absent → no Leverage row
        }}
      />,
    );
    expect(screen.getByText('hyperliquid')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Dry-run')).toBeInTheDocument();
    expect(screen.queryByText('Leverage')).not.toBeInTheDocument();
  });

  it('ActivityLogPanel lists audit rows', () => {
    render(
      <ActivityLogPanel
        logs={[
          {
            id: 1,
            action: 'start',
            triggered_by: 'user',
            result: 'ok',
            timestamp: '2026-06-06T00:00:00Z',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        ]}
      />,
    );
    expect(screen.getByText(/start/)).toBeInTheDocument();
  });

  it('ActivityLogPanel shows empty hint', () => {
    render(<ActivityLogPanel logs={[]} />);
    expect(screen.getByText(/No activity yet/i)).toBeInTheDocument();
  });
});
