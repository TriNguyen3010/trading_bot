import { Hand, Target, LineChart, Clock } from 'lucide-react';
import { useBuilderStore } from '../store/builder.store';
import { FormField } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import { TpSlForm } from '@/features/close-method/TpSlForm';
import { RoiStepsForm } from '@/features/close-method/RoiStepsForm';
import { IndicatorExitForm } from '@/features/close-method/IndicatorExitForm';
import type { CloseMethodType } from '@/types/builder.types';

const METHODS: {
  value: CloseMethodType;
  label: string;
  icon: typeof Hand;
}[] = [
  { value: 'manual', label: 'Manual', icon: Hand },
  { value: 'tp_sl', label: 'TP / SL', icon: Target },
  { value: 'indicator', label: 'Indicator', icon: LineChart },
  { value: 'roi', label: 'ROI table', icon: Clock },
];

export function CloseMethodSetup() {
  const close = useBuilderStore((s) => s.closeMethod);
  const patch = useBuilderStore((s) => s.patchCloseMethod);

  return (
    <FormField label="Close method" required>
      <div className="grid grid-cols-2 gap-3">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = close.type === m.value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => patch({ type: m.value })}
              className={cn(
                'flex items-start gap-3 rounded-xl border bg-surface p-3 text-left transition-all duration-fast',
                'hover:border-border-strong',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                active
                  ? 'border-brand bg-brand-subtle'
                  : 'border-border',
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                  active
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-border bg-canvas text-fg-secondary',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{m.label}</p>
              </div>
            </button>
          );
        })}
      </div>
    </FormField>
  );
}

export function CloseMethodConfigure() {
  const close = useBuilderStore((s) => s.closeMethod);

  switch (close.type) {
    case 'manual':
      return null;
    case 'tp_sl':
      return <TpSlForm />;
    case 'roi':
      return <RoiStepsForm />;
    case 'indicator':
      return <IndicatorExitForm />;
  }
}
