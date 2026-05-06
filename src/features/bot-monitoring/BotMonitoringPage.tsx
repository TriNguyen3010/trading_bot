import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { botApi } from './mockBotData';
import { useLayoutPrefsStore } from '@/features/layout-prefs/layout-prefs.store';
import type { BotMeta, PerformanceSnapshot } from './types';

// === Hooks (inline) ===
function useBotMeta(id: string) {
  const [meta, setMeta] = useState<BotMeta | null>(null);
  useEffect(() => { botApi.getBotMeta(id).then(setMeta); }, [id]);
  return meta;
}

function useSnapshot(id: string, deployedAt: number | undefined) {
  const [snap, setSnap] = useState<PerformanceSnapshot | null>(null);
  useEffect(() => {
    if (deployedAt == null) return;
    botApi.getSnapshot(id, deployedAt).then(setSnap);
  }, [id, deployedAt]);
  return snap;
}

// === Sections (inline) ===
function IdentityBar({ meta }: { meta: BotMeta }) {
  const uptime = Math.floor((Date.now() - meta.deployedAt) / 86_400_000);
  return (
    <div className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm">
      <div className="flex items-center gap-2 text-slate-400">
        <span className="text-slate-100 font-semibold">{meta.name}</span>
        <span className="bg-amber-950 text-amber-400 px-2 py-0.5 rounded-full text-xs uppercase tracking-wide font-semibold">
          {meta.mode}
        </span>
        <span className="text-slate-600">·</span>
        <code className="text-teal-300">{meta.pair}</code>
        <span className="text-slate-600">·</span>
        <span>{meta.timeframe}</span>
        <span className="text-slate-600">·</span>
        <span>Running {uptime}d</span>
      </div>
      <div className="flex gap-1.5">
        <span className="bg-teal-700 text-white px-2 py-0.5 rounded-full text-xs uppercase font-semibold">● Live</span>
        <button className="border border-slate-600 text-slate-300 px-2.5 py-1 rounded text-xs">⏸ Pause</button>
        <button className="border border-amber-900 text-amber-400 px-2.5 py-1 rounded text-xs">⏹ Stop</button>
        <button className="border border-slate-600 text-slate-300 px-2.5 py-1 rounded text-xs">✎ Edit</button>
      </div>
    </div>
  );
}

function WinStreakGauge({ streak }: { streak: number }) {
  const pct = Math.min(streak / 15, 1);
  const dash = pct * 264;
  return (
    <div className="flex flex-col items-center justify-center w-32">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#1e293b" strokeWidth="4"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="#f87171" strokeWidth="4"
          strokeDasharray={`${dash} 264`} strokeDashoffset="0"
          transform="rotate(-90 50 50)" strokeLinecap="round"
          style={{filter:'drop-shadow(0 0 6px rgba(248,113,113,0.6))'}}/>
      </svg>
      <div className="font-pixel text-3xl text-rose-400 -mt-[72px]">{streak}</div>
      <div className="mt-8 text-[9px] uppercase tracking-widest text-slate-500 text-center leading-relaxed">
        <b className="text-rose-400">Win Streak</b><br/>Next in 4m
      </div>
    </div>
  );
}

function HeroPnL({ snap }: { snap: PerformanceSnapshot }) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-6 bg-slate-950/80 border border-slate-800 rounded-xl p-7 relative overflow-hidden">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-500 mb-3">
          Today · Realized PnL
        </div>
        <div className="font-pixel text-5xl text-rose-400" style={{textShadow:'0 0 30px rgba(248,113,113,0.4)'}}>
          ${snap.todayPnL >= 0 ? '+' : ''}{snap.todayPnL.toLocaleString()}
        </div>
        <div className="flex gap-4 mt-4 text-sm text-slate-400">
          <span><span className="text-emerald-400">▲</span> {snap.totalTrades} trades</span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400 font-bold">{(snap.winRate * 100).toFixed(1)}% win</span>
          <span className="text-slate-600">·</span>
          <span>{snap.openPositions} open</span>
        </div>
      </div>
      <WinStreakGauge streak={snap.winStreak} />
    </div>
  );
}

function CypheusRail() {
  const collapsed = useLayoutPrefsStore(s => s.leftPanelCollapsed);
  // Placeholder for now — actual narrative wired in M3
  return (
    <aside className={`bg-slate-950 border-r border-slate-800 p-3 ${collapsed ? 'w-12' : 'w-60'} sticky top-0 h-screen`}>
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-sky-500 rounded-lg flex items-center justify-center text-white font-bold">
          C
        </div>
        {!collapsed && (
          <div>
            <h4 className="text-sm text-slate-100 font-semibold m-0">Cypheus</h4>
            <small className="text-xs text-teal-300">● Watching bot</small>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="mt-3 p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300">
          <div className="text-teal-300 text-[10px] uppercase tracking-wide mb-1">📡 Welcome</div>
          Bot monitoring view ready. (Narrative wired in M3.)
        </div>
      )}
    </aside>
  );
}

// === Main page ===
export function BotMonitoringPage() {
  const { id = '' } = useParams<{ id: string }>();
  const meta = useBotMeta(id);
  const snap = useSnapshot(id, meta?.deployedAt);

  if (!meta || !snap) return <div className="p-4 text-slate-400">Loading…</div>;

  return (
    <div className="grid grid-cols-[auto_1fr_280px] min-h-screen bg-slate-950">
      <CypheusRail />
      <main className="p-4 flex flex-col gap-3 min-w-0">
        <IdentityBar meta={meta} />
        <HeroPnL snap={snap} />
        <div className="border border-dashed border-slate-800 rounded-lg p-12 text-center text-slate-600 text-xs">
          [ Heatmap · PnL Curve · OrderBook · LiveSpotFeed · Pipeline · Recent Fills — coming in M2/M3/M4 ]
        </div>
      </main>
      <aside className="p-4 pl-0">
        <div className="border border-dashed border-slate-800 rounded-lg p-12 text-center text-slate-600 text-xs">
          [ Hyperliquid Markets — M4 ]
        </div>
      </aside>
    </div>
  );
}
