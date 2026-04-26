import { useCypheusStore } from '../store/cypheus.store';

/**
 * Helpers used by the scripted Cypheus demo. All sleep durations honour the
 * `demo-speed` URL param (default 1×, supported: 0.5x, 1x, 1.5x, 2x, 4x).
 *
 * The runner is intentionally simple — a sequence of awaited async calls
 * works fine for a 39 s scripted demo and keeps the implementation
 * inspectable. We track an `abortToken` so a fresh "Create new bot" cancels
 * any in-flight script.
 */

let activeToken = 0;

export interface RunContext {
  token: number;
  speed: number;
}

export function getDemoSpeed(): number {
  if (typeof window === 'undefined') return 1;
  const param = new URLSearchParams(window.location.search).get('demo-speed');
  if (!param) return 1;
  const m = param.match(/^(\d+(?:\.\d+)?)x?$/);
  if (!m) return 1;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function startScript(): RunContext {
  activeToken += 1;
  return { token: activeToken, speed: getDemoSpeed() };
}

export function abortAllScripts(): void {
  activeToken += 1;
}

export function isCurrent(ctx: RunContext): boolean {
  return ctx.token === activeToken;
}

export function sleep(ms: number, ctx: RunContext): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms / Math.max(0.1, ctx.speed));
  });
}

/**
 * Push a Cypheus message with progressive typewriter rendering.
 * Returns when the full text has been typed.
 */
export async function typewriterMessage(
  text: string,
  ctx: RunContext,
  charDelayMs = 22,
): Promise<void> {
  const id = useCypheusStore
    .getState()
    .pushMessage({ role: 'cypheus', text: '', typing: true });
  for (let i = 1; i <= text.length; i++) {
    if (!isCurrent(ctx)) return;
    useCypheusStore.getState().updateMessage(id, { text: text.slice(0, i) });
    await sleep(charDelayMs, ctx);
  }
  useCypheusStore.getState().updateMessage(id, { typing: false });
}

/**
 * Apply a value progressively to mimic the AI typing into a form field.
 * `set` is called with each prefix of `value`.
 */
export async function typewriterValue(
  set: (partial: string) => void,
  value: string,
  ctx: RunContext,
  charDelayMs = 90,
): Promise<void> {
  for (let i = 1; i <= value.length; i++) {
    if (!isCurrent(ctx)) return;
    set(value.slice(0, i));
    await sleep(charDelayMs, ctx);
  }
}
