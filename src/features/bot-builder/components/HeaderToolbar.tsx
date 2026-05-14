import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  FlaskConical,
  List,
  LogOut,
  Upload,
  User,
} from 'lucide-react';
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
import { MyBotsDialog } from '@/features/bot-monitoring/MyBotsDialog';
import { useMyBotsDialogStore } from '@/features/bot-monitoring/my-bots-dialog.store';
import { ImportDialog } from '@/features/export-import/ImportDialog';
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
  const lastSavedAt = useBuilderStore((s) => s.lastSavedAt);
  const state = useBuilderStore();

  const exportOpen = useExportDialogStore((s) => s.open);
  const setExportOpen = useExportDialogStore((s) => s.setOpen);
  const setMyBotsOpen = useMyBotsDialogStore((s) => s.setOpen);

  const [importOpen, setImportOpen] = useState(false);

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

  return (
    <header className="flex h-[var(--layout-header)] flex-shrink-0 items-center px-3 pt-2">
      <TooltipProvider delayDuration={300}>
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 rounded-full card-coin98 px-3 py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
          {/* Left cluster: identity (logo + saved) followed by the
            * navigation/account controls (User, Create new bot, My bots).
            * Order per user request: Logo · User · Create new bot · My bots. */}
          <div className="flex items-center gap-1.5 pl-1">
            <img
              src="/logo.png"
              alt="Strategy Builder"
              className="mr-2 h-8 w-8 select-none rounded-full object-contain"
              draggable={false}
            />
            <span
              className={cn(
                'mr-2 text-xs text-fg-muted',
                !lastSavedAt && 'invisible',
              )}
            >
              {relativeTime(lastSavedAt)}
            </span>
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
              <PopoverContent align="start" className="w-56 p-2">
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
          </div>

          {/* Right cluster: bundle-IO actions in build → ship order:
            * Backtest · Import · Export (Export keeps the primary glow on
            * the far right since it's the terminal action). */}
          <div className="flex items-center gap-1.5 pr-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full px-3"
                  disabled
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  {strings.header.backtest}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Backtest will arrive in Phase 2.</TooltipContent>
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
          </div>
        </div>
      </TooltipProvider>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <MyBotsDialog />
    </header>
  );
}
