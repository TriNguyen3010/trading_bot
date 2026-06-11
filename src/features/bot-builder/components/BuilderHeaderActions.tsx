import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Rocket, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { CreateNewBotButton } from '@/features/cypheus/CreateNewBotButton';
import { ExportDialog } from '@/features/export-import/ExportDialog';
import { useExportDialogStore } from '@/features/export-import/export-dialog.store';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { validateBuilder } from '@/lib/validator';
import { strings } from '@/i18n/en';

// =============================================================================
// BuilderHeaderActions · the Builder-only action cluster, rendered into the
// shared AppHeader's actions slot (BuilderPage pushes it via HeaderActionsContext).
//
// Self-contained: subscribes the builder store, owns the Export/Import dialogs,
// and binds the Ctrl/Cmd+E (Create bot) / Ctrl/Cmd+I (Import) shortcuts. Mounts
// when the user is on /builder and unmounts (with its dialogs + listener) when
// they leave — see BuilderPage's useEffect cleanup.
// =============================================================================
export function BuilderHeaderActions() {
  const state = useBuilderStore();

  const exportOpen = useExportDialogStore((s) => s.open);
  const setExportOpen = useExportDialogStore((s) => s.setOpen);
  const [importOpen, setImportOpen] = useState(false);

  const issues = useMemo(() => validateBuilder(state), [state]);
  const canExport = issues.length === 0;

  // Ctrl/Cmd + E → Create bot, Ctrl/Cmd + I → Import.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isTyping) return;
      const key = e.key.toLowerCase();
      if (key === 'e' && canExport) {
        e.preventDefault();
        setExportOpen(true);
      } else if (key === 'i') {
        e.preventDefault();
        setImportOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canExport, setExportOpen]);

  return (
    <TooltipProvider delayDuration={300}>
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Secondary segmented group: New (reset) · Import */}
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5">
          <CreateNewBotButton
            variant="ghost"
            className="h-9 rounded-full px-3"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImportOpen(true)}
                className="h-9 rounded-full px-3"
                aria-label="Import bundle"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import a bundle JSON (Ctrl+I)</TooltipContent>
          </Tooltip>
        </div>

        {/* Primary terminal action: Create bot (opens the review/confirm dialog) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="primary"
                size="sm"
                disabled={!canExport}
                onClick={() => setExportOpen(true)}
                className="h-10 rounded-full px-4 shadow-[0_0_16px_rgba(240,185,11,0.35)]"
              >
                <Rocket className="h-3.5 w-3.5" />
                {strings.header.createBot}
                {!canExport ? (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-fg-inverse/20 px-1 text-2xs">
                    {issues.length}
                  </span>
                ) : null}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {canExport
              ? 'Review setup and create the bot (Ctrl+E)'
              : `${issues.length} issue${issues.length === 1 ? '' : 's'} to fix.`}
          </TooltipContent>
        </Tooltip>
      </motion.div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </TooltipProvider>
  );
}
