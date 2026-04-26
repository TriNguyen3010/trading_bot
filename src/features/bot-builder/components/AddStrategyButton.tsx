import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { strings } from '@/i18n/en';

export function AddStrategyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-transparent px-5 py-4 text-sm font-medium text-fg-secondary transition-colors duration-fast hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <Plus className="h-4 w-4" />
        <span>{strings.steps.addStrategy.title}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <DialogTitle>{strings.steps.addStrategy.comingSoon}</DialogTitle>
            <DialogDescription>
              Multi-strategy support is on the way. For now, you can configure
              one strategy per bot.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
