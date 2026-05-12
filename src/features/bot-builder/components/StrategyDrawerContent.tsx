import { useRef } from 'react';
import { SheetBody, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { EntryStrategySetup } from '@/features/bot-builder/steps/EntryStrategyStep';
import { DirectionSetup } from '@/features/bot-builder/steps/DirectionStep';
import {
  CloseMethodSetup,
  CloseMethodConfigure,
} from '@/features/bot-builder/steps/CloseMethodStep';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { isPhaseSetupComplete } from '@/lib/phase-helpers';
import { strings } from '@/i18n/en';
import { StrategySection } from './StrategySection';
import { DrawerProgressGlow } from './DrawerProgressGlow';

export interface StrategyDrawerContentProps {
  onCancel: () => void;
  onSave: () => void;
}

/**
 * Composite drawer body for the "Strategy" phase. Renders two accordion
 * sections (Entry / Action) — see design spec
 * docs/superpowers/specs/2026-05-12-remove-strategy-advanced-section-design.md.
 *
 * Save calls `onSave` only when the strategy phase setup gate passes
 * (entry-strategy + direction + close-method all setup-complete). The
 * caller (BotBuilderCanvas) is responsible for marking all 3 sub-stepStatus
 * fields as 'configured' in a single batch.
 */
export function StrategyDrawerContent({
  onCancel,
  onSave,
}: StrategyDrawerContentProps) {
  // Read full state so the setup gate re-derives whenever any strategy
  // sub-form patches.
  const state = useBuilderStore();
  const setupComplete = isPhaseSetupComplete(state, 'strategy');
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <SheetBody ref={scrollRef} className="drawer-no-scrollbar">
        <div className="space-y-0">
          {/* `data-cy-anchor` lets the Cypheus animation engine scroll
           *  the drawer body to whichever phase is currently being
           *  filled. See `components/drawer-scroll.ts`. */}
          <div data-cy-anchor="strategy:entry">
            <StrategySection
              title={strings.strategyDrawer.sections.entry}
              defaultOpen
            >
              <EntryStrategySetup />
            </StrategySection>
          </div>

          <div data-cy-anchor="strategy:action">
            <StrategySection
              title={strings.strategyDrawer.sections.action}
              defaultOpen
            >
              <DirectionSetup />
              <CloseMethodSetup />
              <CloseMethodConfigure />
            </StrategySection>
          </div>
        </div>
      </SheetBody>
      <DrawerProgressGlow scrollRef={scrollRef} />

      <SheetFooter>
        <Button variant="ghost" onClick={onCancel}>
          {strings.drawer.cancel}
        </Button>
        {setupComplete ? (
          <Button variant="primary" onClick={onSave}>
            {strings.drawer.save}
          </Button>
        ) : (
          // Disabled Save needs a wrapper for the tooltip to receive pointer
          // events; <Button disabled> swallows them.
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="primary" disabled>
                    {strings.drawer.save}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {strings.strategyDrawer.saveDisabledTooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SheetFooter>
    </>
  );
}
