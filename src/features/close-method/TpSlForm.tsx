import { Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { NumberInput } from '@/components/ui/number-input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import type { TpLevel } from '@/types/builder.types';

export function TpSlForm() {
  const close = useBuilderStore((s) => s.closeMethod);
  const patch = useBuilderStore((s) => s.patchCloseMethod);

  const totalClose = close.tpLevels.reduce(
    (sum, l) => sum + (l.amount || 0),
    0,
  );
  const overflow = totalClose > 100;

  const updateLevel = (idx: number, p: Partial<TpLevel>) => {
    patch({
      tpLevels: close.tpLevels.map((l, i) => (i === idx ? { ...l, ...p } : l)),
    });
  };
  const addLevel = () => {
    const nextProfit =
      close.tpLevels.length === 0
        ? 5
        : (close.tpLevels.at(-1)!.profit ?? 5) + 5;
    patch({
      tpLevels: [...close.tpLevels, { profit: nextProfit, amount: 50 }],
    });
  };
  const removeLevel = (idx: number) => {
    patch({ tpLevels: close.tpLevels.filter((_, i) => i !== idx) });
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-canvas/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-fg">Take profit</p>
          <Switch
            checked={close.tpEnabled}
            onCheckedChange={(v) => patch({ tpEnabled: v })}
            aria-label="Enable take profit"
          />
        </div>

        {close.tpEnabled ? (
          <div className="flex flex-col gap-2">
            {close.tpLevels.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-canvas/40 p-3 text-center text-xs text-fg-muted">
                No levels yet. Add one to start banking profit.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {close.tpLevels.map((lvl, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2"
                  >
                    <span className="w-14 text-xs uppercase tracking-wide text-fg-muted">
                      L{idx + 1}
                    </span>
                    <FormField label="Profit" className="flex-1">
                      <NumberInput
                        value={lvl.profit}
                        onValueChange={(v) =>
                          updateLevel(idx, { profit: v ?? 0 })
                        }
                        step={0.5}
                        suffix="%"
                      />
                    </FormField>
                    <FormField label="Close" className="flex-1">
                      <NumberInput
                        value={lvl.amount}
                        onValueChange={(v) =>
                          updateLevel(idx, {
                            amount: Math.max(0, Math.min(100, v ?? 0)),
                          })
                        }
                        min={0}
                        max={100}
                        step={5}
                        suffix="%"
                      />
                    </FormField>
                    <button
                      type="button"
                      onClick={() => removeLevel(idx)}
                      aria-label={`Remove level ${idx + 1}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bearish/10 hover:text-bearish"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={addLevel}>
              <Plus className="h-3.5 w-3.5" />
              Add level
            </Button>
            {overflow ? (
              <p className="text-xs text-warning">
                Total close % is {totalClose}% (over 100%) — only 100% can be
                closed.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-fg-muted">
            Take profit disabled — bot will hold until SL or indicator exit.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-canvas/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-fg">Stop loss</p>
          <Switch
            checked={close.slEnabled}
            onCheckedChange={(v) => patch({ slEnabled: v })}
            aria-label="Enable stop loss"
          />
        </div>
        {close.slEnabled ? (
          <FormField label="Stop loss">
            <NumberInput
              value={close.slValue}
              onValueChange={(v) => patch({ slValue: v ?? 0 })}
              step={0.5}
              max={0}
              suffix="%"
            />
          </FormField>
        ) : (
          <p className="rounded-md border border-dashed border-border bg-bearish-subtle p-3 text-xs text-bearish">
            ⚠ No stop loss — risk of unbounded loss in adverse moves.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-border bg-canvas/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-fg">Trailing stop</p>
          <Switch
            checked={close.trailingEnabled}
            onCheckedChange={(v) => patch({ trailingEnabled: v })}
            aria-label="Enable trailing stop"
          />
        </div>
        {close.trailingEnabled ? (
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Activate at">
              <NumberInput
                value={close.trailingPositive}
                onValueChange={(v) => patch({ trailingPositive: v ?? 0 })}
                step={0.1}
                suffix="%"
              />
            </FormField>
            <FormField label="Offset">
              <NumberInput
                value={close.trailingOffset}
                onValueChange={(v) => patch({ trailingOffset: v ?? 0 })}
                step={0.1}
                suffix="%"
              />
            </FormField>
          </div>
        ) : null}
      </section>
    </div>
  );
}
