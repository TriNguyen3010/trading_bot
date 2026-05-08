import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from './store/cypheus.store';
import { useTemplateTrackingStore } from '@/templates';
import { abortAllScripts } from './script/script-runner';
import { runGreeting } from './script/greeting.script';
import { strings } from '@/i18n/en';

export function CreateNewBotButton() {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    // Cancel any in-flight Cypheus script first so it doesn't race the
    // reset and re-fill the form.
    abortAllScripts();
    // resetAll() updates the persisted store, which writes the empty state
    // back to localStorage automatically — no explicit removeItem needed.
    useBuilderStore.getState().resetAll();
    useCypheusStore.getState().resetAll();
    // Drop the "Based on …" header badge — the user is starting fresh,
    // there's no longer a source template to reference. Per plan §11 D3:
    // template tracking persists until an explicit reset like this.
    useTemplateTrackingStore.getState().clearApplied();
    setOpen(false);
    // Restart greeting flow.
    void runGreeting();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-full card-coin98 px-3 py-2.5 text-xs font-medium text-fg-secondary transition-colors hover:bg-brand-subtle hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {strings.cypheus.createNewBot}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{strings.cypheus.confirmReset.title}</DialogTitle>
            <DialogDescription>
              {strings.cypheus.confirmReset.body}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {strings.cypheus.confirmReset.cancel}
            </Button>
            <Button variant="destructive" onClick={handleConfirm}>
              {strings.cypheus.confirmReset.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
