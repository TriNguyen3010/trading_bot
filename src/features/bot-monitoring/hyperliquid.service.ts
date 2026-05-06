// src/features/bot-monitoring/hyperliquid.service.ts
import type { HLAssetCtx, HLCandle, HLOrderBook } from './types';

const HL_BASE = 'https://api.hyperliquid.xyz/info';

async function hlFetch<T>(body: object): Promise<T> {
  const res = await fetch(HL_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HL ${res.status}: ${res.statusText}`);
  return res.json();
}

export interface MetaAndAssetCtxs {
  meta: { universe: { name: string; szDecimals: number }[] };
  ctxs: HLAssetCtx[];
}

export interface HyperliquidApi {
  getMetaAndAssetCtxs(): Promise<MetaAndAssetCtxs>;
  getCandleSnapshot(coin: string, interval: '1m' | '5m' | '15m' | '1h' | '1d', startTime: number, endTime: number): Promise<HLCandle[]>;
  getL2Book(coin: string): Promise<HLOrderBook>;
}

export const hlApi: HyperliquidApi = {
  async getMetaAndAssetCtxs() {
    const res = await hlFetch<[MetaAndAssetCtxs['meta'], HLAssetCtx[]]>({ type: 'metaAndAssetCtxs' });
    return { meta: res[0], ctxs: res[1] };
  },
  async getCandleSnapshot(coin, interval, startTime, endTime) {
    return hlFetch<HLCandle[]>({
      type: 'candleSnapshot',
      req: { coin, interval, startTime, endTime },
    });
  },
  async getL2Book(coin) {
    return hlFetch<HLOrderBook>({ type: 'l2Book', coin });
  },
};
