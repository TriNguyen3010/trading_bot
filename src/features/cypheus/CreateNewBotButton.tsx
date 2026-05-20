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
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-10 rounded-full px-3"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {strings.cypheus.createNewBot}
      </Button>
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
