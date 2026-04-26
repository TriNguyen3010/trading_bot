import { useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { strings } from '@/i18n/en';
import { DrawerResizeHandle } from './DrawerResizeHandle';
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
  /** Called when manual mode user clicks Save. */
  onManualSave: () => void;
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

  const content = useMemo(() => {
    if (!activeStepId) return null;
    return contentByStep[activeStepId];
  }, [activeStepId, contentByStep]);

  const indexOfActive = content?.index ?? 1;

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (isPinned) return;
    onManualClose();
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
            <div className="min-w-0">
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
              onValueChange={(v) => setDrawerTab(v as DrawerTab)}
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="px-6 pt-4">
                <TabsList>
                  <TabsTrigger value="setup" disabled={isPinned}>
                    {strings.drawer.setupTab}
                  </TabsTrigger>
                  <TabsTrigger value="configure" disabled={isPinned}>
                    {strings.drawer.configureTab}
                  </TabsTrigger>
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
                <Button variant="ghost" onClick={onManualClose}>
                  {strings.drawer.cancel}
                </Button>
                <Button variant="secondary" onClick={onManualSave}>
                  {strings.drawer.save}
                </Button>
                {hasNext ? (
                  <Button variant="primary" onClick={onManualSaveAndNext}>
                    {strings.drawer.saveAndNext}
                  </Button>
                ) : null}
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

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
