import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FIXED_DRAWER_WIDTH,
  useBuilderStore,
} from '@/features/bot-builder/store/builder.store';
import { isStepSetupComplete } from '@/lib/validator';
import { STRATEGY_SUB_STEPS } from '@/lib/phase-helpers';
import { cn } from '@/lib/utils';
import { strings } from '@/i18n/en';
import { DrawerProgressGlow } from './DrawerProgressGlow';
import { DrawerProgressIndicator } from './DrawerProgressIndicator';
import type { DrawerTab, StepId } from '@/types/builder.types';

export interface StepContentMap {
  setup: ReactNode;
  configure: ReactNode;
  title: string;
  description: string;
  index: number;
}

export interface StepDrawerProps {
  /** Step content lookup keyed by stepId. */
  contentByStep: Record<StepId, StepContentMap>;
  /** Called when manual mode user closes the drawer. */
  onManualClose: () => void;
  /** Called when manual mode user clicks Save (or Skip & Save / Save & Finish).
   * `mode` distinguishes intent so the parent can route to next step. */
  onManualSave: (mode: 'save' | 'skip-save' | 'save-and-finish') => void;
  /** Called when manual mode user clicks Save & Next. */
  onManualSaveAndNext: () => void;
  /** Hide Save & Next when at last step. */
  hasNext: boolean;
  /** Composite body + footer rendered when the active step belongs to the
   * Strategy phase (entry/direction/close-method). When provided + active,
   * suppresses the legacy Setup/Configure tabs and the wizard footer.
   * Pass `null`/`undefined` for the legacy 4-step UI. */
  strategyCompositeContent?: ReactNode;
  /** Header copy override for the Strategy phase composite drawer. When
   * `strategyCompositeContent` is rendered we don't want "Step 2: Entry
   * Strategy" — we want "Strategy" with the phase description. */
  strategyHeader?: { title: string; description: string };
  /** Composite body + footer for the Bot Basics phase (`bot-config`). When
   * provided, replaces the legacy Setup/Configure tabs with a single
   * scrolling form — matches the Strategy phase pattern. */
  botConfigCompositeContent?: ReactNode;
  /** Header copy override for the Bot Basics composite drawer. Drops the
   * "Step 1: " prefix that was meaningful only in the wizard flow. */
  botConfigHeader?: { title: string; description: string };
}

/**
 * Single shared drawer driven by `builder.openStep`.
 *
 * Wizard rules:
 * 1. Setup is the gate. Configure tab locked until setup passes.
 * 2. Footer buttons follow a 4-phase sequence (see ManualWizardFooter below).
 * 3. If user breaks Setup after passing, Configure auto-relocks.
 */
