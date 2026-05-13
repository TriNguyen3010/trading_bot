/**
 * Scroll the right-side drawer body to a tagged anchor — kept around so
 * future flows (e.g. validation jumps, AI streaming when it ships) can
 * focus a specific field group programmatically.
 *
 * Anchors are `[data-cy-anchor="<id>"]` elements placed on field-group
 * wrappers in BotConfigStep / StrategyDrawerContent.
 *
 * Behaviour:
 *   - No-op when no element with the given anchor exists. The drawer
 *     may not have rendered yet (we're between pin + sleep), or the
 *     stepId mounted may not host that anchor — both fine, just skip.
 *   - No-op in non-DOM environments (vitest jsdom is fine; SSR/Node
 *     would fall through cleanly).
 *   - Honours `prefers-reduced-motion: reduce` — falls back to instant
 *     scroll for accessibility users.
 *
 * `block: 'center'` keeps the anchor visually centred in the viewport
 * (the Sheet has its own scroll context so this stays inside the
 * drawer, not the page).
 */

function prefersReducedMotion(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function scrollDrawerTo(anchor: string): void {
  if (typeof document === 'undefined') return;
  const el = document.querySelector(`[data-cy-anchor="${anchor}"]`);
  if (!(el instanceof HTMLElement)) return;
  el.scrollIntoView({
    block: 'center',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

/** Anchor IDs used across the drawer + animation engine. Keeps the
 *  anchor strings centralised so a typo on either side is a TS error. */
export const DRAWER_ANCHORS = {
  botConfig: {
    pair: 'bot-config:pair',
    leverage: 'bot-config:leverage',
    exchange: 'bot-config:exchange',
  },
  strategy: {
    entry: 'strategy:entry',
    action: 'strategy:action',
  },
} as const;
