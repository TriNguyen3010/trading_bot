/**
 * Type definitions for bot templates — see Spec/Phase 1/bot_templates_plan.md.
 *
 * A `BotTemplate` is a static, pre-built BuilderState snapshot + metadata
 * for the gallery. Templates snap-apply via `apply.ts`.
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