export function StepDrawer({
  contentByStep,
  onManualClose,
  onManualSave,
  onManualSaveAndNext,
  hasNext,
  strategyCompositeContent,
  strategyHeader,
  botConfigCompositeContent,
  botConfigHeader,
}: StepDrawerProps) {
  const openStep = useBuilderStore((s) => s.openStep);
  const drawerTab = useBuilderStore((s) => s.drawerTab);
  const setDrawerTab = useBuilderStore((s) => s.setDrawerTab);
  // Drawer width is now fixed (per user request 2026-04-30). The store
  // still ships drawerWidth + setDrawerWidth for backwards-compat with
  // imported sessions, but the resize handle is removed and we render
  // at the canonical width regardless of the persisted value.
  const drawerWidth = FIXED_DRAWER_WIDTH;
  const builderState = useBuilderStore();

  const activeStepId: StepId | null = openStep;
  const isOpen = activeStepId !== null;
  const drawerContentRef = useRef<HTMLDivElement>(null);

  // Composite Strategy mode: when the active step belongs to the Strategy
  // phase (entry / direction / close-method) AND the parent has provided a
  // composite content node, suppress the legacy Setup/Configure tabs +
  // wizard footer and render the composite body instead.
  // See Spec/Phase 1/two_phase_ui_plan.md §6.4.
  const isCompositeStrategy =
    Boolean(strategyCompositeContent) &&
    activeStepId !== null &&
    STRATEGY_SUB_STEPS.includes(activeStepId);

  // Composite Bot Basics mode: same pattern as strategy composite, but
  // for Phase 1 (`bot-config`). Replaces the Setup/Configure tabs with a
  // single scrolling form. The legacy tabs path remains in the file as
  // dead code for the moment; once we're confident we won't roll back,
  // a follow-up PR can rip it out.
  const isCompositeBotConfig =
    Boolean(botConfigCompositeContent) && activeStepId === 'bot-config';

  const isComposite = isCompositeStrategy || isCompositeBotConfig;

  const content = useMemo(() => {
    if (!activeStepId) return null;
    return contentByStep[activeStepId];
  }, [activeStepId, contentByStep]);

  // Wizard state — meaningful in manual (legacy tabs) mode.
  const setupComplete = useMemo(
    () =>
      activeStepId ? isStepSetupComplete(activeStepId, builderState) : false,
    [activeStepId, builderState],
  );

  // Scroll container ref for the legacy Setup/Configure tab body — wired
  // to DrawerProgressGlow for the visual scroll indicator.
  const legacyScrollRef = useRef<HTMLDivElement>(null);

  // One-shot highlight ring on the Configure dot when setup just unlocked.
  const prevSetupCompleteRef = useRef(setupComplete);
  const [justUnlocked, setJustUnlocked] = useState(false);
  useEffect(() => {
    if (
      setupComplete &&
      !prevSetupCompleteRef.current &&
      drawerTab === 'setup'
    ) {
      setJustUnlocked(true);
      const t = window.setTimeout(() => setJustUnlocked(false), 700);
      return () => window.clearTimeout(t);
    }
    prevSetupCompleteRef.current = setupComplete;
  }, [setupComplete, drawerTab]);

  // Auto-relock: if user broke setup while on configure tab, switch back.
  useEffect(() => {
    if (!setupComplete && drawerTab === 'configure') {
      setDrawerTab('setup');
    }
  }, [setupComplete, drawerTab, setDrawerTab]);

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    onManualClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsidePress = (event: PointerEvent | MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (drawerContentRef.current?.contains(target)) return;
      onManualClose();
    };

    document.addEventListener('pointerdown', handleOutsidePress, true);
    document.addEventListener('mousedown', handleOutsidePress, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePress, true);
      document.removeEventListener('mousedown', handleOutsidePress, true);
    };
  }, [isOpen, onManualClose]);

  const handleTabChange = (next: string) => {
    if (next === 'configure' && !setupComplete) {
      toast.error(strings.drawer.toasts.configureLocked);
      return;
    }
    setDrawerTab(next as DrawerTab);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <SheetContent
        ref={drawerContentRef}
        hideOverlay
        hideCloseButton
        width={drawerWidth}
        overlayClassName="left-[var(--layout-left-panel)]"
      >
        {/* DrawerResizeHandle removed 2026-04-30 — drawer is now locked
         * at FIXED_DRAWER_WIDTH per user request. */}

        <SheetHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStepId ?? 'empty'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <SheetTitle>
                    {isCompositeStrategy && strategyHeader
                      ? strategyHeader.title
                      : isCompositeBotConfig && botConfigHeader
                        ? botConfigHeader.title
                        : content
                          ? `${strings.drawer.stepLabel(content.index)}: ${content.title}`
                          : ''}
                  </SheetTitle>
                  {/* Description kept (empty) so Radix Dialog's a11y
                      `aria-describedby` link doesn't warn. */}
                  <SheetDescription />
                  {/* Setup/Configure stepper only renders in the legacy
                      tabbed mode. Both Phase 1 (composite bot-config) and
                      Phase 2 (composite Strategy) drop it. */}
                  {content && !isComposite && (
                    <DrawerProgressIndicator
                      activeTab={drawerTab}
                      setupComplete={setupComplete}
                      justUnlocked={justUnlocked}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <CloseButton onClick={() => handleOpenChange(false)} />
          </div>
        </SheetHeader>

        {isCompositeStrategy ? (
          // Composite Strategy phase body — supplied by parent via
          // `strategyCompositeContent`. Owns its own footer.
          strategyCompositeContent
        ) : isCompositeBotConfig ? (
          // Composite Bot Basics body — supplied by parent via
          // `botConfigCompositeContent`. Owns its own footer.
          botConfigCompositeContent
        ) : (
          <>
            <Tabs
              value={drawerTab}
              onValueChange={handleTabChange}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="px-6 pt-4">
                <TabsList>
                  <TabsTrigger value="setup">
                    {strings.drawer.setupTab}
                  </TabsTrigger>
                  <ConfigureTabTrigger locked={!setupComplete} />
                </TabsList>
              </div>
              <SheetBody ref={legacyScrollRef} className="drawer-no-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeStepId}-${drawerTab}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {drawerTab === 'setup' ? (
                      <TabsContent
                        value="setup"
                        forceMount
                        className="space-y-5"
                      >
                        {content?.setup ?? null}
                      </TabsContent>
                    ) : (
                      <TabsContent
                        value="configure"
                        forceMount
                        className="space-y-5"
                      >
                        {content?.configure ?? null}
                      </TabsContent>
                    )}
                  </motion.div>
                </AnimatePresence>
              </SheetBody>
              <DrawerProgressGlow scrollRef={legacyScrollRef} />
            </Tabs>

            <SheetFooter>
              <ManualWizardFooter
                activeTab={drawerTab}
                setupComplete={setupComplete}
                hasNext={hasNext}
                onCancel={onManualClose}
                onContinue={() => setDrawerTab('configure')}
                onBack={() => setDrawerTab('setup')}
                onSkipSave={() => onManualSave('skip-save')}
                onSave={() =>
                  onManualSave(hasNext ? 'save' : 'save-and-finish')
                }
                onSaveAndNext={onManualSaveAndNext}
              />
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  Configure tab trigger — "soft lock" (clickable but onValueChange           */
/*  intercepts and shows a toast).                                             */
/* -------------------------------------------------------------------------- */
function ConfigureTabTrigger({ locked }: { locked: boolean }) {
  const trigger = (
    <TabsTrigger
      value="configure"
      aria-disabled={locked}
      className={cn(locked && 'cursor-not-allowed opacity-70')}
    >
      <span className="inline-flex items-center gap-1.5">
        {strings.drawer.configureTab}
        {locked ? <Lock className="h-3 w-3" /> : null}
      </span>
    </TabsTrigger>
  );
  if (!locked) return trigger;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          {strings.drawer.tooltips.configureLocked}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* -------------------------------------------------------------------------- */
/*  Manual-mode wizard footer — 4-phase logic                                 */
/* -------------------------------------------------------------------------- */
interface ManualWizardFooterProps {
  activeTab: DrawerTab;
  setupComplete: boolean;
  hasNext: boolean;
  onCancel: () => void;
  onContinue: () => void;
  onBack: () => void;
  onSkipSave: () => void;
  onSave: () => void;
  onSaveAndNext: () => void;
}

function ManualWizardFooter({
  activeTab,
  setupComplete,
  hasNext,
  onCancel,
  onContinue,
  onBack,
  onSkipSave,
  onSave,
  onSaveAndNext,
}: ManualWizardFooterProps) {
  // Configure tab: phases 3 & 4 (Save / Save&Next or Save&Finish)
  if (activeTab === 'configure') {
    return (
      <>
        <Button variant="ghost" onClick={onBack}>
          {strings.drawer.back}
        </Button>
        <Button variant="secondary" onClick={onSave}>
          {strings.drawer.save}
        </Button>
        {hasNext ? (
          <Button variant="primary" onClick={onSaveAndNext}>
            {strings.drawer.saveAndNext}
          </Button>
        ) : (
          <Button variant="primary" onClick={onSave}>
            {strings.drawer.saveAndFinish}
          </Button>
        )}
      </>
    );
  }

  // Setup tab, phase 2: setup is complete → can Skip & Save or Continue.
  if (setupComplete) {
    return (
      <>
        <Button variant="ghost" onClick={onCancel}>
          {strings.drawer.cancel}
        </Button>
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" onClick={onSkipSave}>
                {strings.drawer.skipSave}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {strings.drawer.tooltips.skipSave}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button variant="primary" onClick={onContinue}>
          {strings.drawer.continueLabel}
        </Button>
      </>
    );
  }

  // Setup tab, phase 1: setup incomplete → Continue disabled, no save options.
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        {strings.drawer.cancel}
      </Button>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button variant="primary" disabled>
                {strings.drawer.continueLabel}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {strings.drawer.tooltips.continueDisabled}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Close button                                                              */
/* -------------------------------------------------------------------------- */
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close drawer"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      ×
    </button>
  );
}
