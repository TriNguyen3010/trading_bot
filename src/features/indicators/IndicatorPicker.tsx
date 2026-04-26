import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { INDICATOR_REGISTRY } from './indicator-registry';

export interface IndicatorPickerProps {
  onPick: (name: string) => void;
}

export function IndicatorPicker({ onPick }: IndicatorPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const all = Object.values(INDICATOR_REGISTRY);
  const filtered = all.filter(
    (def) =>
      !query ||
      def.name.toLowerCase().includes(query.toLowerCase()) ||
      def.description.toLowerCase().includes(query.toLowerCase()),
  );

  const handlePick = (name: string) => {
    onPick(name);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add indicator
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <div className="border-b border-border-subtle p-2">
          <Input
            placeholder="Search RSI, MA, MACD…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-1 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="p-3 text-xs text-fg-muted">
              No indicator matches "{query}".
            </div>
          ) : (
            filtered.map((def) => (
              <button
                key={def.name}
                type="button"
                onClick={() => handlePick(def.name)}
                className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
              >
                <span className="font-medium text-fg">{def.name}</span>
                <span className="text-xs text-fg-muted">
                  {def.description}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
