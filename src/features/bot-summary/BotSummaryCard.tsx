/**
 * Read-only card that explains what the bot will do, derived live from
 * BuilderState via the rule-based translators in `./translators`.
 *
 * HYBRID 4-layer behaviour per Spec/Phase 1/bot_summary_plan.md §3 + §13:
 *   L1 pristine (configuredPhaseCount === 0) → render nothing.
 *   L2 partial / L3 simple                  → render with all sections expanded.
 *   L4 complex                              → auto-collapse Entry / Exit
 *                                             when their line count exceeds
 *                                             a threshold (3 lines).
 *
 * Gap footer surfaces translator misses honestly so users know exactly
 * which field isn't represented in the prose.
 */
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  ChevronDown,
  LogOut,
  MapPin,
  Shield,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { configuredPhaseCount } from '@/lib/phase-helpers';
import { strings } from '@/i18n/en';
import { summarizeBot } from './summarize';
import type {
  SummaryBlock,
  SummaryInline,
  SummaryLine,
} from './types';

/** Map of icon-name strings emitted by the translator → Lucide components.
 * Kept here so the translator stays React-free. */
const ICON_MAP: Record<SummaryBlock['icon'], LucideIcon> = {
  MapPin,
  Shield,
  TrendingUp,
  Target,
  LogOut,
  Bell,
};

/** A block is "complex" when its line count exceeds the threshold for that
 * section. Tuned so the Cypheus-default template (1 entry condition,
 * 2 TP levels + 1 SL) stays expanded — only multi-rule strategies trip
 * the auto-collapse. */
function isComplexBlock(block: SummaryBlock): boolean {
  if (block.id === 'entry' && block.lines.length > 3) return true;
  if (block.id === 'exit' && block.lines.length > 3) return true;
  return false;
}

export function BotSummaryCard() {
  const builderState = useBuilderStore();

  // Layer 1: pristine state → render nothing. Empty-state CTA already
  // covers "what to do next"; we don't want to add a stub here.
  const phaseCount = configuredPhaseCount(builderState);

  const result = useMemo(() => summarizeBot(builderState), [builderState]);

  if (phaseCount === 0) return null;

  const { blocks, gaps } = result;

  return (
    <section
      aria-label={strings.botSummary.title}
      className={cn(
        // Sizing is controlled by the parent (BotBuilderCanvas grid). We
        // only own the chrome here — border, surface bg, transitions.
        'w-full rounded-xl border border-brand/15 bg-surface',
        'transition-colors duration-fast',
      )}
    >
      <header className="flex items-center gap-2 border-b border-border-subtle px-5 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-subtle text-brand">
          <BookOpen className="h-4 w-4" aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fg">
          {strings.botSummary.title}
        </h3>
      </header>

      <div className="space-y-4 px-5 py-4">
        {blocks.map((block) => (
          <SummaryBlockRow key={block.id} block={block} />
        ))}
      </div>

      {gaps.length > 0 && <GapFooter gaps={gaps} />}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Block row                                                                  */
/* -------------------------------------------------------------------------- */

function SummaryBlockRow({ block }: { block: SummaryBlock }) {
  const Icon = ICON_MAP[block.icon];
  const collapsible = isComplexBlock(block);
  const [open, setOpen] = useState(!collapsible);

  // Always render header. Body either always-on (simple) or behind
  // a chevron toggle (complex).
  const visibleLines = open ? block.lines : block.lines.slice(0, 1);
  const hiddenLineCount = block.lines.length - 1;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-fg-muted">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {block.title}
        </h4>
        {block.warning && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-bearish/40 bg-bearish-subtle px-2 py-0.5 text-2xs text-bearish"
            role="status"
            title={block.warning}
          >
            <AlertTriangle className="h-2.5 w-2.5" aria-hidden="true" />
            <span className="truncate max-w-[16rem]">{block.warning}</span>
          </span>
        )}
      </div>

      <div className="space-y-1 text-sm leading-relaxed text-fg-secondary">
        {visibleLines.map((line, i) => (
          <Line key={i} line={line} />
        ))}
      </div>

      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'mt-1.5 inline-flex items-center gap-1 text-2xs font-medium text-brand',
            'transition-colors duration-fast hover:text-brand-hover',
            'focus-visible:outline-none focus-visible:underline',
          )}
          aria-expanded={open}
        >
          {open
            ? strings.botSummary.hideDetails
            : strings.botSummary.showDetails(hiddenLineCount)}
          <ChevronDown
            className={cn(
              'h-3 w-3 transition-transform duration-fast',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  );
}

function Line({ line }: { line: SummaryLine }) {
  return (
    <p className="text-fg-secondary">
      {line.map((inline, i) => (
        <Inline key={i} inline={inline} />
      ))}
    </p>
  );
}

function Inline({ inline }: { inline: SummaryInline }) {
  if (!inline.tone || inline.tone === 'default') {
    return <span>{inline.text}</span>;
  }
  return (
    <span
      className={cn(
        inline.tone === 'bullish' && 'text-bullish font-medium',
        inline.tone === 'bearish' && 'text-bearish font-medium',
        inline.tone === 'warning' && 'text-brand font-medium',
      )}
    >
      {inline.text}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Gap footer                                                                 */
/* -------------------------------------------------------------------------- */

function GapFooter({ gaps }: { gaps: ReturnType<typeof summarizeBot>['gaps'] }) {
  return (
    <footer
      role="alert"
      className="flex flex-col gap-1 border-t border-border-subtle px-5 py-3"
    >
      <div className="flex items-center gap-1.5 text-2xs font-medium text-bearish">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {strings.botSummary.gapsHeader(gaps.length)}
      </div>
      <ul className="ml-4 list-disc space-y-0.5 text-2xs text-fg-secondary">
        {gaps.map((g, i) => (
          <li key={i}>
            <span className="font-medium text-fg">{g.field}</span>
            {': '}
            {g.reason}
            {g.rawValue !== 'null' && (
              <>
                {' '}
                <code className="rounded bg-canvas px-1 text-fg-muted">
                  {g.rawValue}
                </code>
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-2xs text-fg-muted">
        {strings.botSummary.gapsFooter}
      </p>
    </footer>
  );
}
