import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface CypheusAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** Framer Motion layoutId for shared element transitions. */
  layoutId?: string;
  /**
   * Which Cypheus pose to render.
   *   'static' (default) — the PNG avatar.
   *   'hello'  — looping alpha `hello-alpha.webm` for the Phase 1 idle hero.
   */
  variant?: 'static' | 'hello';
}

const sizeMap = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
} as const;

/**
 * Cypheus avatar — static PNG by default, or a looping webm for the
 * `hello` pose (used as the Phase 1 idle hero on the canvas). Other
 * animated variants (e.g. `coding`) will land alongside as real flows
 * need them; the surface stays identical so callers don't care which
 * pose is mounted.
 */
export function CypheusAvatar({
  size = 'md',
  className,
  layoutId,
  variant = 'static',
}: CypheusAvatarProps) {
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

  return (
    <Wrapper className={wrapperClass} aria-hidden {...wrapperProps}>
      {variant === 'hello' ? (
        <video
          src="/cypheus/hello-alpha.webm"
          autoPlay
          loop
          muted
          playsInline
          className={cn('h-full w-full object-cover', sizeClass)}
        />
      ) : (
        <img
          src="/cypheus/avatar.png"
          alt=""
          loading="eager"
          className={cn('h-full w-full object-cover', sizeClass)}
        />
      )}
    </Wrapper>
  );
}
