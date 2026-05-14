import { useEffect, useMemo, useRef } from 'react';
import { useBuilderStore } from '../store/builder.store';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { FormField } from '@/components/ui/form-field';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TpSlForm } from '@/features/close-method/TpSlForm';
import { RoiStepsForm } from '@/features/close-method/RoiStepsForm';
import { IndicatorExitForm } from '@/features/close-method/IndicatorExitForm';
import { strings } from '@/i18n/en';
import type { CloseMethodType } from '@/types/builder.types';

interface MethodSpec {
  value: CloseMethodType;
  label: string;
  /** Advanced-only methods are hidden until the user enables Advanced. */
  advanced?: boolean;
}

/** Order: increasing complexity — Manual is the "do nothing" baseline,
 * TP/SL is the most common automated exit, ROI adds a time dimension,
 * Indicator is the most flexible / advanced and therefore last. */
const METHODS: MethodSpec[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'tp_sl', label: 'TP / SL' },
  { value: 'roi', label: 'ROI table' },
  { value: 'indicator', label: 'Indicator', advanced: true },
];

/**
 * Close-method picker + configuration in a single tabbed component.
 * Underline-style tabs (text + yellow bottom border on the active one)
 * drive the form panel below.
 *
 * Indicator tab sits behind an Advanced switch (inline with the field
 * label) so the default picker shows only the 3 simpler options. When
 * the user toggles Advanced off while sitting on the Indicator tab we
 * silently fall back to Manual so the form never points at a hidden
 * tab — the indicator config itself is preserved so flipping Advanced
 * back on restores everything.
 */
export function CloseMethodSetup() {
  const close = useBuilderStore((s) => s.closeMethod);
  const patch = useBuilderStore((s) => s.patchCloseMethod);
  const showAdvanced = useLayoutPrefsStore((s) => s.showAdvancedClose);
  const setShowAdvanced = useLayoutPrefsStore((s) => s.setShowAdvancedClose);

  // Each tab's form has a very different height (Manual=0, TP-SL≈500px,
  // Indicator≈400px, ROI≈300px). Without intervention, the drawer's
  // scroll position lingers wherever the previous tab left it — so a
  // user switching from TP-SL (long) to Manual (empty) sees the picker
  // header pushed off-screen, while Manual→Indicator buries new fields
  // below the fold. We anchor by scrolling the picker wrapper back to
  // the top of the drawer right after the new tab content mounts.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const handleTabChange = (next: string) => {
    patch({ type: next as CloseMethodType });
    // `requestAnimationFrame` gives Radix one paint to swap the
    // TabsContent before we measure. Without it the scroll lands on
    // the old content's box.
    requestAnimationFrame(() => {
      wrapperRef.current?.scrollIntoView({ block: 'start' });
    });
  };

  // If the persisted state had `type: 'indicator'` (legacy session
  // pre-dating the Advanced gate) auto-flip the toggle on so the user
  // doesn't see their tab vanish. One-shot, runs only when needed.
  useEffect(() => {
    if (close.type === 'indicator' && !showAdvanced) {
      setShowAdvanced(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force-fallback when Advanced is turned off while on Indicator. We
  // route back to Manual (least-destructive) rather than TP/SL so the
  // user clearly notices the change instead of silently inheriting a
  // half-configured ladder.
  useEffect(() => {
    if (!showAdvanced && close.type === 'indicator') {
      patch({ type: 'manual' });
    }
  }, [showAdvanced, close.type, patch]);

  const visibleMethods = useMemo(
    () => METHODS.filter((m) => !m.advanced || showAdvanced),
    [showAdvanced],
  );

  return (
    <div ref={wrapperRef}>
      <FormField
        label="Close method"
        required
        help={strings.helpText.strategy.closeMethod}
        trailing={
          <div className="inline-flex items-center gap-2">
            <span className="text-2xs font-medium uppercase tracking-wider text-fg-muted">
              {strings.closeMethod.advancedLabel}
            </span>
            <Switch
              checked={showAdvanced}
              onCheckedChange={setShowAdvanced}
              aria-label={strings.closeMethod.advancedTooltip}
            />
          </div>
        }
      >
        <Tabs
          value={close.type}
          onValueChange={handleTabChange}
          className="flex flex-col gap-4"
        >
        <TabsList
          className="grid w-full gap-0"
          style={{
            gridTemplateColumns: `repeat(${visibleMethods.length}, minmax(0, 1fr))`,
          }}
        >
          {visibleMethods.map((m) => (
            <TabsTrigger
              key={m.value}
              value={m.value}
              className="relative justify-center"
            >
              {m.label}
              {m.advanced ? (
                <span
                  aria-hidden
                  className="ml-1.5 inline-flex items-center rounded-full bg-brand px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-fg-inverse"
                >
                  {strings.closeMethod.newBadge}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* The Manual panel renders nothing — no configuration needed. */}
        <TabsContent value="manual" />
        <TabsContent value="tp_sl">
          <TpSlForm />
        </TabsContent>
        <TabsContent value="roi">
          <RoiStepsForm />
        </TabsContent>
        {/* Indicator content stays mounted only when Advanced is on, so
            its useState/store wiring doesn't drift while hidden. */}
        {showAdvanced ? (
          <TabsContent value="indicator">
            <IndicatorExitForm />
          </TabsContent>
        ) : null}
        </Tabs>
      </FormField>
    </div>
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
