import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBuilderStore } from '../store/builder.store';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { NumberInput } from '@/components/ui/number-input';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { FormField } from '@/components/ui/form-field';
import { Slider } from '@/components/ui/slider';
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
  LEVERAGE_MAX,
  LEVERAGE_MIN,
  TIMEFRAMES,
  STAKE_CURRENCIES,
  PAIR_SUGGESTIONS,
} from '@/lib/constants';
import { strings } from '@/i18n/en';
import type { TradingMode, MarginMode } from '@/types/builder.types';

const HELP = strings.helpText.botConfig;

function clampLeverage(value: number | null) {
  const next = value ?? LEVERAGE_MIN;
  return Math.max(LEVERAGE_MIN, Math.min(LEVERAGE_MAX, Math.round(next)));
}

export function BotConfigSetup() {
  const config = useBuilderStore((s) => s.botConfig);
  const patch = useBuilderStore((s) => s.patchBotConfig);
  const botName = useBuilderStore((s) => s.botName);
  const setBotName = useBuilderStore((s) => s.setBotName);
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
      {/* Bot name is the first thing users name — same store value as
       *  the header inline-edit affordance, just surfaced as a proper
       *  form field. */}
      <FormField label="Bot name" required help={HELP.botName}>
        <Input
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          placeholder="My RSI Bot"
        />
      </FormField>

      {/* Pair + Timeframe sit on one row to compress the form. */}
      <div className="grid grid-cols-2 gap-4">
        <div data-cy-anchor="bot-config:pair">
          <FormField label="Pair" required help={HELP.pair}>
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

        <FormField label="Timeframe" required help={HELP.timeframe}>
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
      </div>

      <FormField label="Trading mode" required help={HELP.tradingMode}>
        <ToggleGroup<TradingMode>
          value={config.tradingMode}
          onChange={handleTradingMode}
          fullWidth
          ariaLabel="Trading mode"
          options={[
            { value: 'dry-run', label: 'Dry-run' },
            { value: 'live', label: 'Live trade', tone: 'bearish' },
          ]}
        />
      </FormField>

      <div data-cy-anchor="bot-config:leverage">
        <FormField label="Leverage" help={HELP.leverage}>
          <div className="flex items-center gap-3">
            <Slider
              className="min-w-0 flex-1"
              value={config.leverage}
              onValueChange={(v) => patch({ leverage: clampLeverage(v) })}
              min={LEVERAGE_MIN}
              max={LEVERAGE_MAX}
              step={1}
              ariaLabel="Leverage"
              showValue={false}
            />
            <NumberInput
              value={config.leverage}
              onValueChange={(v) => patch({ leverage: clampLeverage(v) })}
              min={LEVERAGE_MIN}
              max={LEVERAGE_MAX}
              step={1}
              suffix="x"
              aria-label="Leverage value"
              className="w-20 pr-8 text-right"
            />
          </div>
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

/**
 * Read-only chip used for the locked Exchange and Market type fields.
 * Mirrors the visual weight of an Input/Select so the form doesn't look
 * lopsided next to editable fields above and below.
 */
function LockedChip({ value }: { value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-canvas/40 px-4 py-2 text-sm text-fg">
      {value}
    </div>
  );
}

export function BotConfigConfigure() {
  const config = useBuilderStore((s) => s.botConfig);
  const patch = useBuilderStore((s) => s.patchBotConfig);

  // Silent migration: any persisted state from before the lock that
  // still has a non-Hyperliquid exchange or spot market type gets
  // coerced once on mount. JSON imports and external state landing
  // here also get normalized so the chips don't lie.
  useEffect(() => {
    const updates: Partial<typeof config> = {};
    if (config.exchange !== 'hyperliquid') updates.exchange = 'hyperliquid';
    if (config.marketType !== 'futures') updates.marketType = 'futures';
    if (Object.keys(updates).length > 0) {
      patch(updates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Exchange + Market type are both locked — render as read-only
       *  chips on a 2-column row. */}
      <div className="grid grid-cols-2 gap-4">
        <div data-cy-anchor="bot-config:exchange">
          <FormField label="Exchange" required help={HELP.exchange}>
            <LockedChip value="Hyperliquid" />
          </FormField>
        </div>
        <FormField label="Market type" required help={HELP.marketType}>
          <LockedChip value="Futures" />
        </FormField>
      </div>

      <FormField label="Margin mode" required help={HELP.marginMode}>
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

      {/* Max open + Stake currency + Stake amount on one 3-col row. */}
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Max open trades" help={HELP.maxOpenTrades}>
          <NumberInput
            value={config.maxOpenTrades}
            onValueChange={(v) => patch({ maxOpenTrades: v ?? -1 })}
            min={-1}
            step={1}
          />
        </FormField>
        <FormField label="Stake currency" help={HELP.stakeCurrency}>
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
        <FormField label="Stake amount" help={HELP.stakeAmount}>
          <NumberInput
            value={config.stakeAmount}
            onValueChange={(v) => patch({ stakeAmount: Math.max(0, v ?? 0) })}
            min={0}
            step={1}
            suffix={config.stakeCurrency}
          />
        </FormField>
      </div>

      {/* Dry-run wallet appears on its own row only while in dry-run
       *  mode. Hidden in Live mode. */}
      {config.tradingMode === 'dry-run' ? (
        <FormField label="Dry-run wallet" help={HELP.dryRunWallet}>
          <NumberInput
            value={config.dryRunWallet}
            onValueChange={(v) => patch({ dryRunWallet: Math.max(0, v ?? 0) })}
            min={0}
            step={100}
            suffix={config.stakeCurrency}
          />
        </FormField>
      ) : null}
    </>
  );
}
