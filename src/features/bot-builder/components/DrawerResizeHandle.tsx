import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  currentWidth: number;
  onResize: (width: number) => void;
}

export function DrawerResizeHandle({ currentWidth, onResize }: Props) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, w: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    startRef.current = { x: e.clientX, w: currentWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = startRef.current.x - e.clientX; // drag left -> wider
    onResize(startRef.current.w + delta);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize drawer"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onResize(currentWidth + 16);
        if (e.key === 'ArrowRight') onResize(currentWidth - 16);
      }}
      className={cn(
        'absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize',
        'before:absolute before:inset-y-0 before:left-1 before:w-px before:bg-border',
        'hover:before:bg-brand hover:before:w-0.5',
        'focus-visible:before:bg-brand focus-visible:outline-none',
        dragging && 'before:bg-brand before:w-0.5',
      )}
    />
  );
}
