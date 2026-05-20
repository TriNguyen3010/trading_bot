import { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { useCypheusStore } from './store/cypheus.store';
export function CypheusChat() {
  const messages = useCypheusStore((s) => s.messages);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div
      ref={scrollerRef}
      className="scrollbar-thin flex-1 overflow-y-auto px-4 py-3"
    >
      <div className="flex flex-col gap-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>
    </div>
  );
}
