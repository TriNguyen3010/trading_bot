import type { components, paths } from './api';

// Schemas
export type Schemas = components['schemas'];

// Request payloads
export type CreatePayload = Schemas['UnifiedBotStrategyCreate'];
export type UpdatePayload = Schemas['UnifiedBotStrategyUpdate'];

// Response
export type BotStrategyResponse = Schemas['BotStrategyOut'];
export type BotResponse = Schemas['BotOut'];
export type StrategyResponse = Schemas['StrategyOut'];

// Backtest
export type BacktestRequest = Schemas['BacktestRequest'];
export type BacktestJobResponse = Schemas['BacktestJobResponse'];
export type BacktestHistoryItem = Schemas['BacktestHistoryItem'];
export type BacktestHistoryList = Schemas['BacktestHistoryList'];

// Sub-schemas (dùng nhiều)
export type StrategyConfigurations = Schemas['StrategyConfigurations'];
export type SignalsConfig = Schemas['SignalsConfig'];
export type IndicatorItem = Schemas['IndicatorItem'];
export type CustomIndicatorItem = Schemas['CustomIndicatorItem'];
export type CustomExitConfig = Schemas['CustomExitConfig'];
export type RiskConfig = Schemas['RiskConfig'];
export type ROIStep = Schemas['ROIStep'];
export type TelegramConfig = Schemas['TelegramConfig'];

// Errors
export type ValidationError = Schemas['HTTPValidationError'];

// Agent wallet (Hyperliquid)
export type CreateAgentRequest = Schemas['CreateAgentRequest'];
export type AgentPrepareResponse = Schemas['AgentPrepareResponse'];
export type AgentConfirmRequest = Schemas['AgentConfirmRequest'];
export type AgentCreateResponse = Schemas['AgentCreateResponse'];
export type AgentInfoResponse = Schemas['AgentInfoResponse'];
export type SpendingLimitCheckRequest = Schemas['SpendingLimitCheckRequest'];
export type SpendingLimitCheckResponse = Schemas['SpendingLimitCheckResponse'];

// Agent management (Phase 2b.1)
export type AgentSyncStatusResponse = Schemas['AgentSyncStatusResponse'];
export type HyperliquidWalletResponse = Schemas['HyperliquidWalletResponse'];
export type AgentRevokeRequest = Schemas['AgentRevokeRequest'];
export type ExternalRevokeRequest = Schemas['ExternalRevokeRequest'];
export type BotWalletRotationResponse = Schemas['BotWalletRotationResponse'];
export type BotWalletRotationResultItem =
  Schemas['BotWalletRotationResultItem'];

// Endpoint paths (dùng cho fetch wrapper sau này)
export type Paths = paths;
