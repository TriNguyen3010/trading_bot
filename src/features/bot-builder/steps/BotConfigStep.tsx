import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBuilderStore } from '../store/builder.store';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { NumberInput } from '@/components/ui/number-input';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { FormField } from '@/components/ui/form-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  TIMEFRAMES,
  EXCHANGES,
  STAKE_CURRENCIES,
  PAIR_SUGGESTIONS,
} from '@/lib/constants';
import type {
  TradingMode,
  MarketType,
  MarginMode,
} from '@/types/builder.types';

export function BotConfigSetup() {
  const config = useBuilderStore((s) => s.botConfig);
  const patch = useBuilderStore((s) => s.patchBotConfig);
  const [pendingLive, setPendingLive] = useState(false);

  const handleTradingMode = (next: TradingMode) => {
    if (next === 'live' && config.tradingMode !== 'live') {
      setPendingLive(true);
      return;
    }
    patch({ tradingMode: next });
  };

  return (
    <>
      {/* `data-cy-anchor` markers let the Cypheus animation engine
       *  scroll the drawer body to the section it's currently filling.
       *  See `components/drawer-scroll.ts`. */}
      <div data-cy-anchor="bot-config:pair">
        <FormField
          label="Pair"
          required
          hint="Format: BASE-QUOTE (e.g. BTC-USDC). CSV converter to Freqtrade format arrives later."
        >
          <Input
            list="pair-suggestions"
            placeholder="BTC-USDC"
            value={config.pair}
            onChange={(e) => patch({ pair: e.target.value.toUpperCase() })}
            autoFocus
          />
          <datalist id="pair-suggestions">
            {PAIR_SUGGESTIONS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </FormField>
      </div>

      <FormField label="Timeframe" required>
        <Select
          value={config.timeframe}
          onChange={(e) => patch({ timeframe: e.target.value })}
        >
          {TIMEFRAMES.map((tf) => (
            <option key={tf.value} value={tf.value}>
              {tf.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Trading mode" required>
        <ToggleGroup<TradingMode>
          value={config.tradingMode}
          onChange={handleTradingMode}
          fullWidth
          ariaLabel="Trading mode"
          options={[
            {
              value: 'dry-run',
              label: 'Dry-run',
              description: 'Simulated wallet, safe to test.',
            },
            {
              value: 'live',
              label: 'Live trade',
              description: 'Real funds — confirmation required.',
              tone: 'bearish',
            },
          ]}
        />
      </FormField>

      <div data-cy-anchor="bot-config:leverage">
        <FormField
          label="Leverage"
          hint="Multiplier applied to your stake. ≥10× will warn at export."
        >
          <NumberInput
            value={config.leverage}
            onValueChange={(v) =>
              patch({ leverage: Math.max(1, Math.min(125, v ?? 1)) })
            }
            min={1}
            max={125}
            step={1}
            suffix="x"
          />
        </FormField>
      </div>

      <Dialog open={pendingLive} onOpenChange={setPendingLive}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-bearish/15 text-bearish">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Switch to Live trading?</DialogTitle>
            <DialogDescription>
              Live mode places orders with real funds. Dry-run is recommended
              while you tune the strategy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingLive(false)}>
              Stay in Dry-run
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                patch({ tradingMode: 'live' });
                setPendingLive(false);
              }}
            >
              I understand, go Live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BotConfigConfigure() {
  const config = useBuilderStore((s) => s.botConfig);
  const patch = useBuilderStore((s) => s.patchBotConfig);

  return (
    <>
      {/* Anchor for Cypheus animation — see drawer-scroll.ts. The
       *  Configure half of bot-config sits below the fold once Setup
       *  fields are filled, so we scroll to here right before snapping
       *  exchange/marketType/stake during template animation. */}
      <div data-cy-anchor="bot-config:exchange">
        <FormField label="Exchange" required>
          <Select
            value={config.exchange}
            onChange={(e) => patch({ exchange: e.target.value })}
          >
            {EXCHANGES.map((ex) => (
              <option key={ex.value} value={ex.value}>
                {ex.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Market type" required>
        <ToggleGroup<MarketType>
          value={config.marketType}
          onChange={(v) => patch({ marketType: v })}
          fullWidth
          options={[
            { value: 'spot', label: 'Spot' },
            { value: 'futures', label: 'Futures' },
          ]}
        />
      </FormField>

      {config.marketType === 'futures' ? (
        <FormField label="Margin mode" required>
          <ToggleGroup<MarginMode>
            value={config.marginMode}
            onChange={(v) => patch({ marginMode: v })}
            fullWidth
            options={[
              { value: 'cross', label: 'Cross' },
              { value: 'isolated', label: 'Isolated' },
            ]}
          />
        </FormField>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Max open trades"
          hint="−1 = unlimited"
        >
          <NumberInput
            value={config.maxOpenTrades}
            onValueChange={(v) => patch({ maxOpenTrades: v ?? -1 })}
            min={-1}
            step={1}
          />
        </FormField>
        <FormField label="Stake currency">
          <Select
            value={config.stakeCurrency}
            onChange={(e) => patch({ stakeCurrency: e.target.value })}
          >
            {STAKE_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Stake amount"
          hint="Per-trade stake."
        >
          <NumberInput
            value={config.stakeAmount}
            onValueChange={(v) =>
              patch({ stakeAmount: Math.max(0, v ?? 0) })
            }
            min={0}
            step={1}
            suffix={config.stakeCurrency}
          />
        </FormField>
        {config.tradingMode === 'dry-run' ? (
          <FormField
            label="Dry-run wallet"
            hint="Simulated total balance."
          >
            <NumberInput
              value={config.dryRunWallet}
              onValueChange={(v) =>
                patch({ dryRunWallet: Math.max(0, v ?? 0) })
              }
              min={0}
              step={100}
              suffix={config.stakeCurrency}
            />
          </FormField>
        ) : null}
      </div>

      <div className="rounded-md border border-dashed border-border bg-canvas/40 p-4 text-xs text-fg-muted">
        Telegram, position adjustment, exit profit rules, and ROI fallback
        will land in M3 once we wire the serializer to the full bot/strategy
        schema.
      </div>
    </>
  );
}
