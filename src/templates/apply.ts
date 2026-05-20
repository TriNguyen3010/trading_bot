/**
 * `applyTemplate(template, opts)` — the user-facing entry point that
 * snap-applies a template snapshot to the builder, and surfaces a
 * `TemplateConflictError` when the current builder state is dirty so
 * the caller (gallery/detail modal) can render the confirm dialog.
 *
 * See Spec/Phase 1/bot_templates_plan.md §6.
 */
import { toast } from 'sonner';
import { useBuilderStore } from '@/features/bot-builder/store/builder.store';
import { useCypheusStore } from '@/features/cypheus/store/cypheus.store';
import { strings } from '@/i18n/en';
import type { StepId, StepStatus } from '@/types/builder.types';
import { useTemplateTrackingStore } from './store';
import {
  TEMPLATE_SCHEMA_VERSION,
  type BotTemplate,
  type TemplateStateSnapshot,
} from './types';

export class TemplateConflictError extends Error {
  constructor(message = 'Builder state is dirty — confirm replace.') {
    super(message);
    this.name = 'TemplateConflictError';
  }
}

export interface ApplyTemplateOptions {
  /** Skip the dirty-state guard. The gallery/detail modal sets this
   * after the user confirms the replace. */
  force?: boolean;
}

/**
 * Apply a template to the builder. Snap-applies the state synchronously.
 *
 * Throws `TemplateConflictError` synchronously when state.isDirty=true
 * and `force` isn't set — caller catches and shows a confirm dialog.
 */
export async function applyTemplate(
  template: BotTemplate,
  opts: ApplyTemplateOptions = {},
): Promise<void> {
  const state = useBuilderStore.getState();

  if (state.isDirty && !opts.force) {
    throw new TemplateConflictError();
  }

  // Migration hook — currently a no-op for v2 (the only supported
  // version). When BuilderState shape changes, bump
  // TEMPLATE_SCHEMA_VERSION and add an `if (fromVersion === 2)` branch
  // mapping old fields → new shape.
  const migrated = migrateTemplateSnapshot(
    template.state,
    template.meta.schemaVersion,
  );

  snapApply(template, migrated);
}

/* -------------------------------------------------------------------------- */
/*  Internals                                                                  */
/* -------------------------------------------------------------------------- */

function snapApply(template: BotTemplate, snap: TemplateStateSnapshot): void {
  const builder = useBuilderStore.getState();
  builder.resetAll();
  builder.setBotName(snap.botName);
  builder.patchBotConfig(snap.botConfig);
  builder.patchStrategy(snap.strategy);
  builder.patchDirection(snap.directionForm);
  builder.patchCloseMethod(snap.closeMethod);

  // Mark every sub-step configured so the canvas immediately shows the
  // "ready to export" state.
  const allConfigured: Record<StepId, StepStatus> = {
    'bot-config': 'configured',
    'entry-strategy': 'configured',
    direction: 'configured',
    'close-method': 'configured',
  };
  (Object.keys(allConfigured) as StepId[]).forEach((id) =>
    builder.setStepStatus(id, allConfigured[id]),
  );

  // Friendly chat line + tracking + toast.
  useCypheusStore.getState().pushMessage({
    role: 'cypheus',
    text: strings.templates.apply.loadedChat(template.name),
  });
  useTemplateTrackingStore.getState().setApplied(template.id);
  toast.success(strings.templates.apply.loadedToast(template.name));
}

function migrateTemplateSnapshot(
  snap: TemplateStateSnapshot,
  fromVersion: number,
): TemplateStateSnapshot {
  if (fromVersion === TEMPLATE_SCHEMA_VERSION) return snap;
  throw new Error(
    `Template schemaVersion ${fromVersion} not supported (current: ${TEMPLATE_SCHEMA_VERSION}). ` +
      'Update the template or add a migration branch.',
  );
}
