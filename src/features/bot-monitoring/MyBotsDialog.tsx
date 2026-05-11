import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatBackendError } from '@/lib/format-error';
import { jsonPairToUi } from '@/lib/pair-format';
import { botApi, type BotOut } from './bot.api';
import { useMyBotsDialogStore } from './my-bots-dialog.store';

interface FreqtradeConfig {
  bot_name?: string;
  dry_run?: boolean;
  timeframe?: string;
  exchange?: { pair_whitelist?: string[] };
}

interface BotRow {
  meta: BotOut;
  config: FreqtradeConfig | null;
  configError: boolean;
}

function StatusBadge({ row }: { row: BotRow }) {
  const errored = !!row.meta.error_message;
  const running = row.meta.status === 'running';
  const label = errored ? 'ERROR' : row.meta.status.toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        errored
          ? 'bg-bearish/15 text-bearish'
          : running
            ? 'bg-bullish/15 text-bullish'
            : 'bg-fg-muted/15 text-fg-muted',
      )}
    >
      {label}
    </span>
  );
}

function ModeBadge({ config }: { config: FreqtradeConfig | null }) {
  if (config == null) {
    return <span className="inline-block h-4 w-14 animate-pulse rounded-full bg-fg-muted/15" />;
  }
  const live = config.dry_run === false;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide',
        live ? 'bg-bullish/15 text-bullish' : 'bg-brand/15 text-brand',
      )}
    >
      {live ? 'LIVE' : 'DRY-RUN'}
    </span>
  );
}

function Placeholder() {
  return <span className="text-sm font-semibold tabular-nums text-fg-muted">&mdash;</span>;
}

function BotCard({ row, onClick }: { row: BotRow; onClick: () => void }) {
  const pairRaw = row.config?.exchange?.pair_whitelist?.[0];
  const pair = pairRaw ? jsonPairToUi(pairRaw) : row.configError ? '?' : null;
  const timeframe = row.config?.timeframe ?? (row.configError ? '?' : null);
  const name = row.meta.bot_name ?? `Bot #${row.meta.id}`;

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={name}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface p-4 cursor-pointer',
        'transition-all hover:border-border-default hover:bg-surface-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex-shrink-0 rounded-lg bg-brand/10 p-1.5">
            <BarChart2 className="h-4 w-4 text-brand" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg truncate">{name}</p>
            <p className="text-xs text-fg-muted">
              {pair == null ? (
                <span className="inline-block h-3 w-16 animate-pulse rounded bg-fg-muted/15" />
              ) : (
                <code className="text-fg-secondary">{pair}</code>
              )}
              <span className="mx-1.5 text-border-strong">&middot;</span>
              {timeframe == null ? (
                <span className="inline-block h-3 w-8 animate-pulse rounded bg-fg-muted/15" />
              ) : (
                timeframe
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ModeBadge config={row.config} />
          <StatusBadge row={row} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border-subtle bg-canvas px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-wider text-fg-muted">Today</span>
          <Placeholder />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-wider text-fg-muted">Win</span>
          <Placeholder />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-2xs uppercase tracking-wider text-fg-muted">Trades</span>
          <Placeholder />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-fg-muted">&mdash;</span>
        <span className="text-xs font-semibold text-brand">Monitor &rarr;</span>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div
      data-testid="my-bots-skeleton"
      className="h-44 animate-pulse rounded-xl border border-border-subtle bg-surface"
    />
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center py-10">
      <div className="rounded-xl border border-border-subtle bg-surface p-10 flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="rounded-full bg-brand/10 p-4">
          <BarChart2 className="h-8 w-8 text-brand" />
        </div>
        <div>
          <p className="text-base font-semibold text-fg">No bots yet</p>
          <p className="mt-1 text-sm text-fg-muted">
            Build your first strategy to start automating your trades.
          </p>
        </div>
        <Button
          onClick={() => {
            onClose();
            navigate('/builder');
          }}
        >
          Build your first strategy &rarr;
        </Button>
      </div>
    </div>
  );
}

export function MyBotsDialog() {
  const open = useMyBotsDialogStore((s) => s.open);
  const setOpen = useMyBotsDialogStore((s) => s.setOpen);
  const navigate = useNavigate();
  const [rows, setRows] = useState<BotRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      const bots = await botApi.list();
      const seeded: BotRow[] = bots.map((b) => ({
        meta: b,
        config: null,
        configError: false,
      }));
      setRows(seeded);
      const enriched = await Promise.all(
        bots.map(async (b): Promise<BotRow> => {
          try {
            const res = await botApi.getConfig(b.id);
            return { meta: b, config: res.config as FreqtradeConfig, configError: false };
          } catch {
            return { meta: b, config: null, configError: true };
          }
        }),
      );
      setRows(enriched);
    } catch (err) {
      setError(formatBackendError(err));
      setRows(null);
    }
  }, []);

  useEffect(() => {
    if (open) fetchBots();
  }, [open, fetchBots]);

  function handleCardClick(id: number) {
    setOpen(false);
    navigate(`/bots/${id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>My Bots</DialogTitle>
          <DialogDescription>
            All bots in your account. Click a card to open its monitor.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-bearish-subtle p-4">
            <pre className="whitespace-pre-wrap font-mono text-xs text-bearish">{error}</pre>
            <Button variant="secondary" onClick={fetchBots} className="self-start">
              Retry
            </Button>
          </div>
        ) : rows == null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState onClose={() => setOpen(false)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-h-[60vh] overflow-y-auto">
            {rows.map((r) => (
              <BotCard key={r.meta.id} row={r} onClick={() => handleCardClick(r.meta.id)} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
