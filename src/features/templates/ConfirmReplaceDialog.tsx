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
          <DialogTitle>Replace your current bot?</DialogTitle>
          <DialogDescription>
            Loading <span className="font-medium text-fg">{template?.name}</span>{' '}
            will discard your unsaved changes. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Replace and load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
