import { useEffect, useRef } from 'react';

/**
 * Yellow dot-grid spotlight background — Spec/Phase 1/dot-grid-spotlight/brief.md.
 *
 * Canvas-2D, fully self-contained:
 *  - Idle: dots are barely visible (alpha 0.14).
 *  - Cursor moves: dots within radius brighten quadratically toward 0.95.
 *  - Cursor stops or leaves area: spotlight fades out over ~900 ms.
 *  - prefers-reduced-motion or mobile (hover: none): grid stays static.
 *
 * Mounted as `pointer-events: none` so it never blocks UI clicks.
 */

const SPACING = 17;
const RADIUS = 120;
const FADE_IN_RATE = 0.06; // strength gain per frame when active
const FADE_OUT_RATE = 0.022; // strength loss per frame when idle
const IDLE_MS = 80;
const LERP = 0.18;
const COLOR = [255, 210, 80] as const;
const BASE_ALPHA = 0.22;
const PEAK_ALPHA = 0.95;

export function DotGridSpotlight({ className, style, dimmed }: { className?: string, style?: React.CSSProperties, dimmed?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (typeof window !== 'undefined') {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
      const noHover = window.matchMedia('(hover: none)');
      if (reduce.matches || noHover.matches) {
        // Render a single static frame with idle alpha and stop.
        renderStaticGrid(canvas, dimmed);
        return;
      }
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let dots: { x: number; y: number }[] = [];
    let mouseX = -9999;
    let mouseY = -9999;
    let smoothX = mouseX;
    let smoothY = mouseY;
    let lastMoveTime = 0;
    let isInside = false;
    let strength = 0;
    let raf = 0;

    const rebuildGrid = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      const cols = Math.ceil(rect.width / SPACING);
      const rows = Math.ceil(rect.height / SPACING);
      const offsetX = (rect.width - cols * SPACING) / 2 + SPACING / 2;
      const offsetY = (rect.height - rows * SPACING) / 2 + SPACING / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: offsetX + c * SPACING,
            y: offsetY + r * SPACING,
          });
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mouseX = x;
      mouseY = y;
      lastMoveTime = performance.now();
      isInside =
        x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    };
    const onMouseLeave = () => {
      isInside = false;
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Smooth cursor toward target.
      smoothX = smoothX + (mouseX - smoothX) * LERP;
      smoothY = smoothY + (mouseY - smoothY) * LERP;

      const idleFor = performance.now() - lastMoveTime;
      const target = isInside && idleFor < IDLE_MS ? 1 : 0;
      strength =
        target === 1
          ? Math.min(1, strength + FADE_IN_RATE)
          : Math.max(0, strength - FADE_OUT_RATE);

      const radius2 = RADIUS * RADIUS;
      for (const dot of dots) {
        let alpha = BASE_ALPHA;
        if (strength > 0) {
          const dx = dot.x - smoothX;
          const dy = dot.y - smoothY;
          const d2 = dx * dx + dy * dy;
          if (d2 < radius2) {
            const t = 1 - d2 / radius2; // 0..1, 1 = at cursor
            const boost = t * t * strength;
            alpha = BASE_ALPHA + boost * (PEAK_ALPHA - BASE_ALPHA);
          }
        }
        if (dimmed) alpha *= 0.3;
        ctx.fillStyle = `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    rebuildGrid();
    raf = requestAnimationFrame(draw);

    const resizeObserver = new ResizeObserver(() => rebuildGrid());
    resizeObserver.observe(canvas);

    // Listen on window so the spotlight still tracks the cursor even when
    // it's hovering over a step card or another element above the canvas.
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) onMouseLeave();
    });

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [dimmed]);

  return (
    <div
      aria-hidden
      style={style}
      className={className}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none block h-full w-full"
      />
    </div>
  );
}

function renderStaticGrid(canvas: HTMLCanvasElement, dimmed?: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  for (let y = SPACING / 2; y < rect.height; y += SPACING) {
    for (let x = SPACING / 2; x < rect.width; x += SPACING) {
      let alpha = BASE_ALPHA;
      if (dimmed) alpha *= 0.3;
      ctx.fillStyle = `rgba(${COLOR[0]}, ${COLOR[1]}, ${COLOR[2]}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
