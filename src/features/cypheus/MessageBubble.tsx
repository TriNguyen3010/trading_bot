import { cn } from '@/lib/utils';
import { CypheusAvatar } from './CypheusAvatar';
import type { ChatMessage } from './store/cypheus.store';

export interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isCypheus = message.role === 'cypheus';
  return (
    <div
      className={cn(
        'flex w-full gap-3',
        isCypheus ? 'justify-start' : 'justify-end',
      )}
    >
      {isCypheus ? <CypheusAvatar size="sm" state="idle" /> : null}
      <div
        className={cn(
          'max-w-[280px] rounded-2xl px-3.5 py-2.5 text-sm',
          isCypheus
            ? 'card-coin98 text-fg shadow-[0_0_0_1px_rgba(240,185,11,0.15)]'
            : 'bg-brand text-black font-medium shadow-[0_0_10px_rgba(240,185,11,0.3)]',
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">
          {message.text}
          {message.typing ? (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-brand align-middle"
            />
          ) : null}
        </p>
      </div>
    </div>
  );
}
