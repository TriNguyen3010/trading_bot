import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface CypheusAvatarProps {
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
 * Static Cypheus avatar. The animated `hello.webm` / `coding.webm`
 * variants were tied to the magic-build script — removed alongside the
 * scripted demo. Re-introduce video variants when real AI ships.
 */
export function CypheusAvatar({
  size = 'md',
  className,
  layoutId,
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
      <img
        src="/cypheus/avatar.png"
        alt=""
        loading="eager"
        className={cn('h-full w-full object-cover', sizeClass)}
      />
    </Wrapper>
  );
}
