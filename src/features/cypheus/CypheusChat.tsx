import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { useCypheusStore } from './store/cypheus.store';
import { CypheusAvatar } from './CypheusAvatar';

export function CypheusChat() {
  const messages = useCypheusStore((s) => s.messages);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <>
      <div className="flex items-center justify-center border-b border-border-subtle bg-canvas px-4 py-4">
        <CypheusAvatar size="lg" className="h-20 w-20" />
      </div>
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-medium text-fg">
            Cypheus is ready to help.
          </p>
          <p className="text-xs text-fg-muted">
            Send a message to start the demo build.
          </p>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin"
        >
          <div className="flex flex-col gap-3">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
