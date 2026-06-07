import type { BacktestRunSummary } from '../backtest-history';
import { Panel, relTime } from './panel-kit';

const statusClass: Record<string, string> = {
  completed: 'bg-bullish-subtle text-bullish',
  failed: 'bg-bearish-subtle text-bearish',
  running: 'bg-info/10 text-info',
  pending: 'bg-fg-muted/10 text-fg-muted',
};

export function BacktestHistoryPanel({
  runs,
  selectedId,
  onSelect,
}: {
  runs: BacktestRunSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <Panel title="Backtest history" hint={`${runs.length} run(s)`}>
      {runs.length === 0 ? (
        <p className="py-6 text-center text-xs text-fg-muted">
          No backtests yet — run one to see results here.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {runs.map((r) => {
            const active = r.id === selectedId;
            const net =
              r.netAbs == null
                ? '—'
                : `${r.netAbs >= 0 ? '+' : ''}${r.netAbs.toFixed(2)}`;
            const netCls =
              r.netAbs == null
                ? 'text-fg-muted'
                : r.netAbs >= 0
                  ? 'text-bullish'
                  : 'text-bearish';
            return (
              <button
                key={r.id}
                type="button"
                aria-current={active}
                onClick={() => onSelect(r.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? 'border-brand/50 bg-brand/5'
                    : 'border-border-subtle hover:border-border'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-fg">
                      #{r.id}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-2xs font-bold uppercase ${
                        statusClass[r.status] ?? 'bg-fg-muted/10 text-fg-muted'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-2xs text-fg-muted">
                    {r.timerange} · {r.timeframe}
                    {r.date ? ` · ${relTime(r.date)}` : ''}
                  </div>
                </div>
                {r.status === 'completed' && (
                  <div className="flex shrink-0 gap-3 text-right font-mono text-2xs">
                    <span className="text-fg">
                      {r.winRatePct == null
                        ? '—'
                        : `${r.winRatePct.toFixed(1)}%`}
                    </span>
                    <span className="text-fg-muted">{r.trades ?? '—'}</span>
                    <span className={netCls}>{net}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
