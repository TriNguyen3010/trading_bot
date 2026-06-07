import { Panel, KV } from './panel-kit';

type Cfg = Record<string, unknown> | null | undefined;

/** Read the raw (untyped) /config dict, rendering ONLY keys the BE actually
 * returns — absent keys are skipped, never shown as "—". */
export function ConfigPanel({ config }: { config: Cfg }) {
  const c = (config ?? {}) as Record<string, unknown>;
  const exchange = c.exchange as Record<string, unknown> | undefined;

  const rows: Array<{ k: string; v: string }> = [];
  const push = (k: string, val: unknown, fmt?: (x: unknown) => string) => {
    if (val == null || val === '') return;
    rows.push({ k, v: fmt ? fmt(val) : String(val) });
  };

  push('Exchange', exchange?.name ?? c.exchange_name);
  push('Stake currency', c.stake_currency);
  push('Stake amount', c.stake_amount);
  push('Max open trades', c.max_open_trades);
  push('Trading mode', c.trading_mode);
  push('Margin mode', c.margin_mode);
  push('Timeframe', c.timeframe);
  if (typeof c.dry_run === 'boolean') {
    rows.push({ k: 'Mode', v: c.dry_run ? 'Dry-run' : 'Live' });
  }
  push('Leverage', c.leverage, (x) => `${x}×`);
  push('Dry-run wallet', c.dry_run_wallet);

  return (
    <Panel title="Configuration" hint="/config">
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-fg-muted">
          No configuration returned
        </p>
      ) : (
        rows.map((r) => <KV key={r.k} k={r.k} v={r.v} />)
      )}
    </Panel>
  );
}
