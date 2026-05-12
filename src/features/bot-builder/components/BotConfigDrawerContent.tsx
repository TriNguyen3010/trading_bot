import { useRef } from 'react';
import { SheetBody, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BotConfigSetup,
  BotConfigConfigure,
} from '@/features/bot-builder/steps/BotConfigStep';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { isStepSetupComplete } from '@/lib/validator';
import { strings } from '@/i18n/en';
import { DrawerProgressGlow } from './DrawerProgressGlow';

export interface BotConfigDrawerContentProps {
  onCancel: () => void;
  onSave: () => void;
}

/**
 * Composite drawer body for the "Bot Basics" phase. Replaces the legacy
 * Setup/Configure tabs with a single scrolling form so users see every
 * field at once — same pattern Phase 2 (Strategy) already uses.
 *
 * The body is just the existing `BotConfigSetup` + `BotConfigConfigure`
 * stacked. We deliberately don't refactor those two — they're cohesive
 * and reusable; merging them would just duplicate field markup.
 *
 * Save gate uses `isStepSetupComplete('bot-config')` (pair / timeframe /
 * leverage required). The Configure-only fields all carry sensible
 * defaults so they don't need to be validated here — `validateBuilder`
 * catches the rest at export time.
 */
export function BotConfigDrawerContent({
  onCancel,
  onSave,
}: BotConfigDrawerContentProps) {
  const state = useBuilderStore();
  const setupComplete = isStepSetupComplete('bot-config', state);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <SheetBody ref={scrollRef} className="drawer-no-scrollbar">
        <div className="space-y-5">
          <BotConfigSetup />
          <BotConfigConfigure />
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
                {strings.drawer.tooltips.continueDisabled}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SheetFooter>
    </>
  );
}
