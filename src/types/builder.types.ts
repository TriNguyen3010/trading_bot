/**
 * Shared types for the bot-builder feature.
 *
 * Source-of-truth schemas live in `src/schemas/` (zod). These TS types are
 * the editor-side shape used by the builder store and forms; the serializer
 * converts BuilderState into the backend payload schema.
 */

export type StepId = 'bot-config' | 'entry-strategy' | 'direction' | 'close-method';

export type StepStatus = 'pending' | 'editing' | 'configured' | 'error';

export type DrawerTab = 'setup' | 'configure';

export type Direction = 'long' | 'short';
export type OrderType = 'market' | 'limit';
export type TradingMode = 'live' | 'dry-run';
export type MarketType = 'spot' | 'futures';
export type MarginMode = 'cross' | 'isolated';
export type CloseMethodType = 'manual' | 'tp_sl' | 'indicator' | 'roi';

/** Candlestick price channels exposed in the entry strategy chips. */
export type Candlestick = 'open' | 'close' | 'high' | 'low' | 'volume';

export type ConditionOp =
  | '>'
  | '<'
  | '>='
  | '<='
  | '=='
  | 'crosses_above'
  | 'crosses_below'
  | 'is_going_up'
  | 'is_going_down';

export interface IndicatorItem {
  id: string;
  name: string; // "RSI", "MA", "MACD", "BB", "ATR", "Stochastic"
  type: 'talib' | 'pandas_ta' | 'custom';
  parameters: Record<string, number | string>;
  timeframe?: string;
}

export interface ConditionRow {
  id: string;
  left: string; // e.g. "candle.close" or "RSI-14"
  op: ConditionOp;
  right_type: 'indicator' | 'number' | 'none';
  right_number: number | null;
  right_indicator: string | null;
  lookback: number;
  percentage?: number;
  operator?: 'AND' | 'OR'; // present on rows after the first
}

export interface ConditionGroup {
  logic: { type: 'AND' | 'OR'; threshold: number | null };
  conditions: ConditionRow[];
}

// ────────────────────────────────────────────────────────────────────────────
// ConditionTree (new model, exposed by the redesigned grouped UI).
// Mirrors what BE accepts: a top-level list joined by ONE connector, where
// each item is a NAMED group joined internally by ONE connector. BE supports
// arbitrary nesting; FE exposes one level per the mockup.
// ────────────────────────────────────────────────────────────────────────────

export interface ConditionRule {
  id: string;
  left: string;
  op: ConditionOp;
  right_type: 'indicator' | 'number' | 'none';
  right_number: number | null;
  right_indicator: string | null;
  lookback: number;
  percentage?: number;
}

export interface ConditionGroupNode {
  id: string;
  intraConnector: 'AND' | 'OR';
  rules: ConditionRule[];
}

export interface ConditionTree {
  groupConnector: 'AND' | 'OR';
  groups: ConditionGroupNode[];
}

export interface RoiStep {
  minutes: number;
  roi: number; // percentage
}

export interface TpLevel {
  profit: number; // %
  amount: number; // % of position to close
}

export interface CloseMethodForm {
  type: CloseMethodType;
  // TP/SL
  tpEnabled: boolean;
  tpLevels: TpLevel[];
  slEnabled: boolean;
  slValue: number; // %
  trailingEnabled: boolean;
  trailingPositive: number;
  trailingOffset: number;
  // ROI
  roiSteps: RoiStep[];
  // Indicator exit
  exitConditions: ConditionTree;
}

export interface BotConfigForm {
  pair: string; // UI format: BTC-USDC
  timeframe: string; // e.g. "5m"
  tradingMode: TradingMode;
  leverage: number;
  exchange: string;
  marketType: MarketType;
  marginMode: MarginMode;
  maxOpenTrades: number;
  stakeCurrency: string;
  stakeAmount: number; // user dollars (UI shows $100,000)
  dryRunWallet: number;
}

export interface EntryStrategyForm {
  id: string;
  name: string;
  candlestick: Candlestick[];
  indicators: IndicatorItem[];
  entryConditions: ConditionTree;
  /** Set via templates / JSON import only — not exposed in the wizard UI. */
  startupCandleCount: number;
  /** Set via templates / JSON import only — not exposed in the wizard UI. */
  informativeTimeframes: string[];
}

export interface DirectionForm {
  direction: Direction;
  orderType: OrderType;
  limitOffsetPct: number | null;
}

export interface BuilderState {
  botName: string;
  botConfig: BotConfigForm;
  strategy: EntryStrategyForm;
  directionForm: DirectionForm;
  closeMethod: CloseMethodForm;
  stepStatus: Record<StepId, StepStatus>;
  isDirty: boolean;
  lastSavedAt: number | null;
}
