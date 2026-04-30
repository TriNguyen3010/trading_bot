import { AlertTriangle } from 'lucide-react';
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
import type { BotTemplate } from '@/templates';

export interface ConfirmReplaceDialogProps {
  template: BotTemplate | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shown when the user picks a template while their builder state is
 * dirty. Applying would discard their in-progress work, so we surface
 * the trade-off explicitly before committing.
 */
export function ConfirmReplaceDialog({
  template,
  onConfirm,
  onCancel,
}: ConfirmReplaceDialogProps) {
  const open = template !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-bearish-subtle text-bearish">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>{strings.templates.confirmReplace.title}</DialogTitle>
          <DialogDescription>
            {/* The template name is interpolated into the body string for
             * locale-correct quoting; the prose stays as one phrase. */}
            {template
              ? strings.templates.confirmReplace.body(template.name)
              : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {strings.templates.confirmReplace.cancel}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {strings.templates.confirmReplace.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
