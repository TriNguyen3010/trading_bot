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

// Endpoint paths (dùng cho fetch wrapper sau này)
export type Paths = paths;
