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

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <CypheusAvatar size="lg" />
        <div>
          <p className="text-sm font-medium text-fg">
            Cypheus is ready to help.
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            Send a message to start the demo build.
          </p>
        </div>
      </div>
    );
  }

  return (
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
  );
}
