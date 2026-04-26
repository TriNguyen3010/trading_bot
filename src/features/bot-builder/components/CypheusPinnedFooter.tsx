import { Sparkles } from 'lucide-react';
import { strings } from '@/i18n/en';

/**
 * Footer shown inside the StepDrawer while Cypheus is in pinned mode. Replaces
 * the Cancel / Save / Save & Next buttons with a passive status row so the
 * user can't disrupt the running script.
 */
export function CypheusPinnedFooter() {
  return (
    <div className="flex items-center justify-center gap-2 border-t border-border-subtle px-6 py-4 text-sm text-fg-secondary">
      <Sparkles className="h-4 w-4 animate-pulse text-brand" aria-hidden />
      <span>⚡ {strings.cypheus.magicBuild.pinnedFooter}</span>
    </div>
  );
}
