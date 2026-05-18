import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { useRequireWallet } from '@/features/wallet-auth/RequireWalletProvider';
import { WalletChip } from '@/features/wallet-auth/WalletChip';
import {
  useIsWalletConnected,
  useWalletStore,
} from '@/features/wallet-auth/wallet.store';

export function LandingPage() {
  const navigate = useNavigate();
  const { requireWalletThen } = useRequireWallet();
  const isConnected = useIsWalletConnected();
  const walletAddress = useWalletStore((s) => s.address);
  const [importOpen, setImportOpen] = useState(false);

  // After connect, returning users land on /dashboard (matches user-journey s02).
  // If the user is already connected (subsequent click), "+ New bot" goes
  // straight to /builder since the intent is explicit.
  const onBuild = () => {
    if (isConnected) {
      navigate('/builder');
      return;
    }
    requireWalletThen(() => navigate('/dashboard'));
  };

  const onImport = () => requireWalletThen(() => setImportOpen(true));

  return (
    <div className="dot-canvas relative min-h-screen text-fg">
      {/* glow */}
      <div
        className="glow-brand pointer-events-none absolute inset-0"
        aria-hidden
      />

      {/* Header */}
      <header className="relative flex items-center justify-between border-b border-border-subtle bg-black/40 px-8 py-4 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <span className="font-pixel text-[9px] tracking-[0.2em] text-brand">
            COIN98 BOT
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="text-xs text-fg-muted">v0.1.0 · alpha</span>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          {isConnected && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="text-fg-secondary hover:text-fg"
            >
              Dashboard
            </button>
          )}
          <a
            className="text-fg-muted hover:text-fg"
            href="https://docs.coin98.com"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
          <WalletChip />
        </div>
      </header>

      {/* Hero */}
      <main className="relative mx-auto max-w-[1180px] px-10 pt-12 pb-20">
        {isConnected ? <AuthedHero /> : <AnonymousHero />}

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onBuild}
            className="rounded-xl bg-brand px-6 py-3.5 text-[15px] font-semibold text-black shadow-lg shadow-brand/20 transition hover:brightness-110"
          >
            {isConnected ? '＋ New bot' : 'Build a bot →'}
          </button>
          <button
            type="button"
            onClick={onImport}
            className="rounded-xl border border-border bg-input/60 px-5 py-3.5 text-[14px] text-fg transition hover:border-brand"
          >
            Import config (.json)
          </button>
          {!isConnected && (
            <span className="ml-2 max-w-md text-[11px] text-fg-muted">
              Either action will ask you to connect your Coin98 wallet.
            </span>
          )}
        </div>

        {/* Cockpit */}
        <div className="mt-16">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
              Your portfolio · cockpit
            </div>
            <div className="text-[10px] font-mono tabular-nums text-fg-disabled">
              {isConnected
                ? '● live · last update 12s ago'
                : 'anonymous · sign in to see real numbers'}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
            {isConnected ? (
              <>
                <CockpitCell
                  label="P&L · 30D"
                  valueClassName="mt-3 font-mono text-[34px] font-bold leading-none tabular-nums text-bullish"
                  value="+$734.20"
                  hint={<span className="text-bullish">+5.6%</span>}
                />
                <CockpitCell
                  label="Active bots"
                  valueClassName="mt-3 font-mono text-[34px] font-bold leading-none tabular-nums text-fg"
                  value={
                    <span>
                      5<span className="text-fg-muted text-base"> / 8</span>
                    </span>
                  }
                  hint="3 paused"
                />
                <CockpitCell
                  label="Capital deployed"
                  valueClassName="mt-3 font-mono text-[34px] font-bold leading-none tabular-nums text-fg"
                  value="$3,420"
                  hint="across 3 pairs"
                />
                <CockpitCell
                  label="Wallet"
                  valueClassName="mt-3 text-fg text-[17px] font-semibold"
                  value={
                    <span className="font-mono tabular-nums">
                      {truncate(walletAddress ?? '')}
                    </span>
                  }
                  hint={
                    <span className="flex items-center gap-1 text-bullish">
                      <span className="h-1.5 w-1.5 rounded-full bg-bullish" />{' '}
                      Connected
                    </span>
                  }
                />
              </>
            ) : (
              <>
                <CockpitCell
                  label="P&L · 30D"
                  value="$0"
                  hint="no bots yet"
                />
                <CockpitCell
                  label="Active bots"
                  value="0"
                  hint="deploy when ready"
                />
                <CockpitCell
                  label="Capital deployed"
                  value="$0"
                  hint="dry-run is free"
                />
                <CockpitCell
                  label="Wallet"
                  accent
                  valueClassName="mt-3 text-fg-muted text-[17px] font-semibold"
                  value="Not connected"
                  hint={
                    <span className="flex items-center gap-1 text-fg-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-fg-disabled" />{' '}
                      sign in to link
                    </span>
                  }
                />
              </>
            )}
          </div>

          {isConnected ? null : (
            <div className="mt-4 flex items-center justify-between">
              <p className="max-w-[680px] text-[12px] text-fg-muted">
                Coin98 Wallet only. Your wallet is your identity — it signs
                trades. Keys never leave Coin98. There is no email, no
                password, no account creation.
              </p>
              <a
                className="flex items-center gap-1 text-[11px] text-fg-muted hover:text-fg"
                href="https://wallet.coin98.com"
                target="_blank"
                rel="noreferrer"
              >
                Don't have Coin98? <span className="text-brand">Install →</span>
              </a>
            </div>
          )}
        </div>

        {isConnected && (
          <div className="mt-10">
            <div className="mb-3 flex items-baseline justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
                Recent activity · top bots
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="text-[11px] text-brand hover:underline"
              >
                View dashboard →
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <BotCard
                badge="LIVE"
                badgeColor="bullish"
                streak="7-WIN"
                name="RSI Momentum Long"
                pair="ETH-USDC · 5m"
                pnl="+$234.10"
                pnlColor="bullish"
                onClick={() => navigate('/bots/1')}
              />
              <BotCard
                badge="DRY-RUN"
                badgeColor="cyan"
                name="MACD Cross"
                pair="SOL-USDC · 1h"
                pnl="+$18.40"
                pnlColor="cyan"
                onClick={() => navigate('/bots/2')}
              />
              <button
                type="button"
                onClick={onBuild}
                className="rounded-xl border border-dashed border-border-strong bg-transparent p-4 text-center transition hover:border-brand hover:bg-brand-soft"
              >
                <div className="text-2xl text-fg-muted">＋</div>
                <div className="mt-1 text-[12px] font-semibold text-fg-secondary">
                  Build another
                </div>
              </button>
            </div>
          </div>
        )}
      </main>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function AnonymousHero() {
  return (
    <div>
      <div className="flex items-baseline gap-2 text-[11px] uppercase tracking-wider text-fg-muted">
        <span className="h-1 w-1 rounded-full bg-brand" />
        <span>Welcome</span>
      </div>
      <h1 className="mt-5 text-[56px] font-semibold leading-[0.95] tracking-tight text-fg">
        Build your <span className="underline-brand">first bot</span>.
      </h1>
      <p className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-fg-secondary">
        You write the rules. The bot watches the market and follows them — no
        discretion, no surprises. Start in dry-run, switch to live only when
        you're ready.
      </p>
    </div>
  );
}

