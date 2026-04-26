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
      {isCypheus ? <CypheusAvatar size="sm" /> : null}
      <div
        className={cn(
          'max-w-[280px] rounded-lg px-3 py-2 text-sm',
          isCypheus
            ? 'border-l-2 border-brand bg-surface text-fg'
            : 'bg-input text-fg',
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
