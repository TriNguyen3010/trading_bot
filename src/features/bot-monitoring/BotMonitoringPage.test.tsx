import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BotMonitoringPage } from './BotMonitoringPage';
import { botApi as lifecycleApi } from './bot.api';

// jsdom doesn't implement SVG geometry; the page's chart components call these.
beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, 'getPointAtLength', {
    value: () => ({ x: 0, y: 0 }),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
    value: () => 0,
    writable: true,
    configurable: true,
  });
});

// Real lifecycle endpoints (start/stop/sync). The safety contract under test:
// the stopped-Start button must NEVER call start() directly.
vi.mock('./bot.api', () => ({
  botApi: {
    start: vi.fn(),
    stop: vi.fn(),
    sync: vi.fn(),
    getStatus: vi.fn().mockResolvedValue({
      id: 7,
      status: 'stopped',
      desired_status: null,
      is_process_running: false,
      error_message: null,
    }),
  },
}));

// Keep the live-status pill 'stopped' (so the Start button renders) without
// spinning the real poll timer.
vi.mock('./useBotStatusPoll', () => ({
  useBotStatusPoll: () => ({
    status: {
      id: 7,
      bot_name: 'Test bot',
      status: 'stopped',
      desired_status: null,
      is_process_running: false,
      error_message: null,
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
    setStatus: vi.fn(),
  }),
}));

// Canvas-based background visual — not implemented in jsdom + irrelevant here.
vi.mock('@/features/fx/DotGridSpotlight', () => ({
  DotGridSpotlight: () => null,
}));

// Hyperliquid service hits the network — stub all methods the page uses.
vi.mock('./hyperliquid.service', () => ({
  hlApi: {
    getCandleSnapshot: vi.fn().mockResolvedValue([]),
    getMetaAndAssetCtxs: vi.fn().mockResolvedValue(null),
    getL2Book: vi.fn().mockResolvedValue(null),
  },
}));

describe('BotMonitoringPage — Start bypass closed (Devin R5 / PR #15 Task 5b)', () => {
  beforeEach(() => {
    vi.mocked(lifecycleApi.start).mockReset();
  });

  it('stopped Start routes to the Dashboard Launchpad and does NOT call lifecycleApi.start', async () => {
    render(
      <MemoryRouter initialEntries={['/bots/7']}>
        <Routes>
          <Route path="/bots/:id" element={<BotMonitoringPage />} />
          <Route path="/dashboard" element={<div>dashboard-launchpad</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // Page renders → the header Start button appears (bot is stopped).
    const startBtn = await screen.findByRole(
      'button',
      { name: /start/i },
      { timeout: 4000 },
    );
    fireEvent.click(startBtn);

    // Safety contract: must NOT start directly (that bypasses the Launchpad gate
    // and could relaunch an ex-Live bot in LIVE without picking a mode).
    expect(lifecycleApi.start).not.toHaveBeenCalled();
    // It navigates to the Dashboard, which opens the Launchpad via router state.
    await waitFor(() =>
      expect(screen.getByText('dashboard-launchpad')).toBeInTheDocument(),
    );
  });
});
