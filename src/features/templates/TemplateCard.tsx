import type { MouseEvent } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { BotTemplate, TemplateDifficulty, TemplateRisk } from '@/templates';

const DIFFICULTY_TONE: Record<TemplateDifficulty, string> = {
  beginner: 'text-bullish',
  intermediate: 'text-brand',
  advanced: 'text-bearish',
};

const DIFFICULTY_DOT: Record<TemplateDifficulty, string> = {
  beginner: 'bg-bullish',
  intermediate: 'bg-brand',
  advanced: 'bg-bearish',
};

const RISK_LABEL: Record<TemplateRisk, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

export interface TemplateCardProps {
  template: BotTemplate;
  /** Receives the click event so the dialog can detect Shift-click to
   * route to the skip-animation path (decision D2). */
  onUse: (template: BotTemplate, event: MouseEvent<HTMLButtonElement>) => void;
  /** Optional: clicking the card body (anywhere outside the Use button)
   * triggers the detail-modal preview. Wired by TemplatesDialog. */
  onPreview?: (template: BotTemplate) => void;
}

/**
 * One card in the templates gallery. Renders metadata badges, a 1-2
 * sentence description, the tag list, and a primary "Use →" CTA.
 *
 * Body click → opens the detail-modal preview (PR-T4). The "Use →" button
 * stops propagation so power users can apply directly from the gallery
 * without going through the modal. Shift+click on Use skips the Cypheus
 * animation (per plan D2).
 */
export function TemplateCard({ template, onUse, onPreview }: TemplateCardProps) {
  const handleBodyClick = () => {
    if (onPreview) onPreview(template);
  };

  return (
    <article
      onClick={handleBodyClick}
      role={onPreview ? 'button' : undefined}
      tabIndex={onPreview ? 0 : undefined}
      onKeyDown={(e) => {
        if (onPreview && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onPreview(template);
        }
      }}
      aria-label={onPreview ? `Preview ${template.name}` : undefined}
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-border bg-surface p-5',
        'transition-colors duration-fast hover:border-brand/60',
        onPreview &&
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
      )}
    >
      <header className="flex items-center justify-between gap-2 text-2xs uppercase tracking-wide">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 font-semibold',
            DIFFICULTY_TONE[template.difficulty],
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              DIFFICULTY_DOT[template.difficulty],
            )}
          />
          {template.difficulty}
        </span>
        <span className="text-fg-muted">{RISK_LABEL[template.riskLevel]}</span>
      </header>

      <div>
        <h3 className="text-md font-semibold text-fg">{template.name}</h3>
        <p className="mt-1 text-sm text-fg-secondary">
          {template.description}
        </p>
      </div>

      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {template.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-5 items-center rounded-full border border-border-subtle bg-canvas px-2 text-2xs text-fg-muted"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-2xs text-fg-muted">
          <Sparkles className="mr-1 inline h-3 w-3" />
          Cypheus animates the setup
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={(e) => {
            // Stop propagation so the surrounding card's onPreview
            // handler doesn't fire alongside applyTemplate.
            e.stopPropagation();
            onUse(template, e);
          }}
          aria-label={`Use ${template.name}`}
        >
          Use
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
}
