import { useBuilderStore } from '../store/builder.store';
import { FormField } from '@/components/ui/form-field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TpSlForm } from '@/features/close-method/TpSlForm';
import { RoiStepsForm } from '@/features/close-method/RoiStepsForm';
import { IndicatorExitForm } from '@/features/close-method/IndicatorExitForm';
import type { CloseMethodType } from '@/types/builder.types';

const METHODS: { value: CloseMethodType; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'tp_sl', label: 'TP / SL' },
  { value: 'indicator', label: 'Indicator' },
  { value: 'roi', label: 'ROI table' },
];

/**
 * Close-method picker + configuration in a single tabbed component.
 * Underline-style tabs (text + yellow bottom border on the active one)
 * drive the form panel below. Matches the demo's Option A — minimal
 * editorial feel.
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
        <TabsList className="grid w-full grid-cols-4 gap-0">
          {METHODS.map((m) => (
            <TabsTrigger
              key={m.value}
              value={m.value}
              className="justify-center"
            >
              {m.label}
            </TabsTrigger>
          ))}
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
