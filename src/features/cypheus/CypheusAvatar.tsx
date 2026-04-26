import { cn } from '@/lib/utils';
import type { AvatarState } from './store/cypheus.store';

export interface CypheusAvatarProps {
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
 * Single-image avatar with CSS-driven state animations:
 *  - idle      : subtle pulse glow
 *  - thinking  : faster pulse + slight rotation
 *  - speaking  : strong pulse + brand-colored halo
 */
export function CypheusAvatar({
  state = 'idle',
  size = 'md',
  className,
}: CypheusAvatarProps) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full',
        'before:pointer-events-none before:absolute before:inset-0 before:rounded-full',
        sizeMap[size],
        state === 'idle' &&
          'before:animate-pulse before:bg-brand/10 before:[animation-duration:2400ms]',
        state === 'thinking' &&
          'before:animate-pulse before:bg-brand/15 before:[animation-duration:1100ms]',
        state === 'speaking' &&
          'before:animate-pulse before:bg-brand/30 before:[animation-duration:700ms] before:shadow-glow',
        className,
      )}
      aria-hidden
    >
      <img
        src="/cypheus/avatar.png"
        alt=""
        loading="eager"
        className={cn(
          'relative z-10 select-none rounded-full object-cover',
          sizeMap[size],
          state === 'thinking' && 'animate-spin [animation-duration:6s]',
        )}
      />
    </div>
  );
}
