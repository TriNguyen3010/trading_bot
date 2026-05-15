import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface MetricOption {
  value: string;
  label: string;
  category?: string;
  description?: string;
}

export interface MetricComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: MetricOption[];
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
  emptyMessage?: string;
}

const ALL = '__all__';

export function MetricCombobox({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  placeholder = 'Select metric…',
  emptyMessage = 'No metrics match.',
}: MetricComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL);

  const selected = options.find((o) => o.value === value);

  // Categories preserve first-appearance order so callers can drive layout
  // (e.g. Candle first, then indicator families). Counts respect the
  // search filter so users can see "Momentum · 0" disappear when filtered.
  const { categories, filtered } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (o: MetricOption) =>
      q === '' || o.label.toLowerCase().includes(q);

    const filtered = options.filter((o) => {
      if (!matchesQuery(o)) return false;
      if (activeCategory !== ALL && o.category !== activeCategory) return false;
      return true;
    });

    const counts = new Map<string, number>();
    const seen: string[] = [];
    for (const o of options) {
      const cat = o.category ?? 'Other';
      if (!counts.has(cat)) {
        counts.set(cat, 0);
        seen.push(cat);
      }
      if (matchesQuery(o)) counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return {
      categories: seen.map((name) => ({ name, count: counts.get(name) ?? 0 })),
      filtered,
    };
  }, [options, query, activeCategory]);

  // Stable per-category ordered groups for the list — keeps "Candle / RSI /
  // MACD / MA / BB" rendering predictable even after filtering.
  const grouped = useMemo(() => {
    const groups = new Map<string, MetricOption[]>();
    for (const o of filtered) {
      const cat = o.category ?? 'Other';
      const arr = groups.get(cat) ?? [];
      arr.push(o);
      groups.set(cat, arr);
    }
    return [...groups.entries()];
  }, [filtered]);

  const totalMatches = filtered.length;

  const pickAndClose = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
    setActiveCategory(ALL);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery('');
          setActiveCategory(ALL);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className={cn(
            'flex h-11 w-full items-center justify-between rounded-2xl bg-black/40 pl-4 pr-3 text-left text-sm text-fg',
            'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            'disabled:cursor-not-allowed disabled:opacity-60',
            className,
          )}
        >
          <span className={cn('truncate', !selected && 'text-fg-muted')}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown
            aria-hidden
            className="ml-2 h-4 w-4 shrink-0 text-fg-muted"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[320px] p-0 overflow-hidden"
        align="start"
        sideOffset={6}
      >
        {/* Search */}
        <div className="border-b border-border-subtle px-2.5 py-2">
          <div className="flex items-center gap-2 rounded-md bg-black/40 px-2.5 py-1.5">
            <Search aria-hidden className="h-3.5 w-3.5 text-fg-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search candle / indicator…"
              className="w-full bg-transparent text-[13px] text-fg placeholder:text-fg-muted focus:outline-none"
            />
          </div>
        </div>

        {/* Category strip (only when ≥2 categories exist) */}
        {categories.length >= 2 ? (
          <div className="flex gap-1 overflow-x-auto border-b border-border-subtle px-2 py-1.5">
            <CategoryChip
              name="All"
              count={totalMatches}
              active={activeCategory === ALL}
              onClick={() => setActiveCategory(ALL)}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.name}
                name={c.name}
                count={c.count}
                active={activeCategory === c.name}
                disabled={c.count === 0}
                onClick={() => setActiveCategory(c.name)}
              />
            ))}
          </div>
        ) : null}

        {/* Options list */}
        <div
          role="listbox"
          className="max-h-72 overflow-y-auto py-1 scrollbar-thin"
        >
          {totalMatches === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-fg-muted">
              {emptyMessage}
            </div>
          ) : (
            grouped.map(([category, items]) => (
              <div key={category}>
                <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                  {category}
                </div>
                {items.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => pickAndClose(opt.value)}
                      className={cn(
                        'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] text-fg',
                        'hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-surface-hover',
                        isSelected && 'bg-brand-subtle',
                      )}
                    >
                      <span className="flex-1 min-w-0 truncate">
                        <span className={cn(isSelected && 'text-brand font-medium')}>
                          {opt.label}
                        </span>
                        {opt.description ? (
                          <span className="ml-2 text-[11px] text-fg-muted">
                            {opt.description}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Check
                          aria-hidden
                          className="h-3.5 w-3.5 shrink-0 text-brand"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface CategoryChipProps {
  name: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function CategoryChip({
  name,
  count,
  active,
  disabled,
  onClick,
}: CategoryChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] transition-colors',
        active
          ? 'bg-brand font-semibold text-black'
          : 'border border-border text-fg-secondary hover:border-brand hover:text-brand',
        disabled && 'opacity-40 hover:border-border hover:text-fg-secondary',
      )}
    >
      {name} <span className={cn(!active && 'text-fg-muted')}>· {count}</span>
    </button>
  );
}
