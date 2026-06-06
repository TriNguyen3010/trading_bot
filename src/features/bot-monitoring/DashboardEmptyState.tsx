import { Button } from '@/components/ui/button';

export function DashboardEmptyState({
  onCreate,
  onImport,
}: {
  onCreate: () => void;
  onImport: () => void;
}) {
  return (
    <div className="card-coin98-flat flex flex-col items-center rounded-2xl p-16 text-center">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
        <rect
          x="7"
          y="7"
          width="50"
          height="50"
          rx="13"
          stroke="#474d57"
          strokeWidth="2"
          strokeDasharray="5 6"
        />
        <path
          d="M32 23V41M23 32H41"
          stroke="#f0b90b"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-4 text-lg font-bold text-fg">No bots yet</div>
      <p className="mt-2 max-w-md text-sm text-fg-secondary">
        Build your first trading bot — pick a pair, indicators and entry/exit
        rules. No Python required.
      </p>
      <div className="mt-5 flex gap-2.5">
        <Button variant="primary" onClick={onCreate}>
          ＋ Create your first bot
        </Button>
        <Button variant="secondary" onClick={onImport}>
          Import from JSON
        </Button>
      </div>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-xs text-fg-secondary">
        <Step n={1} label="Build strategy" />{' '}
        <span className="text-fg-muted">→</span>
        <Step n={2} label="Backtest it" />{' '}
        <span className="text-fg-muted">→</span>
        <Step n={3} label="Dry-run / Go live" />
      </div>
    </div>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-elevated font-mono text-2xs text-brand">
        {n}
      </span>
      {label}
    </span>
  );
}
