import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCypheusStore, type AvatarState } from './store/cypheus.store';

export interface CypheusAvatarProps {
  /** When omitted, the component subscribes to the cypheus store. */
  state?: AvatarState;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Framer Motion layoutId for shared element transitions. */
  layoutId?: string;
}

const sizeMap = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
} as const;

/**
 * Avatar with three asset variants:
 *  - idle   → static avatar.png
 *  - hello  → hello.webm (one-shot; auto-reverts to idle on end)
 *  - coding → coding.webm (loops while Cypheus builds)
 */
export function CypheusAvatar({
  state: stateProp,
  size = 'md',
  className,
  layoutId,
}: CypheusAvatarProps) {
  const setAvatar = useCypheusStore((s) => s.setAvatar);
  const storeState = useCypheusStore((s) => s.avatar);
  const state: AvatarState = stateProp ?? storeState;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Replay from the start whenever the source changes so a re-trigger
  // (idle → hello → idle → hello) doesn't show the last frame first.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play().catch(() => {
      /* autoplay may be blocked; static fallback already covers it */
    });
  }, [state]);

  const sizeClass = sizeMap[size];
  const wrapperClass = cn(
    'relative flex select-none items-center justify-center overflow-hidden rounded-full',
    sizeClass,
    className,
  );

  const Wrapper = layoutId ? motion.div : 'div';
  const wrapperProps = layoutId
    ? { layoutId, transition: { duration: 0.4, ease: 'easeOut' as const } }
    : {};

  if (state === 'hello' || state === 'coding') {
    const isHello = state === 'hello';
    return (
      <Wrapper className={wrapperClass} aria-hidden {...wrapperProps}>
        <ChromaKeyDef />
        <video
          ref={videoRef}
          src={isHello ? '/cypheus/hello.webm' : '/cypheus/coding.webm'}
          autoPlay
          muted
          playsInline
          loop={!isHello}
          onEnded={() => {
            if (isHello) setAvatar('idle');
          }}
          style={{ filter: 'url(#cypheus-chroma-green)' }}
          className={cn('h-full w-full object-cover', sizeClass)}
        />
      </Wrapper>
    );
  }

  return (
    <Wrapper className={wrapperClass} aria-hidden {...wrapperProps}>
      <img
        src="/cypheus/avatar.png"
        alt=""
        loading="eager"
        className={cn('h-full w-full object-cover', sizeClass)}
      />
    </Wrapper>
  );
}

/**
 * Chroma-key SVG filter for solid-green-screen webm.
 *
 * Alpha row: alpha = 2*R - 2*G + 2*B
 *   pure green   (0, 1, 0)   → -2  → clamped to 0  (transparent)
 *   pure white   (1, 1, 1)   →  2  → clamped to 1  (opaque)
 *   skin/orange  (.9,.7,.5)  →  1.0 → opaque
 *   blue / red               → opaque
 *   yellow (1,1,0) is the casualty — turned transparent, but the
 *   avatar shouldn't contain pure yellow.
 */
function ChromaKeyDef() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: 'absolute', pointerEvents: 'none' }}
      aria-hidden
    >
      <defs>
        <filter
          id="cypheus-chroma-green"
          colorInterpolationFilters="sRGB"
          x="0"
          y="0"
          width="100%"
          height="100%"
        >
          <feColorMatrix
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              2 -2 2 0 0
            "
          />
        </filter>
      </defs>
    </svg>
  );
}
