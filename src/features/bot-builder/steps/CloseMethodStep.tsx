import { Hand, Target, LineChart, Clock } from 'lucide-react';
import { useBuilderStore } from '../store/builder.store';
import { FormField } from '@/components/ui/form-field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

/**
 * Close-method picker + configuration in a single tabbed component.
 * Four method cards arranged in one row (TabsList) drive the form panel
 * below (TabsContent). When `type === 'manual'` there is no form — the
 * panel is empty.
 */
export function CloseMethodSetup() {
  const close = useBuilderStore((s) => s.closeMethod);
  const patch = useBuilderStore((s) => s.patchCloseMethod);

  return (
    <FormField label="Close method" required>
      <Tabs
        value={close.type}
        onValueChange={(v) => patch({ type: v as CloseMethodType })}
        className="flex flex-col gap-4"
      >
        <TabsList className="grid w-full grid-cols-4 gap-2 border-b-0 p-0">
          {METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <TabsTrigger
                key={m.value}
                value={m.value}
                className={cn(
                  // Override the wrapper's default underline-tab styling.
                  // `after:hidden` nukes the bottom-line pseudo from the
                  // shared TabsTrigger; we replace it with a yellow card
                  // border via data-state=active.
                  'group flex h-auto items-center justify-start gap-3 rounded-xl border border-border bg-surface px-3 py-3 text-left transition-all duration-fast',
                  'hover:border-border-strong',
                  'after:hidden data-[state=active]:after:hidden',
                  'data-[state=active]:border-brand data-[state=active]:bg-brand-subtle data-[state=active]:text-fg',
                )}
              >
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                    'border-border bg-canvas text-fg-secondary',
                    'group-data-[state=active]:border-brand group-data-[state=active]:bg-brand/10 group-data-[state=active]:text-brand',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">{m.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* The Manual panel renders nothing — no configuration needed. */}
        <TabsContent value="manual" />
        <TabsContent value="tp_sl">
          <TpSlForm />
        </TabsContent>
        <TabsContent value="indicator">
          <IndicatorExitForm />
        </TabsContent>
        <TabsContent value="roi">
          <RoiStepsForm />
        </TabsContent>
      </Tabs>
    </FormField>
  );
}

/**
 * Legacy export. The close-method picker and its form are now one
 * tabbed component (`CloseMethodSetup`). This shim keeps the legacy
 * step drawer's `configure` slot working — it just renders nothing.
 */
export function CloseMethodConfigure() {
  return null;
}
