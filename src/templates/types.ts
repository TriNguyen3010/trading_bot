/**
 * Type definitions for bot templates — see Spec/Phase 1/bot_templates_plan.md.
 *
 * A `BotTemplate` is a static, pre-built BuilderState snapshot + metadata
 * for the gallery + an optional Cypheus narration script. The engine
 * (`animation.ts`) drives the same magic-build experience users already
 * see, just parameterised by the chosen template instead of hard-coded
 * Bollinger Breakout BTC.
 */
import type { BuilderState } from '@/types/builder.types';

export type TemplateDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type TemplateRisk = 'conservative' | 'balanced' | 'aggressive';

/** Subset of BuilderState that templates ship — UI-only / transient fields
 * (openStep, drawerTab, drawerWidth, isDirty, lastSavedAt, stepStatus) are
 * set by the engine, not by the template author. */
export type TemplateStateSnapshot = Pick<
  BuilderState,
  'botName' | 'botConfig' | 'strategy' | 'directionForm' | 'closeMethod'
>;

/** A single Cypheus chat line. We may upgrade to `{ text, delay }` objects
 * later; for now plain strings are enough. */
export type NarrationLine = string;

/** One narration "slot" can be a single line or a sequence played with
 * built-in inter-message delays. */
export type Narration = NarrationLine | readonly NarrationLine[];

/**
 * Cypheus narration hooks the engine plays at specific moments during
 * the animation. Every field is optional — when absent, the engine falls
 * back to a generic line derived from `template.name` / `description`.
 *
 * Phase 2's strategy hooks are sub-divided so a template can comment
 * after the entry conditions are filled but before direction is set, etc.
 */
export interface TemplateAnimationScript {
  intro?: Narration;
  phaseNarration?: {
    botBasics?: { pre?: Narration; post?: Narration };
    strategy?: {
      pre?: Narration;
      preEntry?: Narration;
      postEntry?: Narration;
      preDirection?: Narration;
      postDirection?: Narration;
      preClose?: Narration;
      postClose?: Narration;
      post?: Narration;
    };
  };
  /** Outro is split because the existing magic-build flow shows the
   * summary view between the two outro messages. */
  outro?: {
    preSummary?: Narration;
    postSummary?: Narration;
  };
}

export interface BotTemplate {
  /** Stable id used for tracking + (future) deeplinks. Lowercase-kebab. */
  id: string;
  /** Human-readable name shown on the card + chat narration. */
  name: string;
  /** 1-2 sentence description shown on the card. */
  description: string;
  /** Optional long-form description shown in the detail modal. */
  longDescription?: string;
  /** Free-form tags for filtering. */
  tags: readonly string[];
  difficulty: TemplateDifficulty;
  riskLevel: TemplateRisk;
  /** The builder state snapshot that gets applied. */
  state: TemplateStateSnapshot;
  /** Optional Cypheus narration override. Defaults work fine for a
   * generic template; only override when there's something interesting
   * to say. */
  script?: TemplateAnimationScript;
  meta: {
    author: 'Cypheus' | (string & {});
    /** State schema version — bump when BuilderState shape changes. The
     * engine rejects templates with an unknown version so we never
     * silently apply stale snapshots. */
    schemaVersion: number;
    createdAt: string; // ISO date
    updatedAt?: string;
  };
}

/** Current state schema version. Bump when BuilderState shape changes
 * AND make sure every template + the migrator (`apply.ts`) is updated. */
export const TEMPLATE_SCHEMA_VERSION = 2;
