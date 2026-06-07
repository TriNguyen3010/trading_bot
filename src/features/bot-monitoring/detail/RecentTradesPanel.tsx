import type { BacktestTrade } from '../backtest-results';
import { Panel } from './panel-kit';

const num = (n: number | undefined, d = 0) =>
  n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: d });

export function RecentTradesPanel({ trades }: { trades: BacktestTrade[] }) {
  if (trades.length === 0) {
    return (
      <Panel title="Recent trades" hint="backtest results.trades">
        <p className="py-6 text-center text-xs text-fg-muted">
          No trades yet — run a backtest or start the bot.
        </p>
      </Panel>
    );
  }
  // backtest results.trades is ascending by close_timestamp → show the most
  // recent first, not the oldest.
  const rows = [...trades]
    .sort((a, b) => b.close_timestamp - a.close_timestamp)
    .slice(0, 8);
  return (
    <Panel title="Recent trades" hint="backtest results.trades">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-2xs uppercase tracking-wide text-fg-muted">
              <Th>Pair</Th>
              <Th>Side</Th>
              <Th>Entry</Th>
              <Th>Exit</Th>
              <Th>Lev</Th>
              <Th right>PnL</Th>
              <Th right>%</Th>
              <Th right>Funding</Th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((t, i) => {
              const up = (t.profit_abs ?? 0) >= 0;
              const pnlCls = up ? 'text-bullish' : 'text-bearish';
              return (
                <tr
                  // multi-pair runs can close two trades on the same candle →
                  // qualify by pair (+ index tiebreaker) so keys stay unique.
                  key={`${t.pair ?? ''}-${t.close_timestamp}-${i}`}
                  className="border-t border-border-subtle"
                >
                  <Td>{t.pair ?? '—'}</Td>
                  <Td>
                    <span
                      className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                        t.is_short
                          ? 'bg-bearish-subtle text-bearish'
                          : 'bg-bullish-subtle text-bullish'
                      }`}
                    >
                      {t.is_short ? 'SHORT' : 'LONG'}
                    </span>
                  </Td>
                  <Td>{num(t.open_rate)}</Td>
                  <Td>{num(t.close_rate)}</Td>
                  <Td>{t.leverage ? `${t.leverage}×` : '—'}</Td>
                  <Td right className={pnlCls}>
                    {up ? '+' : ''}
                    {num(t.profit_abs, 2)}
                  </Td>
                  <Td right className={pnlCls}>
                    {t.profit_ratio == null
                      ? '—'
                      : `${(t.profit_ratio * 100).toFixed(2)}%`}
                  </Td>
                  <Td right>{num(t.funding_fees, 3)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Th({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th className={`py-2 font-semibold ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  className = '',
}: {
  children: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td className={`py-2 ${right ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </td>
  );
}
