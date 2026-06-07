import { Button } from '@/components/ui/button';
import {
  extractStrategyBlock,
  buildEquityCurve,
  extractBacktestMetrics,
  extractExitReasons,
  type BacktestHistoryItem,
} from '../backtest-results';
import { BacktestEquityChart } from './BacktestEquityChart';

const f = (n: number | null, d = 2, suffix = '') =>
  n == null ? '—' : `${n.toFixed(d)}${suffix}`;

export function PerformancePanel({
  item,
  onRunBacktest,
}: {
  item: BacktestHistoryItem | null;
  onRunBacktest: () => void;
}) {
  const block = item ? extractStrategyBlock(item) : null;

  if (!item || !block) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface/40">
        <div className="border-b border-border-subtle px-4 py-3 text-sm font-bold text-fg">
          Performance
        </div>
        <div className="px-4 py-8 text-center text-sm text-fg-muted">
          <div className="font-semibold text-fg-secondary">No backtest yet</div>
          <p className="mt-1.5">
            Run a backtest to see the equity curve, win rate, Sharpe and
            drawdown on historical data before committing real funds.
          </p>
          <Button variant="primary" className="mt-4" onClick={onRunBacktest}>
            Run first backtest
          </Button>
        </div>
      </div>
    );
  }

  const m = extractBacktestMetrics(block);
  const curve = buildEquityCurve(block);
  const exits = extractExitReasons(block);
  const maxExitAbs = Math.max(...exits.map((e) => Math.abs(e.profitAbs)), 1);

  const cells: Array<[string, string, boolean?]> = [
    ['Net profit', f(m.netAbs), (m.netAbs ?? 0) < 0],
    ['Win rate', f(m.winRatePct, 1, '%')],
    ['Trades', String(m.trades ?? '—')],
    ['Profit factor', f(m.profitFactor), (m.profitFactor ?? 1) < 1],
    ['Sharpe', f(m.sharpe), (m.sharpe ?? 0) < 0],
    ['Sortino', f(m.sortino), (m.sortino ?? 0) < 0],
    [
      'Max drawdown',
      `${f(m.maxDrawdownAbs)} (${f(m.maxDrawdownPct, 1)}%)`,
      true,
    ],
    ['Trades/day', f(m.tradesPerDay)],
  ];

  return (
    <div className="rounded-xl border border-border-subtle bg-surface/40">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <span className="text-sm font-bold text-fg">
          Performance · run #{item.id}
        </span>
        <span className="text-xs text-fg-muted">
          {item.timerange} · {item.timeframe}
        </span>
      </div>
      <div className="p-4">
        <BacktestEquityChart curve={curve} />

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {cells.map(([l, v, neg]) => (
            <div
              key={l}
              className="rounded-lg border border-border-subtle bg-black/20 p-3"
            >
              <div className="text-2xs text-fg-muted">{l}</div>
              <div
                className={`mt-1 font-mono text-lg font-bold ${neg ? 'text-bearish' : 'text-fg'}`}
              >
                {v}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3.5 flex flex-wrap gap-2">
          <Pill
            text={`Long ${m.longCount ?? '—'} · Short ${m.shortCount ?? '—'}`}
          />
          <Pill text={`Wins ${m.wins ?? '—'} / Losses ${m.losses ?? '—'}`} />
          <Pill text={`Avg stake ${f(m.avgStake)}`} />
          <Pill
            text={`Volume ${
              m.volume == null
                ? '—'
                : m.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })
            }`}
          />
          <Pill text={`Expectancy ${f(m.expectancy)}`} />
          {m.marketChangePct != null && (
            <Pill text={`vs Market ${m.marketChangePct}%`} />
          )}
        </div>

        {exits.length > 0 && (
          <>
            <div className="mb-2 mt-5 text-2xs uppercase tracking-widest text-fg-muted">
              Exit reasons
            </div>
            {exits.map((e) => (
              <div
                key={e.key}
                className="flex items-center gap-2.5 py-1.5 text-xs"
              >
                <span className="w-36 truncate">{e.key}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-border">
                  <div
                    className={
                      e.profitAbs >= 0
                        ? 'h-full bg-bullish'
                        : 'h-full bg-bearish'
                    }
                    style={{
                      width: `${(Math.abs(e.profitAbs) / maxExitAbs) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-28 text-right font-mono text-fg-secondary">
                  {e.trades} · {e.profitAbs.toFixed(2)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs text-fg-secondary">
      {text}
    </span>
  );
}
