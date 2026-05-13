import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlignLeft,
  BookOpen,
  Download,
  Eye,
  EyeOff,
  FlaskConical,
  Layers,
  List,
  LogOut,
  Pencil,
  Upload,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { MyBotsDialog } from '@/features/bot-monitoring/MyBotsDialog';
import { useMyBotsDialogStore } from '@/features/bot-monitoring/my-bots-dialog.store';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { useTemplatesDialogStore } from '@/features/templates/templates-dialog.store';
import { AppliedTemplateBadge } from '@/features/templates/AppliedTemplateBadge';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import { validateBuilder } from '@/lib/validator';
import { strings } from '@/i18n/en';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/auth.store';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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
  const setMyBotsOpen = useMyBotsDialogStore((s) => s.setOpen);
  const setTemplatesOpen = useTemplatesDialogStore((s) => s.setOpen);
  const botSummaryHidden = useLayoutPrefsStore((s) => s.botSummaryHidden);
  const toggleBotSummary = useLayoutPrefsStore((s) => s.toggleBotSummary);
  const summaryMode = useLayoutPrefsStore((s) => s.summaryMode);
  const toggleSummaryMode = useLayoutPrefsStore((s) => s.toggleSummaryMode);

  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState(botName);
  const [importOpen, setImportOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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
    <header className="flex h-[var(--layout-header)] flex-shrink-0 items-center px-3 pt-2">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 rounded-full card-coin98 px-3 py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
      <div className="flex items-center gap-3 pl-1">
        <img
          src="/logo.png"
          alt="Strategy Builder"
          className="h-8 w-8 select-none rounded-full object-contain"
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
            className="group inline-flex items-center gap-2 rounded-full px-3 py-1 text-md font-semibold text-fg transition-colors hover:bg-black/40"
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
        <div className="flex items-center gap-1.5 pr-1">
          {/* View toggles — bot summary visibility is the only panel
           * toggle that lives here. The Cypheus expand/collapse chevron
           * is owned by the panel itself (IDE-style sidebar), so the
           * panel never disappears and we don't need a restore button. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleBotSummary}
                className="rounded-full"
                aria-label={
                  botSummaryHidden
                    ? strings.layoutToggles.summaryShowAria
                    : strings.layoutToggles.summaryHideAria
                }
                aria-pressed={!botSummaryHidden}
              >
                {botSummaryHidden ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {botSummaryHidden
                ? strings.layoutToggles.summaryShowTooltip
                : strings.layoutToggles.summaryHideTooltip}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSummaryMode}
                className="rounded-full"
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
          {/* Visual divider between view toggles and primary actions. */}
          <span
            aria-hidden="true"
            className="mx-1 h-5 w-px bg-border-subtle"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTemplatesOpen(true)}
                className="rounded-full px-3"
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
                className="rounded-full px-3"
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
              <Button variant="secondary" size="sm" className="rounded-full px-3" disabled>
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
                  className="rounded-full px-4 shadow-[0_0_16px_rgba(240,185,11,0.35)]"
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
          <CreateNewBotButton />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setMyBotsOpen(true)}
                className="rounded-full px-3"
              >
                <List className="h-3.5 w-3.5" />
                My Bots
              </Button>
            </TooltipTrigger>
            <TooltipContent>Browse and monitor all your bots.</TooltipContent>
          </Tooltip>

          <span
            aria-hidden="true"
            className="mx-1 h-5 w-px bg-border-subtle"
          />

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full px-3"
              >
                <User className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate text-xs">
                  {authUser?.email ?? 'User'}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2">
              <div className="mb-2 border-b border-border px-2 pb-2">
                <p className="text-sm font-medium text-fg">
                  {authUser?.email ?? 'User'}
                </p>
                <p className="text-xs text-fg-muted">
                  {authUser?.is_admin ? 'Admin' : 'Member'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-bearish"
                onClick={() => {
                  logout();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Đăng xuất
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </TooltipProvider>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <MyBotsDialog />
    </header>
  );
}
