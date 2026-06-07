import type { BotAuditLogOut } from '../bot.api';
import { Panel, relTime } from './panel-kit';

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
