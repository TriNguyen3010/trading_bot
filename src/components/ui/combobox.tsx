import * as React from 'react';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  /** Forwarded to the trigger (e.g. for `data-cy-anchor`, `aria-label`). */
  triggerProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
}

/**
 * Searchable single-select dropdown: compact trigger → popover with a search
 * box and a scrollable, filtered option list. Built on the Radix Popover
 * primitive (carries `data-drawer-floating-layer`, so it won't close the
 * surrounding builder drawer).
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  className,
  triggerProps,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [query, options]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-2xl bg-black/40 px-4 text-sm text-fg',
            'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            className,
          )}
          {...triggerProps}
        >
          <span className={cn(!value && 'text-fg-muted')}>
            {value || placeholder}
          </span>
          <ChevronsUpDown aria-hidden className="ml-2 h-4 w-4 text-fg-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <div className="p-2">
          <Input
            autoFocus
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="max-h-60 overflow-y-auto pb-1" role="listbox">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-fg-muted">No results</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={o === value}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-white/5',
                  o === value ? 'text-brand' : 'text-fg',
                )}
                onClick={() => {
                  onChange(o);
                  close();
                }}
              >
                <span>{o}</span>
                {o === value && <Check aria-hidden className="h-4 w-4" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
