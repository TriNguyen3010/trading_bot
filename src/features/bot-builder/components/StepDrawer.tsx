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
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { isStepSetupComplete } from '@/lib/validator';
import { cn } from '@/lib/utils';
import { strings } from '@/i18n/en';
import { DrawerResizeHandle } from './DrawerResizeHandle';
import { DrawerProgressIndicator } from './DrawerProgressIndicator';
import { CypheusPinnedFooter } from './CypheusPinnedFooter';
import { CypheusSummaryView } from './CypheusSummaryView';
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
  /** Called when the summary view requests dismiss (Close or auto-close). */
  onSummaryDismiss: () => void;
  /** Called when the summary view's Review JSON button is clicked. */
  onSummaryReviewJson: () => void;
}

const TOTAL_STEPS = 4;

/**
 * Single shared drawer. Visibility and content are derived from two stores:
 * - In `manual` mode the drawer is driven by `builder.openStep`.
 * - In `cypheus-pinned` / `cypheus-summary` mode it is driven by
 *   `cypheus.cypheusActiveStepId` so it stays mounted across step changes.
 *
 * Wizard rules apply only to manual mode:
 * 1. Setup is the gate. Configure tab locked until setup passes.
 * 2. Footer buttons follow a 4-phase sequence (see DrawerFooter below).
 * 3. If user breaks Setup after passing, Configure auto-relocks.
 */
