import { Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from './store/cypheus.store';
import { strings } from '@/i18n/en';

export function JsonEmptyState() {
  const setOpenStep = useBuilderStore((s) => s.setOpenStep);
  const setPanelTab = useCypheusStore((s) => s.setPanelTab);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <Braces className="h-10 w-10 text-fg-muted opacity-40" aria-hidden />
      <div className="space-y-1">
        <p className="text-sm font-medium text-fg-secondary">
          {strings.cypheus.json.emptyTitle}
        </p>
        <p className="text-xs text-fg-muted">
          {strings.cypheus.json.emptySubtitle}
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpenStep('bot-config')}
        >
          {strings.cypheus.json.emptyCtaConfig}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setPanelTab('cypheus')}
        >
          {strings.cypheus.json.emptyCtaAsk}
        </Button>
      </div>
    </div>
  );
}
