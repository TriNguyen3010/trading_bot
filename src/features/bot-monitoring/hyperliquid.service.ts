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
    // HL returns OHLCV as strings (e.g. "81175.0") — coerce to numbers
    // so consumers (chart libs, math) get the canonical HLCandle shape.
    type RawCandle = {
      t: number;
      T: number;
      o: string | number;
      h: string | number;
      l: string | number;
      c: string | number;
      v: string | number;
    };
    const raw = await hlFetch<RawCandle[]>({
      type: 'candleSnapshot',
      req: { coin, interval, startTime, endTime },
    });
    return raw.map((c) => ({
      t: c.t,
      T: c.T,
      o: Number(c.o),
      h: Number(c.h),
      l: Number(c.l),
      c: Number(c.c),
      v: Number(c.v),
    }));
  },
  async getL2Book(coin) {
    // HL returns L2 levels with px/sz as strings — coerce to numbers.
    type RawLevel = { px: string | number; sz: string | number; n: number };
    type RawBook = {
      coin: string;
      time: number;
      levels: [RawLevel[], RawLevel[]];
    };
    const raw = await hlFetch<RawBook>({ type: 'l2Book', coin });
    const coerce = (lvls: RawLevel[]) =>
      lvls.map((l) => ({ px: Number(l.px), sz: Number(l.sz), n: l.n }));
    return {
      coin: raw.coin,
      time: raw.time,
      levels: [coerce(raw.levels[0]), coerce(raw.levels[1])],
    };
  },
};