export function StepDrawer({
  contentByStep,
  onManualClose,
  onManualSave,
  onManualSaveAndNext,
  hasNext,
  onSummaryDismiss,
  onSummaryReviewJson,
}: StepDrawerProps) {
  const openStep = useBuilderStore((s) => s.openStep);
  const drawerTab = useBuilderStore((s) => s.drawerTab);
  const setDrawerTab = useBuilderStore((s) => s.setDrawerTab);
  const drawerWidth = useBuilderStore((s) => s.drawerWidth);
  const setDrawerWidth = useBuilderStore((s) => s.setDrawerWidth);
  const builderState = useBuilderStore();

  const drawerMode = useCypheusStore((s) => s.drawerMode);
  const cypheusActiveStepId = useCypheusStore((s) => s.cypheusActiveStepId);

  const effectiveMode =
    drawerMode === 'closed'
      ? openStep
        ? 'manual'
        : 'closed'
      : drawerMode;

  const activeStepId: StepId | null =
    effectiveMode === 'cypheus-pinned' || effectiveMode === 'cypheus-summary'
      ? cypheusActiveStepId
      : openStep;

  const isOpen = effectiveMode !== 'closed' && activeStepId !== null;
  const isPinned =
    effectiveMode === 'cypheus-pinned' || effectiveMode === 'cypheus-summary';
  const isManual = effectiveMode === 'manual';

  const content = useMemo(() => {
    if (!activeStepId) return null;
    return contentByStep[activeStepId];
  }, [activeStepId, contentByStep]);

  const indexOfActive = content?.index ?? 1;

  // Wizard state — only meaningful in manual mode but cheap to compute always.
  const setupComplete = useMemo(
    () => (activeStepId ? isStepSetupComplete(activeStepId, builderState) : false),
    [activeStepId, builderState],
  );

  // One-shot highlight ring on the Configure dot when setup just unlocked.
  const prevSetupCompleteRef = useRef(setupComplete);
  const [justUnlocked, setJustUnlocked] = useState(false);
  useEffect(() => {
    if (
      isManual &&
      setupComplete &&
      !prevSetupCompleteRef.current &&
      drawerTab === 'setup'
    ) {
      setJustUnlocked(true);
      const t = window.setTimeout(() => setJustUnlocked(false), 700);
      return () => window.clearTimeout(t);
    }
    prevSetupCompleteRef.current = setupComplete;
  }, [setupComplete, isManual, drawerTab]);

  // Auto-relock: if user broke setup while on configure tab, switch back.
  useEffect(() => {
    if (isManual && !setupComplete && drawerTab === 'configure') {
      setDrawerTab('setup');
    }
  }, [isManual, setupComplete, drawerTab, setDrawerTab]);

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (isPinned) return;
    onManualClose();
  };

  const handleTabChange = (next: string) => {
    if (isPinned) return;
    if (next === 'configure' && !setupComplete) {
      toast.error(strings.drawer.toasts.configureLocked);
      return;
    }
    setDrawerTab(next as DrawerTab);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange} modal={false}>
      <SheetContent
        hideOverlay
        hideCloseButton
        width={drawerWidth}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (isPinned) e.preventDefault();
        }}
        overlayClassName="left-[var(--layout-left-panel)]"
      >
        <DrawerResizeHandle currentWidth={drawerWidth} onResize={setDrawerWidth} />

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
                    {effectiveMode === 'cypheus-summary'
                      ? strings.cypheus.magicBuild.summary.title
                      : isManual && content
                        ? `${strings.drawer.stepLabel(content.index)}: ${content.title}`
                        : (content?.title ?? '')}
                  </SheetTitle>
                  {effectiveMode !== 'cypheus-summary' && (
                    <SheetDescription>
                      {content?.description ?? ''}
                      {isPinned && (
                        <span className="ml-2 text-fg-muted">
                          ·{' '}
                          {strings.cypheus.magicBuild.progressLabel(
                            indexOfActive,
                            TOTAL_STEPS,
                          )}
                        </span>
                      )}
                    </SheetDescription>
                  )}
                  {isManual && content && (
                    <DrawerProgressIndicator
                      activeTab={drawerTab}
                      setupComplete={setupComplete}
                      justUnlocked={justUnlocked}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            <CloseButton
              disabled={isPinned}
              onClick={() => handleOpenChange(false)}
            />
          </div>
        </SheetHeader>

        {effectiveMode === 'cypheus-summary' ? (
          <CypheusSummaryView
            onDismiss={onSummaryDismiss}
            onReviewJson={onSummaryReviewJson}
          />
        ) : (
          <>
            <Tabs
              value={drawerTab}
              onValueChange={handleTabChange}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="px-6 pt-4">
                <TabsList>
                  <TabsTrigger value="setup" disabled={isPinned}>
                    {strings.drawer.setupTab}
                  </TabsTrigger>
                  <ConfigureTabTrigger
                    locked={isManual && !setupComplete}
                    pinned={isPinned}
                  />
                </TabsList>
              </div>
              <SheetBody>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeStepId}-${drawerTab}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {drawerTab === 'setup' ? (
                      <TabsContent value="setup" forceMount className="space-y-5">
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
            </Tabs>

            {effectiveMode === 'cypheus-pinned' ? (
              <CypheusPinnedFooter />
            ) : (
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
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  Configure tab trigger — keeps Radix-disabled UX intact for pinned mode    */
/*  but uses a "soft lock" in manual mode (clickable but onValueChange        */
/*  intercepts and shows a toast).                                            */
/* -------------------------------------------------------------------------- */
function ConfigureTabTrigger({
  locked,
  pinned,
}: {
  locked: boolean;
  pinned: boolean;
}) {
  const trigger = (
    <TabsTrigger
      value="configure"
      disabled={pinned}
      aria-disabled={locked || pinned}
      className={cn(locked && 'cursor-not-allowed opacity-70')}
    >
      <span className="inline-flex items-center gap-1.5">
        {strings.drawer.configureTab}
        {locked ? <Lock className="h-3 w-3" /> : null}
      </span>
    </TabsTrigger>
  );
  if (!locked || pinned) return trigger;
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
/*  Close button — disabled & tooltip when Cypheus pinned                      */
/* -------------------------------------------------------------------------- */
function CloseButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  if (!disabled) {
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
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled
            aria-label="Close disabled while Cypheus is configuring"
            className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-fg-muted opacity-40"
          >
            ×
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          {strings.cypheus.magicBuild.closeDisabledTooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
