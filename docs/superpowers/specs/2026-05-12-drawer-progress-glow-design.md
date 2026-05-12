# Drawer Progress Glow — Design Spec

**Status:** Design approved via 3-option visual demo on `/progress-demo.html`, Tri picked Option B 2026-05-12 with refinements: glow coincides with panel right border, faint yellow line full-height, no scrollbar, bump-shaped highlight.
**Owner:** FE (Tri Nguyen).

---

## 1. Goal

Replace the native scrollbar on the right-side drawer (`StepDrawer` → `SheetContent`) with a visual scroll-progress indicator: a faint yellow line full-height on the panel's right border, plus a wider pill-shaped bright glow that slides up and down with the scroll position. The user gets a clear "where am I" without the visual noise of a standard scrollbar.

Applies to all right-side drawer steps (BotConfig, Strategy, anything else opened via StepDrawer).

## 2. Non-goals

- Discrete section markers (Option A) or per-section segments (Option C). Pure scroll progress only.
- Click-to-scroll on the glow. The glow is read-only.
- Animations beyond the existing `transition: top 200ms` ease.

## 3. Visual

```
┌──────────────────────────────┐⎟
│ Step header                  │⎟    ← always-on faint yellow line (1px wide, opacity 0.65 middle, fade at top/bottom)
│                              │⎟
│ ┌────────────────┐           │⎟
│ │ Bot name       │           │⎟
│ │ [____________] │           │⎟
│ └────────────────┘           │┃    ← bright pill-shaped glow band (5px wide, height ~160px)
│ ┌────────────────┐           │┣     · border-radius: 50% → "khối u" / bump shape
│ │ Pair           │           │┃     · `filter: blur(.3px)` soft edges
│ │ [BTC-USDC]     │           │┃     · box-shadow halo extending inward
│ └────────────────┘           │⎟     · slides as user scrolls
│ ┌────────────────┐           │⎟
│ │ Timeframe      │           │⎟
│ │ [5 minutes  ▼] │           │⎟
│ └────────────────┘           │⎟
│ Trading mode                 │⎟
│ ...                          │⎟
│ (scrolls)                    │⎟
│ Cancel              Save     │⎟
└──────────────────────────────┘⎟
```

- Native scrollbar **hidden** (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).
- Line + glow live at `right: 0` (line) and `right: -2px` (glow) of the `SheetContent` panel. Glow extends 2px past the edge so the bump silhouette is unmistakable.
- Position calculation: `top = scrollRatio × (panelHeight - glowHeight)`. ScrollRatio = `scrollTop / (scrollHeight - clientHeight)` on the scrollable element.

## 4. Component

### 4.1 New: `src/features/bot-builder/components/DrawerProgressGlow.tsx`

```ts
interface DrawerProgressGlowProps {
  /** Ref to the scrollable element (e.g. SheetBody). Required. */
  scrollRef: React.RefObject<HTMLElement | null>;
}
```

Renders two absolutely-positioned divs:
- `.drawer-progress-line` — always-on faint yellow line.
- `.drawer-progress-glow` — bright moving bump.

Uses `useEffect` to attach a `scroll` event listener (passive) to `scrollRef.current`. On scroll: read scrollTop, compute ratio, update glow's `top` via direct DOM mutation (no React re-render — perf-friendly for high-frequency events).

If scroll content does not overflow (`scrollHeight <= clientHeight`), hides the glow + line entirely (no useful information to convey).

Cleans up the listener on unmount.

### 4.2 Modified: `src/components/ui/sheet.tsx`

`SheetBody` becomes a `forwardRef` to expose its DOM node — currently it's a plain functional component without ref support. The change is mechanical:

```tsx
export const SheetBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex-1 overflow-y-auto px-6 py-5 scrollbar-thin', className)} {...props} />
  ),
);
SheetBody.displayName = 'SheetBody';
```

### 4.3 Modified: `src/features/bot-builder/components/StepDrawer.tsx`

- Add `const scrollRef = useRef<HTMLDivElement>(null)`.
- Pass `ref={scrollRef}` to `<SheetBody>`.
- Render `<DrawerProgressGlow scrollRef={scrollRef} />` inside `SheetContent` as a sibling of `SheetHeader`/`SheetBody`/`SheetFooter`.
- Apply scrollbar-hide classes on `SheetBody`: `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`.

## 5. Styling

CSS lives in the component itself via Tailwind arbitrary values + a small inline `<style>` for the gradient (Tailwind doesn't have a great gradient-with-multiple-stops syntax inline; clean to extract).

Or alternatively put the keyframes/gradients in `src/styles/tokens.css` as `.drawer-progress-line` + `.drawer-progress-glow` rules — preferred over inline `<style>` blocks.

**Going with the second approach.** Rules added to `src/styles/tokens.css`:

```css
.drawer-progress-line {
  position: absolute;
  top: 0; bottom: 0; right: 0;
  width: 1px;
  background: linear-gradient(
    to bottom,
    rgba(240,185,11,0.30) 0%,
    rgba(240,185,11,0.65) 8%,
    rgba(240,185,11,0.65) 92%,
    rgba(240,185,11,0.30) 100%
  );
  box-shadow: 0 0 6px rgba(240,185,11,0.20);
  pointer-events: none;
  z-index: 1;
}

.drawer-progress-glow {
  position: absolute;
  right: -2px;
  width: 5px;
  height: 160px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgb(240,185,11) 35%,
    rgb(240,185,11) 65%,
    transparent 100%
  );
  box-shadow:
    0 0 14px rgba(240,185,11,0.55),
    0 0 32px rgba(240,185,11,0.55),
    0 0 56px rgba(240,185,11,0.28);
  border-radius: 50%;
  filter: blur(0.3px);
  pointer-events: none;
  transition: top 200ms cubic-bezier(.22,1,.36,1);
  z-index: 2;
  top: 0; /* updated by JS on scroll */
}

/* When no overflow, hide both via .has-no-overflow modifier set by component */
.drawer-progress-glow[data-visible="false"],
.drawer-progress-line[data-visible="false"] {
  display: none;
}
```

## 6. Tests

| Layer | Test |
|---|---|
| Component render | `DrawerProgressGlow.test.tsx` — renders 2 divs (`.drawer-progress-line`, `.drawer-progress-glow`). When `scrollRef.current` is null, renders nothing visible. |
| Scroll update | Simulate scroll event on a ref'd container with mocked dimensions; verify glow's `style.top` updates to expected value. |
| Overflow detection | When `scrollHeight === clientHeight`, both elements get `data-visible="false"`. |

## 7. Risks

- **Native scrollbar gone**: keyboard users (arrow keys / Page Down) still work since `SheetBody` is `tabIndex` reachable via focused inputs. Touchpad/wheel scrolling unaffected. Touch scrolling unaffected. Mouse-grab-the-scrollbar is the only lost interaction — acceptable, replaced by wheel/touch.
- **Position relative**: `SheetContent` already uses `position: fixed`, which establishes a positioning context for absolute children. No additional setup needed.
- **Animation perf**: scroll listener fires often; we mutate DOM directly via `style.top` (not React state). 60fps fine.

## 8. Out of scope

- Multiple glows (e.g. one per section). Single glow only.
- Tap-to-jump-to-section.
- Glow color theming (always brand yellow).
- Demo file `public/progress-demo.html` — keep during this implementation for side-by-side comparison, delete after Tri confirms the React version matches.
