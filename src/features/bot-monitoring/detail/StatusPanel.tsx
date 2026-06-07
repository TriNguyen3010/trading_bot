import type { BotStatusOut } from '../bot.api';
import { Panel, KV } from './panel-kit';

const v = (x: unknown) => (x == null || x === '' ? '—' : String(x));

export function StatusPanel({ status }: { status: BotStatusOut | null }) {
  const running = status?.status === 'running';
  return (
    <Panel title="Status &amp; process">
      <KV
        k="State"
        v={v(status?.status)}
        accent={running ? 'bull' : undefined}
      />
      <KV k="Desired status" v={v(status?.desired_status)} />
      <KV
        k="Process"
        v={status?.is_process_running ? 'up' : 'down'}
        accent={status?.is_process_running ? 'bull' : undefined}
      />
      <KV k="Last heartbeat" v={v(status?.last_heartbeat)} />
      <KV
        k="Error"
        v={v(status?.error_message)}
        accent={status?.error_message ? 'bear' : undefined}
      />
    </Panel>
  );
}
