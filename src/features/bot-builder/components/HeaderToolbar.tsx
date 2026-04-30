import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Download, FlaskConical, Pencil, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { ExportDialog } from '@/features/export-import/ExportDialog';
import { useExportDialogStore } from '@/features/export-import/export-dialog.store';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { useTemplatesDialogStore } from '@/features/templates/templates-dialog.store';
import { AppliedTemplateBadge } from '@/features/templates/AppliedTemplateBadge';
import { validateBuilder } from '@/lib/validator';
import { strings } from '@/i18n/en';
import { cn } from '@/lib/utils';

function relativeTime(ts: number | null) {
  if (!ts) return null;
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 5) return strings.header.saved;
  if (seconds < 60)
    return `${strings.header.saved} · ${strings.header.secondsAgo(seconds)}`;
  const minutes = Math.round(seconds / 60);
  return `${strings.header.saved} · ${minutes}m ago`;
}

export function HeaderToolbar() {
  const botName = useBuilderStore((s) => s.botName);
  const setBotName = useBuilderStore((s) => s.setBotName);
  const lastSavedAt = useBuilderStore((s) => s.lastSavedAt);
  const state = useBuilderStore();

  const exportOpen = useExportDialogStore((s) => s.open);
  const setExportOpen = useExportDialogStore((s) => s.setOpen);
  const setTemplatesOpen = useTemplatesDialogStore((s) => s.setOpen);

  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState(botName);
  const [importOpen, setImportOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const issues = useMemo(() => validateBuilder(state), [state]);
  const canExport = issues.length === 0;

  // Tick once a second so "Saved 12s ago" stays fresh.
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (isEditing) {
      setDraft(botName);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, botName]);

  // Ctrl/Cmd + E → Export, Ctrl/Cmd + I → Import.
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

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== botName) setBotName(trimmed);
    setEditing(false);
  };

  return (
    <header className="flex h-[var(--layout-header)] flex-shrink-0 items-center justify-between border-b border-border-subtle bg-canvas px-6">
      <div className="flex items-center gap-4">
        <img
          src="/logo.png"
          alt="Strategy Builder"
          className="h-8 w-8 select-none object-contain"
          draggable={false}
        />
        {isEditing ? (
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            placeholder={strings.header.botNamePlaceholder}
            className="h-8 w-72 text-md font-semibold"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group inline-flex items-center gap-2 rounded-md px-2 py-1 text-md font-semibold text-fg transition-colors hover:bg-surface-hover"
            aria-label="Edit bot name"
          >
            {botName || strings.header.botNamePlaceholder}
            <Pencil className="h-3.5 w-3.5 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
        <span
          className={cn('text-xs text-fg-muted', !lastSavedAt && 'invisible')}
        >
          {relativeTime(lastSavedAt)}
        </span>
        {/* Applied template indicator. Renders nothing when the user
         * started blank or hit Create-new-bot. */}
        <AppliedTemplateBadge />
      </div>
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTemplatesOpen(true)}
                aria-label={strings.templates.headerButtonAria}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {strings.templates.headerButton}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {strings.templates.headerButtonTooltip}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImportOpen(true)}
                aria-label="Import bundle"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
            </TooltipTrigger>
            <TooltipContent>Import a bundle JSON (Ctrl+I)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" size="sm" disabled>
                <FlaskConical className="h-3.5 w-3.5" />
                {strings.header.backtest}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Backtest will arrive in Phase 2.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!canExport}
                  onClick={() => setExportOpen(true)}
                >
                  <Download className="h-3.5 w-3.5" />
                  {strings.header.export}
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
                ? 'Export the bundle JSON (Ctrl+E)'
                : `${issues.length} issue${issues.length === 1 ? '' : 's'} to fix.`}
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </header>
  );
}
