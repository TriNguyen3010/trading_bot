import { useState, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { strings } from '@/i18n/en';
import { cn } from '@/lib/utils';

export interface CypheusInputProps {
  disabled?: boolean;
  onSubmit: (text: string) => void;
}

export function CypheusInput({ disabled, onSubmit }: CypheusInputProps) {
  const [value, setValue] = useState('');

  const trimmed = value.trim();
  const canSubmit = !disabled && trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2 bg-surface px-4 py-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={strings.cypheus.inputPlaceholder}
        disabled={disabled}
        className={cn(
          'flex-1 resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-fg placeholder:text-fg-muted',
          'transition-colors duration-fast focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-subtle',
          'min-h-[40px] max-h-[120px]',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      />
      <Button
        type="button"
        size="icon"
        variant={canSubmit ? 'primary' : 'secondary'}
        disabled={!canSubmit}
        onClick={submit}
        aria-label={strings.cypheus.send}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
