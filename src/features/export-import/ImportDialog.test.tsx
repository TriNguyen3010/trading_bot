import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportDialog } from './ImportDialog';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { buildUnifiedPayload } from '@/lib/serializer';
import { makeIndicator } from '@/features/indicators/indicator-registry';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

/** Seed a valid long futures tp_sl bot; `slEnabled` toggles SL. */
function seedValidBot(slEnabled: boolean) {
  const store = useBuilderStore.getState();
  store.resetAll();
  store.setBotName('Imported Bot');
  store.patchBotConfig({
    pair: 'BTC-USDC',
    timeframe: '5m',
    leverage: 5,
    marketType: 'futures',
    stakeCurrency: 'USDC',
  });
  store.patchStrategy({
    name: 'Strat',
    candlestick: ['close'],
    indicators: [makeIndicator('RSI')],
    entryConditions: {
      groupConnector: 'AND',
      groups: [
        {
          id: 'g1',
          intraConnector: 'AND',
          rules: [
            {
              id: 'c1',
              left: 'RSI-14',
              op: '<',
              right_type: 'number',
              right_number: 30,
              right_indicator: null,
              lookback: 0,
            },
          ],
        },
      ],
    },
  });
  store.patchDirection({ direction: 'long', orderType: 'market' });
  store.patchCloseMethod({
    type: 'tp_sl',
    tpEnabled: true,
    tpLevels: [{ profit: 5, amount: 100 }],
    slEnabled,
    slValue: -3,
  });
}

function applyJson(json: string) {
  render(<ImportDialog open onOpenChange={vi.fn()} />);
  const ta = screen.getByPlaceholderText(/bot_name/i);
  fireEvent.change(ta, { target: { value: json } });
  fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
}

describe('ImportDialog', () => {
  beforeEach(() => {
    useBuilderStore.getState().resetAll();
    vi.clearAllMocks();
  });

  it('rejects malformed JSON and leaves the builder untouched', () => {
    const before = useBuilderStore.getState().botName;
    applyJson('{ not valid json');
    expect(screen.getByText(/Invalid JSON/i)).toBeInTheDocument();
    expect(useBuilderStore.getState().botName).toBe(before);
  });

  it('round-trips a tp_sl bot with SL off (sl_enabled preserved through import)', () => {
    seedValidBot(false);
    const json = JSON.stringify(
      buildUnifiedPayload(useBuilderStore.getState()),
    );
    useBuilderStore.getState().resetAll();

    applyJson(json);

    const cm = useBuilderStore.getState().closeMethod;
    expect(cm.type).toBe('tp_sl');
    expect(cm.slEnabled).toBe(false); // not silently re-enabled (F2 import path)
    expect(useBuilderStore.getState().botName).toBe('Imported Bot');
  });

  // E-3: a hand-edited file decoding to short+spot must be refused, not hydrated.
  it('refuses an inconsistent short+spot file and leaves the builder untouched', () => {
    // Build a valid futures bot, then force the inconsistency: short conditions
    // present, can_short omitted (so schema T-2 doesn't fire), trading_mode spot.
    seedValidBot(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = buildUnifiedPayload(useBuilderStore.getState()) as any;
    // Copy the long conditions onto entry_short so deserialize resolves 'short'.
    payload.configurations.signals.entry_short = JSON.parse(
      JSON.stringify(payload.configurations.signals.entry_long),
    );
    // Satisfy configurations rule (3) (short conditions need can_short) but keep
    // top-level can_short false so T-2 (can_short→futures) does NOT fire, and
    // set spot/leverage=1 so T-3 passes — the payload is schema-valid yet decodes
    // to the impossible short+spot combo.
    payload.configurations.can_short = true;
    payload.can_short = false;
    payload.trading_mode = 'spot';
    payload.leverage = 1;
    payload.pair = 'BTC/USDC';

    useBuilderStore.getState().resetAll();
    const before = useBuilderStore.getState().botName;
    applyJson(JSON.stringify(payload));

    expect(
      screen.getByText(/short direction requires a futures/i),
    ).toBeInTheDocument();
    expect(useBuilderStore.getState().botName).toBe(before); // untouched
  });

  it('clears stale input + error when the dialog is reopened (E-1)', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ImportDialog open onOpenChange={onOpenChange} />,
    );
    const ta = screen.getByPlaceholderText(/bot_name/i);
    fireEvent.change(ta, { target: { value: '{ broken' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply/i }));
    expect(screen.getByText(/Invalid JSON/i)).toBeInTheDocument();

    // Close then reopen.
    rerender(<ImportDialog open={false} onOpenChange={onOpenChange} />);
    rerender(<ImportDialog open onOpenChange={onOpenChange} />);

    expect(screen.queryByText(/Invalid JSON/i)).not.toBeInTheDocument();
    expect(
      (screen.getByPlaceholderText(/bot_name/i) as HTMLTextAreaElement).value,
    ).toBe('');
  });
});
