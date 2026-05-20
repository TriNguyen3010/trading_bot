import { z } from 'zod';

/**
 * Mirrors `Data/payload_create_bot.json`.
 */

export const telegramNotificationSettingsSchema = z.object({
  entry_fill: z.enum(['on', 'off']),
  exit_fill: z.enum(['on', 'off']),
  protection_trigger: z.enum(['on', 'off']),
  protection_trigger_global: z.enum(['on', 'off']),
});

export const telegramSchema = z.object({
  enabled: z.boolean(),
  token: z.string(),
  chat_id: z.string(),
  allow_custom_messages: z.boolean(),
  notification_settings: telegramNotificationSettingsSchema,
});

export const botPayloadSchema = z.object({
  bot_name: z.string().min(1),
  exchange_name: z.string(),
  strategy_name: z.string(),
  dry_run: z.boolean(),
  stake_currency: z.string(),
  stake_amount: z.number(),
  max_open_trades: z.number().int(),
  timeframe: z.string(),
  pair: z.string(),
  dry_run_wallet: z.number(),
  trading_mode: z.enum(['spot', 'futures']),
  margin_mode: z.enum(['cross', 'isolated']),
  liquidation_buffer: z.number(),
  leverage: z.number(),
  can_short: z.boolean(),
  position_adjustment_enable: z.boolean(),
  max_entry_position_adjustment: z.number().int(),
  cancel_open_orders_on_exit: z.boolean(),
  process_only_new_candles: z.boolean(),
  force_entry_enable: z.boolean(),
  telegram: telegramSchema,
  process_throttle_secs: z.number().int(),
  /* MVP-only fields not in the original payload — backend negotiation TBD. */
  order_type: z.enum(['market', 'limit']).optional(),
  limit_offset_pct: z.number().nullable().optional(),
  close_method_type: z.enum(['manual', 'tp_sl', 'indicator', 'roi']).optional(),
});

export type BotPayload = z.infer<typeof botPayloadSchema>;
