import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { strings } from '@/i18n/en';

/**
 * Inline editor for the bot's name. Mounted as the Phase 1 step card's
 * title node — click the label to swap it for an `<input>`, Enter or
 * blur commits, Esc cancels. Click events stop propagating so opening
 * the editor never accidentally triggers the parent card's drawer.
 */
export function BotNameEditor() {
  const botName = useBuilderStore((s) => s.botName);
  const setBotName = useBuilderStore((s) => s.setBotName);
  const [isEditing, setEditing] = useState(false);
  const [draft, setDraft] = useState(botName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(botName);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, botName]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== botName) setBotName(trimmed);
    setEditing(false);
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder={strings.header.botNamePlaceholder}
        className="h-8 w-full max-w-[18rem] text-md font-semibold"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      className="group inline-flex items-center gap-2 truncate rounded-md px-1 text-md font-semibold text-fg transition-colors hover:bg-black/30"
      aria-label="Edit bot name"
    >
      <span className="truncate">{botName || strings.header.botNamePlaceholder}</span>
      <Pencil className="h-3.5 w-3.5 shrink-0 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
