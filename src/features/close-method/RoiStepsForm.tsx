import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberInput } from '@/components/ui/number-input';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import type { RoiStep } from '@/types/builder.types';

export function RoiStepsForm() {
  const close = useBuilderStore((s) => s.closeMethod);
  const patch = useBuilderStore((s) => s.patchCloseMethod);

  const update = (idx: number, p: Partial<RoiStep>) => {
    patch({
      roiSteps: close.roiSteps.map((s, i) => (i === idx ? { ...s, ...p } : s)),
    });
  };
  const add = () => {
    const last = close.roiSteps.at(-1);
    patch({
      roiSteps: [
        ...close.roiSteps,
        {
          minutes: last ? last.minutes + 30 : 0,
          roi: last ? Math.max(0, last.roi - 0.5) : 1.5,
        },
      ],
    });
  };
  const remove = (idx: number) => {
    patch({ roiSteps: close.roiSteps.filter((_, i) => i !== idx) });
  };

  return (
    <div className="rounded-xl border border-border bg-canvas/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-fg">ROI table</p>
          <p className="text-xs text-fg-muted">
            After {`{minutes}`} minutes, exit if profit ≥ {`{roi}`}%.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Add step
        </Button>
      </div>

      {close.roiSteps.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-canvas/40 p-3 text-center text-xs text-fg-muted">
          No ROI steps yet. Add one to enable time-based exit.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle">
          <table className="w-full text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-fg-muted">
              <tr>
                <th className="px-3 py-2 text-left">After</th>
                <th className="px-3 py-2 text-left">Exit if profit ≥</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {close.roiSteps.map((step, idx) => (
                <tr
                  key={idx}
                  className="border-t border-border-subtle bg-surface/40"
                >
                  <td className="px-3 py-2">
                    <NumberInput
                      value={step.minutes}
                      onValueChange={(v) =>
                        update(idx, { minutes: Math.max(0, v ?? 0) })
                      }
                      min={0}
                      step={5}
                      suffix="min"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <NumberInput
                      value={step.roi}
                      onValueChange={(v) => update(idx, { roi: v ?? 0 })}
                      step={0.1}
                      suffix="%"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      aria-label={`Remove ROI step ${idx + 1}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bearish/10 hover:text-bearish"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
