/**
 * Type definitions for the bot summary translator —
 * Spec/Phase 1/bot_summary_plan.md §13.
 *
 * Output is structured rather than a single string so the React
 * renderer can apply tone-based color (bullish green / bearish red /
 * warning yellow) inline without re-parsing the text.
 */

/** Color tone applied to inline text fragments. Trading semantics here
 * intentionally diverge from `card_yellow_stages_plan.md` — long/short
 * are domain colors, not UI status. */
export type SummaryTone = 'default' | 'bullish' | 'bearish' | 'warning';

/** A single inline fragment with optional tone. */
export interface SummaryInline {
  text: string;
  tone?: SummaryTone;
}

/** A line is a sequence of inlines — most have just one. */
export type SummaryLine = SummaryInline[];

/** Stable id of a section in the rendered summary card. */
export type SummaryBlockId =
  | 'market'
  | 'risk'
  | 'entry'
  | 'action'
  | 'exit'
  | 'notifications';

export interface SummaryBlock {
  id: SummaryBlockId;
  /** lucide-react icon name. Resolved to a component in BotSummaryCard. */
  icon: 'MapPin' | 'Shield' | 'TrendingUp' | 'Target' | 'LogOut' | 'Bell';
  title: string;
  /** Empty array means the section is not applicable yet — renderer
   * decides whether to render an "—" placeholder or hide the block. */
  lines: SummaryLine[];
  /** Soft warning surfaced on the block header (e.g. high leverage). */
  warning?: string;
}

/** A field the translator could not decode. Surfaced in the rendered
 * footer so users know what's missing rather than getting silent
 * misrepresentation. */
export interface TranslationGap {
  section: SummaryBlockId;
  field: string;
  rawValue: string;
  reason: string;
}

export interface SummarizeResult {
  blocks: SummaryBlock[];
  gaps: TranslationGap[];
}

/* -------------------------------------------------------------------------- */
/*  Inline / line constructors — used heavily by translators                   */
/* -------------------------------------------------------------------------- */

/** Build a tone-tagged inline fragment. Helper kept short because it
 * appears 100s of times in translator code. */
export function t(text: string, tone?: SummaryTone): SummaryInline {
  return tone ? { text, tone } : { text };
}

/** Build a line from a sequence of inlines. */
export function line(...inlines: SummaryInline[]): SummaryLine {
  return inlines;
}
