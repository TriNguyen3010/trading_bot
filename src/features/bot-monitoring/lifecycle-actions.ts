export type LifecycleAction = 'start' | 'stop' | 'sync' | 'remove';

const TERMINAL = new Set(['running', 'stopped', 'error']);

export function isTerminal(status: string): boolean {
  return TERMINAL.has(status);
}

export function nextOptimisticStatus(
  action: LifecycleAction,
  current: string,
): string {
  if (action === 'start') return 'starting';
  if (action === 'stop') return 'stopping';
  return current;
}

const LABELS: Record<string, string> = {
  running: 'Running',
  stopped: 'Stopped',
  starting: 'Starting…',
  stopping: 'Stopping…',
  error: 'Error',
};

export function formatStatusLabel(status: string): string {
  if (LABELS[status]) return LABELS[status];
  // Titlecase fallback: "weird_new" → "Weird new"
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
