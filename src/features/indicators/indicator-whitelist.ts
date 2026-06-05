import whitelist from './indicator-whitelist.json';

export interface WhitelistParam {
  name: string;
  display_name: string;
  default: number;
  min?: number;
  max?: number;
  type: 'integer' | 'float';
  description?: string;
}

export interface WhitelistIndicator {
  id: string;
  display_name: string;
  category: string;
  talib_key?: string;
  pandas_ta_func?: string;
  type: 'talib' | 'pandas_ta';
  inputs: string[];
  outputs: string[];
  requires_datetime_index?: boolean;
  parameters: WhitelistParam[];
}

/** 14 indicators the BE supports. Source of truth: BE/source-of-truth/. */
export const INDICATOR_WHITELIST = (
  whitelist as { indicators: WhitelistIndicator[] }
).indicators;
