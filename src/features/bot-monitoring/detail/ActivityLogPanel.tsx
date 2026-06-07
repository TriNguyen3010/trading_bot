import type { BotAuditLogOut } from '../bot.api';
import { Panel } from './panel-kit';

/** Compact relative time; falls back to the raw timestamp on parse failure. */
function relTime(ts: string): string {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return ts;
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function ActivityLogPanel({ logs }: { logs: BotAuditLogOut[] }) {
  return (
    <Panel title="Activity log" hint="/audit_logs">
      {logs.length === 0 ? (
        <p className="py-6 text-center text-xs text-fg-muted">
          No activity yet
        </p>
      ) : (
        logs.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between border-b border-border-subtle py-2 text-xs last:border-0"
          >
            <span className="truncate text-fg-secondary">
              {l.action} · {l.triggered_by}
            </span>
            <span className="shrink-0 pl-2 text-fg-muted">
              {relTime(l.timestamp)}
            </span>
          </div>
        ))
      )}
    </Panel>
  );
}
