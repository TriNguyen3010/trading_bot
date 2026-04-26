import { useState, useRef } from 'react';
import { Upload, FileWarning } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { bundleSchema } from '@/schemas/bundle.schema';
import { deserializeBundle } from '@/lib/serializer';
import { readTextFile } from './file-utils';

export interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const [textInput, setTextInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleApply = (raw: string) => {
    setError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : 'parse error'}`);
      return;
    }
    const result = bundleSchema.safeParse(parsed);
    if (!result.success) {
      setError(
        result.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('\n'),
      );
      return;
    }

    try {
      const next = deserializeBundle(result.data);
      const store = useBuilderStore.getState();
      store.setBotName(next.botName);
      store.patchBotConfig(next.botConfig);
      store.patchStrategy(next.strategy);
      store.patchDirection(next.directionForm);
      store.patchCloseMethod(next.closeMethod);
      store.setStepStatus('bot-config', 'configured');
      store.setStepStatus('entry-strategy', 'configured');
      store.setStepStatus('direction', 'configured');
      store.setStepStatus('close-method', 'configured');
      toast.success('Bundle imported.');
      onOpenChange(false);
      setTextInput('');
    } catch (e) {
      setError(
        `Failed to apply bundle: ${e instanceof Error ? e.message : 'unknown error'}`,
      );
    }
  };

  const handleFile = async (file: File) => {
    const text = await readTextFile(file);
    handleApply(text);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import bundle</DialogTitle>
          <DialogDescription>
            Paste a previously exported <code>.bundle.json</code> or upload a
            file. Existing configuration is replaced when import succeeds.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            className="self-start"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload .json
          </Button>

          <div className="text-xs uppercase tracking-wide text-fg-muted">
            Or paste JSON
          </div>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder='{"bot": {...}, "strategy": {...}}'
            className="min-h-[160px] w-full rounded-md border border-border bg-input p-3 font-mono text-xs text-fg placeholder:text-fg-muted focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-subtle"
          />

          {error ? (
            <div className="rounded-lg border border-danger/40 bg-bearish-subtle p-3 text-xs text-bearish">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <FileWarning className="h-3.5 w-3.5" />
                Import failed
              </div>
              <pre className="whitespace-pre-wrap font-mono">{error}</pre>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!textInput.trim()}
            onClick={() => handleApply(textInput)}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
