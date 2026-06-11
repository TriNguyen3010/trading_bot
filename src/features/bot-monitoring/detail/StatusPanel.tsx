import type { BotStatusOut } from '../bot.api';
import { Panel, KV, relTime } from './panel-kit';
import { strings } from '@/i18n/en';

const v = (x: unknown) => (x == null || x === '' ? '—' : String(x));

export function StatusPanel({ status }: { status: BotStatusOut | null }) {
  const running = status?.status === 'running';
  const H = strings.helpText.monitoring;
  return (
    <Panel title="Status &amp; process">
      <KV
        k="State"
        v={v(status?.status)}
        accent={running ? 'bull' : undefined}
        hint={H.state}
      />
      <KV
        k="Desired status"
        v={v(status?.desired_status)}
        hint={H.desiredStatus}
      />
      <KV
        k="Process"
        v={status?.is_process_running ? 'up' : 'down'}
        accent={status?.is_process_running ? 'bull' : undefined}
        hint={H.process}
      />
      <KV
        k="Last heartbeat"
        v={status?.last_heartbeat ? relTime(status.last_heartbeat) : '—'}
        hint={H.lastHeartbeat}
      />
      <KV
        k="Error"
        v={v(status?.error_message)}
        accent={status?.error_message ? 'bear' : undefined}
      />
    </Panel>
  );
}
