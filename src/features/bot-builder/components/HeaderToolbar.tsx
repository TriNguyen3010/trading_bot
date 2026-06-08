import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { List, Rocket, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dropInItem, dropInStagger } from '@/lib/motion';
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
import { WalletChip } from '@/features/wallet-auth/WalletChip';

export function HeaderToolbar() {
  const state = useBuilderStore();

  const exportOpen = useExportDialogStore((s) => s.open);
  const setExportOpen = useExportDialogStore((s) => s.setOpen);

  const [importOpen, setImportOpen] = useState(false);

  const navigate = useNavigate();

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
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-[var(--layout-header)] items-center px-3 pt-2">
        <TooltipProvider delayDuration={300}>
          <motion.div
            className="app-header-pill mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 rounded-full py-3 pl-4 pr-3"
            variants={dropInStagger}
            initial="hidden"
            animate="visible"
          >
            {/* Left cluster: identity + nav — Logo · wallet · Dashboard.
             * (Saved status moved under Add Strategy; "New" moved into the
             * right-side segmented group.) */}
            <div className="flex items-center gap-1.5 pl-1">
              <button
                type="button"
                onClick={() => navigate('/')}
                aria-label="Back to landing page"
                className="mr-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <img
                  src="/logo.png"
                  alt="Strategy Builder · click to go to landing page"
                  className="h-8 w-8 select-none rounded-full object-contain transition hover:brightness-110"
                  draggable={false}
                />
              </button>
              <motion.div variants={dropInItem} className="inline-flex">
                <WalletChip triggerVariant="ghost" redirectOnDisconnect="/" />
              </motion.div>
              <motion.div variants={dropInItem} className="inline-flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate('/dashboard')}
                      className="h-10 rounded-full px-3"
                    >
                      <List className="h-3.5 w-3.5" />
                      Dashboard
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Browse and monitor all your bots.
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            </div>

            {/* Right cluster: segmented [New · Import] secondary group, then
             * the primary "Create bot" (terminal action — opens the
             * review/confirm dialog that saves the bot, from which dry-run /
             * backtest / live are chosen later). */}
            <div className="flex items-center gap-2 pr-1">
              <motion.div variants={dropInItem} className="inline-flex">
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
                    <TooltipContent>
                      Import a bundle JSON (Ctrl+I)
                    </TooltipContent>
                  </Tooltip>
                </div>
              </motion.div>
              <motion.div variants={dropInItem} className="inline-flex">
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
            </div>
          </motion.div>
        </TooltipProvider>
      </header>
      <div
        aria-hidden="true"
        className="h-[var(--layout-header)] flex-shrink-0"
      />

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
