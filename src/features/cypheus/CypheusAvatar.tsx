import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useCypheusStore, type AvatarState } from './store/cypheus.store';

export interface CypheusAvatarProps {
  /** When omitted, the component subscribes to the cypheus store. */
  state?: AvatarState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
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

  if (state === 'hello' || state === 'coding') {
    const isHello = state === 'hello';
    return (
      <div className={wrapperClass} aria-hidden>
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
          className={cn('h-full w-full object-cover', sizeClass)}
        />
      </div>
    );
  }

  return (
    <div className={wrapperClass} aria-hidden>
      <img
        src="/cypheus/avatar.png"
        alt=""
        loading="eager"
        className={cn('h-full w-full object-cover', sizeClass)}
      />
    </div>
  );
}
