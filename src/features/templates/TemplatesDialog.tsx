import { useMemo, useState, type MouseEvent } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  applyTemplate,
  BUILT_IN_TEMPLATES,
  TemplateConflictError,
  type BotTemplate,
} from '@/templates';
import { strings } from '@/i18n/en';
import { useTemplatesDialogStore } from './templates-dialog.store';
import { TemplateCard } from './TemplateCard';
import { FilterChips } from './FilterChips';
import { applyTemplateFilter, type TemplateFilter } from './filter';
import { ConfirmReplaceDialog } from './ConfirmReplaceDialog';
import { TemplateDetailModal } from './TemplateDetailModal';

/**
 * The bot-templates gallery — main entry point for picking a starter
 * template. Mounted once at the page level (BuilderPage) and toggled via
 * the shared `useTemplatesDialogStore`.
 *
 * Apply flow:
 *   1. User clicks "Use" on a card.
 *   2. We close the gallery first.
 *   3. Call `applyTemplate(template)` — snap-applies state instantly.
 *   4. If state is dirty, `applyTemplate` throws TemplateConflictError —
 *      we open the ConfirmReplaceDialog with the pending template.
 *   5. On confirm, re-call `applyTemplate(t, { force: true })`.
 */
export function TemplatesDialog() {
  const open = useTemplatesDialogStore((s) => s.open);
  const setOpen = useTemplatesDialogStore((s) => s.setOpen);
  const openDetail = useTemplatesDialogStore((s) => s.openDetail);
  const [filter, setFilter] = useState<TemplateFilter>({});
  const [pendingReplace, setPendingReplace] = useState<{
    template: BotTemplate;
  } | null>(null);

  const visible = useMemo(
    () => applyTemplateFilter(BUILT_IN_TEMPLATES, filter),
    [filter],
  );

  const handleUse = async (
    template: BotTemplate,
    _event: MouseEvent<HTMLButtonElement>,
  ) => {
    setOpen(false);
    try {
      await applyTemplate(template);
    } catch (err) {
      if (err instanceof TemplateConflictError) {
        setPendingReplace({ template });
        return;
      }
      throw err;
    }
  };

  const handleConfirmReplace = async () => {
    if (!pendingReplace) return;
    const { template } = pendingReplace;
    setPendingReplace(null);
    await applyTemplate(template, { force: true });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle>{strings.templates.gallery.title}</DialogTitle>
            <DialogDescription>
              {strings.templates.gallery.description}
            </DialogDescription>
          </DialogHeader>

          <FilterChips filter={filter} onChange={setFilter} />

          {visible.length === 0 ? (
            <div className="py-8 text-center text-sm text-fg-muted">
              {strings.templates.gallery.empty}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {visible.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onUse={handleUse}
                  onPreview={(template) => {
                    // Close the gallery first so the detail modal owns
                    // the focus stack — running both at once stacks two
                    // Radix portals and steals scroll lock.
                    setOpen(false);
                    openDetail(template.id);
                  }}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail-modal preview + ConfirmReplaceDialog share the same
       * `handleUse` callback so both entry points hit the same dirty-state
       * confirm logic. */}
      <TemplateDetailModal onUse={handleUse} />

      <ConfirmReplaceDialog
        template={pendingReplace?.template ?? null}
        onConfirm={handleConfirmReplace}
        onCancel={() => setPendingReplace(null)}
      />
    </>
  );
}