function AuthedHero() {
  return (
    <div>
      <div className="flex items-baseline gap-2 text-[11px] uppercase tracking-wider text-fg-muted">
        <span className="h-1 w-1 rounded-full bg-bullish" />
        <span>Welcome back</span>
      </div>
      <h1 className="mt-4 text-[44px] font-semibold leading-tight tracking-tight text-fg">
        Ready when you are.
      </h1>
      <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-fg-secondary">
        Wallet linked. Open the builder to spin up a new bot, or import an
        existing config.
      </p>
    </div>
  );
}

interface CockpitCellProps {
  label: string;
  value: React.ReactNode;
  hint: React.ReactNode;
  accent?: boolean;
  valueClassName?: string;
}

function CockpitCell({
  label,
  value,
  hint,
  accent,
  valueClassName,
}: CockpitCellProps) {
  return (
    <div
      className={`bg-base p-6 ${accent ? 'border-l-2 border-brand/40' : ''}`}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {label}
      </div>
      <div
        className={
          valueClassName ??
          'mt-3 font-mono text-[40px] font-bold leading-none tabular-nums text-fg-disabled'
        }
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-fg-muted">{hint}</div>
    </div>
  );
}

function truncate(addr: string): string {
  if (!addr || addr.length < 12) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface BotCardProps {
  badge: string;
  badgeColor: 'bullish' | 'cyan' | 'bearish';
  streak?: string;
  name: string;
  pair: string;
  pnl: string;
  pnlColor: 'bullish' | 'cyan' | 'bearish';
  onClick: () => void;
}

function BotCard({
  badge,
  badgeColor,
  streak,
  name,
  pair,
  pnl,
  pnlColor,
  onClick,
}: BotCardProps) {
  const badgeClass = {
    bullish: 'border-bullish/30 bg-bullish/10 text-bullish',
    cyan: 'border-cyan/30 bg-cyan/10 text-cyan',
    bearish: 'border-bearish/30 bg-bearish/10 text-bearish',
  }[badgeColor];
  const cardClass = {
    bullish: 'border-bullish/30',
    cyan: 'border-cyan/30',
    bearish: 'border-bearish/30',
  }[badgeColor];
  const pnlClass = {
    bullish: 'text-bullish',
    cyan: 'text-cyan',
    bearish: 'text-bearish',
  }[pnlColor];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-coin98 rounded-xl border p-4 text-left transition hover:brightness-110 ${cardClass}`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold ${badgeClass}`}
        >
          {badge}
        </span>
        {streak && (
          <span className="rounded bg-bullish-subtle px-1.5 py-0.5 text-[10px] font-bold text-bullish">
            {streak}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm font-semibold text-fg">{name}</div>
      <div className="text-[11px] text-fg-muted">{pair}</div>
      <div
        className={`mt-1.5 font-mono text-base font-bold tabular-nums ${pnlClass}`}
      >
        {pnl}
      </div>
    </button>
  );
}
