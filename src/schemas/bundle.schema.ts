import { z } from 'zod';
import { botPayloadSchema } from './bot.schema';
import { strategyPayloadSchema } from './strategy.schema';

/**
 * @deprecated Use `unifiedBotStrategyCreateSchema` from
 * `./unified-bot-strategy.schema.ts` for new code. This bundle is retained
 * only for the existing Export/Import flow which still produces the
 * 2-payload split (`{bot, strategy}`). Once that flow is migrated to
 * `UnifiedBotStrategyCreate` (see `Data/IMPLEMENTATION_PLAN.md` Step 3 +
 * `serializer.ts buildUnifiedPayload`), this file can be removed.
 *
 * 1-file export bundle: { bot, strategy }. The user's MVP decision
 * (2026-04-25) was to ship a single bundle file rather than two separate
 * files. The shape is straightforward and can be split client-side at
 * import time if the backend ever wants 2 endpoints.
 */
export const bundleSchema = z.object({
  bot: botPayloadSchema,
  strategy: strategyPayloadSchema,
  meta: z
    .object({
      schema_version: z.literal(1),
      exported_at: z.string(),
      builder_version: z.string().optional(),
    })
    .optional(),
});

export type Bundle = z.infer<typeof bundleSchema>;
