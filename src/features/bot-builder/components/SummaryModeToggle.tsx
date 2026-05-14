import { AlignLeft, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { strings } from '@/i18n/en';
import { cn } from '@/lib/utils';

/**
 * Visual ↔ narrative summary-mode toggle.
 *
 * Rendered as an icon-only control so it can sit close to the configured
 * phase checkmark without adding text noise to the canvas.
 */
export interface SummaryModeToggleProps {
  className?: string;
  buttonClassName?: string;
}

export function SummaryModeToggle({
  className,
  buttonClassName,
}: SummaryModeToggleProps) {
  const summaryMode = useLayoutPrefsStore((s) => s.summaryMode);
  const toggleSummaryMode = useLayoutPrefsStore((s) => s.toggleSummaryMode);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('mt-2 flex justify-end', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSummaryMode}
              className={cn('rounded-full', buttonClassName)}
              aria-label={
                summaryMode === 'visual'
                  ? strings.layoutToggles.summaryModeVisualAria
                  : strings.layoutToggles.summaryModeNarrativeAria
              }
              aria-pressed={summaryMode === 'narrative'}
            >
              {summaryMode === 'visual' ? (
                <Layers className="h-3.5 w-3.5" />
              ) : (
                <AlignLeft className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {summaryMode === 'visual'
              ? strings.layoutToggles.summaryModeVisualTooltip
              : strings.layoutToggles.summaryModeNarrativeTooltip}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
