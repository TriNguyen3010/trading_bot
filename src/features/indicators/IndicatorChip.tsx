import { useState } from 'react';
import { Settings, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NumberInput } from '@/components/ui/number-input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import {
  INDICATOR_REGISTRY,
  indicatorOutputId,
} from './indicator-registry';
import type { IndicatorItem } from '@/types/builder.types';

export interface IndicatorChipProps {
  item: IndicatorItem;
  onChange: (next: IndicatorItem) => void;
  onRemove: () => void;
}

export function IndicatorChip({ item, onChange, onRemove }: IndicatorChipProps) {
  const def = INDICATOR_REGISTRY[item.name];
  const [open, setOpen] = useState(false);

  if (!def) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-danger px-3 py-1 text-xs text-danger">
        Unknown: {item.name}
        <button onClick={onRemove} aria-label="Remove">
          <X className="h-3 w-3" />
        </button>
      </span>
    );
  }

  const setParam = (key: string, value: number | string | null) => {
    onChange({
      ...item,
      parameters: { ...item.parameters, [key]: value ?? def.parameters.find((p) => p.key === key)?.default ?? 0 },
    });
  };

  const summary = indicatorOutputId(item);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-brand bg-brand-subtle pl-3 pr-1 py-1 text-sm',
      )}>
        <span className="font-medium text-fg">{summary}</span>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Edit ${def.name} parameters`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${def.name}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-fg-secondary transition-colors hover:bg-bearish/20 hover:text-bearish focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <PopoverContent className="w-72">
        <div className="mb-3">
          <p className="text-sm font-semibold text-fg">{def.name} parameters</p>
          <p className="mt-0.5 text-xs text-fg-muted">{def.description}</p>
        </div>
        <div className="flex flex-col gap-3">
          {def.parameters.map((p) => {
            const current = item.parameters[p.key];
            if (p.type === 'number') {
              return (
                <FormField key={p.key} label={p.label}>
                  <NumberInput
                    value={typeof current === 'number' ? current : Number(current ?? p.default)}
                    onValueChange={(v) => setParam(p.key, v)}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                  />
                </FormField>
              );
            }
            return (
              <FormField key={p.key} label={p.label}>
                <Select
                  value={String(current ?? p.default)}
                  onChange={(e) => setParam(p.key, e.target.value)}
                >
                  {p.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
