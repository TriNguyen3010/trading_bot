import { BookOpen, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  applyTemplate,
  getTemplateById,
  useTemplateTrackingStore,
} from '@/templates';
import { strings } from '@/i18n/en';
import { useTemplatesDialogStore } from './templates-dialog.store';
import { useDivergedFromTemplate } from './useDivergedFromTemplate';

/**
 * Header badge showing "Based on <template>" with an optional "Diverged
 * after edits" subtext when the user has modified the bot away from the
 * template snapshot. Click on the name re-opens the detail modal so the
 * user can re-read what the original template was about; the inline
 * "Reset" button reapplies the snapshot (skipping animation since the
 * user is presumably mid-flow and doesn't want a 6s timeout).
 *
 * Renders nothing when no template has been applied.
 */
export function AppliedTemplateBadge() {
  const appliedId = useTemplateTrackingStore((s) => s.appliedId);
  const openDetail = useTemplatesDialogStore((s) => s.openDetail);
  const { diverged, hasAppliedTemplate } = useDivergedFromTemplate();

  if (!hasAppliedTemplate || !appliedId) return null;

  const template = getTemplateById(appliedId);
  if (!template) return null;

  const handleNameClick = () => openDetail(appliedId);

  const handleReset = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Skip animation on reset — user is mid-flow and wants their bot back
    // quickly, not another 6-second Cypheus theatrical performance.
    await applyTemplate(template, { force: true, skipAnimation: true });
  };

  return (
    <TooltipProvider delayDuration={250}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-subtle px-2.5 py-1 text-2xs',
          'transition-colors duration-fast',
        )}
      >
        <BookOpen className="h-3 w-3 text-brand" aria-hidden="true" />
        <span className="text-fg-muted">{strings.templates.appliedBadge.prefix}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleNameClick}
              className="font-medium text-fg hover:text-brand focus-visible:outline-none focus-visible:underline"
            >
              {template.name}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {strings.templates.appliedBadge.viewDetails}
          </TooltipContent>
        </Tooltip>
        {diverged && (
          <>
            <span className="text-fg-muted">·</span>
            <span className="italic text-fg-muted">
              {strings.templates.appliedBadge.diverged}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label={strings.templates.appliedBadge.resetAria}
                  className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-fg-muted hover:text-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {strings.templates.appliedBadge.resetTooltip}
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </span>
    </TooltipProvider>
  );
}
