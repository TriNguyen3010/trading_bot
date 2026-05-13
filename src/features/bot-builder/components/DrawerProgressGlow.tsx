import { useEffect, useRef } from 'react';

export interface DrawerProgressGlowProps {
  /**
   * Ref to the scrollable element (typically the `SheetBody`). Required —
   * the component reads its scroll position to drive the glow's `top`.
   */
  scrollRef: React.RefObject<HTMLElement | null>;
}

/**
 * Visual scroll-progress indicator that replaces the native scrollbar on
 * the right-side drawer. Renders two absolutely-positioned siblings:
 *
 * - `.drawer-progress-line`  faint yellow vertical line, always visible
 *   on the panel's right edge.
 * - `.drawer-progress-glow`  bright pill-shaped band that slides up and
 *   down with scroll. Position updates via direct DOM mutation
 *   (`style.top = ...`) on every `scroll` event — no React re-render —
 *   so the animation stays at 60fps even with high-frequency events.
 *
 * When the scroll container does not overflow (`scrollHeight <= clientHeight`),
 * both elements are hidden via `data-visible="false"` — no useful info to
 * show. Re-evaluated on every scroll AND on every layout change driven by
 * `ResizeObserver` so dynamic content (e.g. a condition row added) flips
 * the indicator on/off correctly.
 *
 * The parent that hosts this component must have `position: relative` (or
 * any non-static positioning) — the line + glow are absolutely positioned
 * relative to that ancestor. `SheetContent` is `position: fixed`, which
 * already satisfies this.
 */
export function DrawerProgressGlow({ scrollRef }: DrawerProgressGlowProps) {
  const lineRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const lineEl = lineRef.current;
    const glowEl = glowRef.current;
    if (!scrollEl || !lineEl || !glowEl) return;

    // The glow renders as a direct child of the panel container (no
    // wrapper element — React fragments don't introduce DOM nodes), so
    // `parentElement` IS the positioning context. Prefer this over
    // `offsetParent` because jsdom doesn't compute offsetParent reliably
    // and we'd lose test coverage of the positioning math.
    const panelEl = glowEl.parentElement;

    const update = () => {
      const max = scrollEl.scrollHeight - scrollEl.clientHeight;
      const hasOverflow = max > 0;

      // Line is a status indicator (yellow by default) — always visible
      // regardless of scroll. Glow is a scroll pointer — only meaningful
      // when there's something to scroll.
      lineEl.dataset.visible = 'true';
      glowEl.dataset.visible = hasOverflow ? 'true' : 'false';

      if (!hasOverflow || !panelEl) return;
      const ratio = scrollEl.scrollTop / max;
      const panelH = panelEl.clientHeight;
      const glowH = glowEl.clientHeight;
      // Keep the glow inside the panel's rounded-l-3xl (24px) corners so it
      // never travels past where the left edge starts curving.
      const inset = 24;
      const travel = Math.max(0, panelH - 2 * inset - glowH);
      glowEl.style.top = `${inset + ratio * travel}px`;
    };

    update();
    scrollEl.addEventListener('scroll', update, { passive: true });

    // ResizeObserver — pick up overflow toggling when content changes
    // (e.g. user adds a condition row that pushes total height past
    // panel height). Modern evergreen browsers support this natively.
    const ro = new ResizeObserver(update);
    ro.observe(scrollEl);

    return () => {
      scrollEl.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scrollRef]);

  return (
    <>
      <div ref={lineRef} className="drawer-progress-line" aria-hidden />
      <div ref={glowRef} className="drawer-progress-glow" aria-hidden />
    </>
  );
}
