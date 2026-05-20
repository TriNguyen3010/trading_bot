import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Code2,
  FlaskConical,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DotGridSpotlight } from '@/features/fx/DotGridSpotlight';
import { ImportDialog } from '@/features/export-import/ImportDialog';
import { useRequireWallet } from '@/features/wallet-auth/RequireWalletProvider';
import {
  useIsWalletConnected,
  useWalletStore,
} from '@/features/wallet-auth/wallet.store';
import { AppHeader } from './AppHeader';

export function LandingPage() {
  const navigate = useNavigate();
  const { requireWalletThen } = useRequireWallet();
  const isConnected = useIsWalletConnected();
  const walletAddress = useWalletStore((s) => s.address);
  const [importOpen, setImportOpen] = useState(false);

  // After connect, returning users land on /dashboard (matches user-journey s02).
  // If already connected (subsequent click), "+ New bot" goes straight to
  // /builder since the intent is explicit.
  const onBuild = () => {
    if (isConnected) {
      navigate('/builder');
      return;
    }
    requireWalletThen(() => navigate('/dashboard'));
  };

  const onImport = () => requireWalletThen(() => setImportOpen(true));

  return (
    <div className="relative flex min-h-screen w-screen flex-col bg-black text-fg">
      {/* Page-wide subtle yellow glow accents (Coin98 hero halos) —
          matches BotMonitoringPage / BuilderPage exactly so route
          transitions feel continuous. */}
      <div
        className="pointer-events-none fixed -top-20 left-1/2 z-0 h-[420px] w-[700px] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(240,185,11,0.12), transparent 70%)',
        }}
        aria-hidden
      />

      {/* Dot-grid texture — constrained to start below the floating header
          pill, matching Builder + Monitoring conventions. */}
      <DotGridSpotlight
        className="pointer-events-none fixed z-0"
        style={{
          top: 'var(--layout-header, 56px)',
          left: 0,
          right: 0,
          bottom: 0,
        }}
        dimmed={false}
      />

      <AppHeader />

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col">
        {/* Hero — text left, video bleeds to viewport right */}
        <section className="grid grid-cols-1 gap-8 py-12 md:grid-cols-2 md:items-center md:gap-12">
          {/* Left col — content aligned to where max-w 1400 container starts */}
          <div className="px-6 md:pl-[max(24px,calc(50vw-660px))] md:pr-0">
            <div className="flex items-center gap-2 text-2xs uppercase tracking-wider text-fg-muted">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Welcome
            </div>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-fg">
              Build your first <span className="text-brand">bot</span>.
            </h1>
            <p className="mt-4 max-w-[480px] text-md leading-relaxed text-fg-secondary">
              You write the rules. The bot watches the market and follows them —
              no discretion, no surprises. Start in dry-run, switch to live only
              when you&apos;re ready.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={onBuild}
                className="group"
              >
                {isConnected ? 'New bot' : 'Build a bot'}
                <ArrowRight className="h-4 w-4 group-hover:animate-spin-once" />
              </Button>
              <Button variant="secondary" size="lg" onClick={onImport}>
                Import config
              </Button>
              {!isConnected && (
                <span className="ml-1 max-w-md text-xs text-fg-muted">
                  Either action will ask you to connect your Coin98 wallet.
                </span>
              )}
            </div>
          </div>

          {/* Right col — hero video, bleed flush to right viewport edge */}
          <div className="hidden md:block">
            <video
              src="/hero-demo.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              aria-label="Trading bot demo"
              className="aspect-video w-full border-y border-l border-border-subtle bg-black object-cover shadow-[0_12px_32px_rgba(0,0,0,0.6)] md:rounded-l-xl"
            />
          </div>
        </section>

        {/* Below the hero — features (anonymous) or cockpit + bots (authed) */}
        <div className="mx-auto w-full max-w-[1400px] px-6 pb-16">
          {!isConnected && (
            <div className="mt-8">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                  What you get
                </h2>
                <span className="font-mono text-2xs tabular-nums text-fg-disabled">
                  Coin98 · alpha
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FeatureCard
                  icon={Code2}
                  title="You write the rules"
                  body="No AI suggestions. No recommended setups. The strategy is yours — every entry, every exit, every dollar of risk."
                />
                <FeatureCard
                  icon={FlaskConical}
                  title="Dry-run is free"
                  body="Test on real market data with paper money. Promote to live only when you're confident. Pause or stop at any time."
                />
                <FeatureCard
                  icon={Wallet}
                  title="Wallet-only auth"
                  body="Coin98 wallet signs trades directly. No email, no password, no account creation. Keys never leave your wallet."
                />
              </div>
            </div>
          )}

          {isConnected && (
            <>
              {/* Portfolio hero — mirrors HeroPnL on the bot page */}
              <section className="mt-8">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                    Your portfolio
                  </h2>
                  <span className="font-mono text-2xs tabular-nums text-bullish">
                    ● live · last update 12s ago
                  </span>
                </div>
                <section
                  aria-labelledby="landing-portfolio-label"
                  className="card-coin98 relative grid grid-cols-1 gap-6 overflow-hidden rounded-3xl p-8 md:grid-cols-[1fr_auto]"
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-16 -top-24 h-80 w-80 rounded-full opacity-40 blur-2xl"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(240,185,11,0.25), transparent 70%)',
                    }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-2xl"
                    style={{
                      background:
                        'radial-gradient(circle, var(--color-bullish), transparent 70%)',
                    }}
                  />

                  <div className="relative">
                    <div
                      id="landing-portfolio-label"
                      className="mb-4 flex flex-wrap items-center gap-3 text-2xs uppercase tracking-widest text-fg-muted"
                    >
                      <span>Portfolio · 30D</span>
                      <span className="inline-flex items-center gap-1.5 text-bullish">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
                        Live
                      </span>
                      <span className="text-border-strong">·</span>
                      <span>{truncate(walletAddress ?? '')}</span>
                    </div>

                    <div
                      className="font-mono text-6xl font-bold tabular-nums tracking-tight text-bullish"
                      style={{
                        textShadow: '0 0 38px rgba(14, 203, 129, 0.45)',
                        lineHeight: 1.0,
                      }}
                    >
                      +$734.20
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fg-secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-bullish">▲</span>
                        <span className="font-semibold tabular-nums text-fg">
                          5
                        </span>
                        <span className="text-fg-muted">active · 8 total</span>
                      </span>
                      <span className="text-border-strong">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-semibold tabular-nums text-fg-muted">
                          3
                        </span>
                        <span className="text-fg-muted">paused</span>
                      </span>
                      <span className="text-border-strong">·</span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-semibold tabular-nums text-fg">
                          $3,420
                        </span>
                        <span className="text-fg-muted">
                          deployed across 3 pairs
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="relative flex w-32 flex-col justify-center md:items-center">
                    <div className="font-mono text-3xl font-bold tabular-nums text-bullish">
                      +5.6%
                    </div>
                    <div className="mt-2 text-2xs uppercase tracking-widest text-fg-muted">
                      30-day return
                    </div>
                  </div>
                </section>
              </section>

              {/* Recent activity · top bots */}
              <section className="mt-8">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                    Recent activity · top bots
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="text-2xs text-brand hover:underline"
                  >
                    View dashboard →
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <BotCard
                    badge="LIVE"
                    badgeVariant="live"
                    streak="7-WIN"
                    name="RSI Momentum Long"
                    pair="ETH-USDC · 5m"
                    pnl="+$234.10"
                    pnlVariant="bullish"
                    onClick={() => navigate('/bots/1')}
                  />
                  <BotCard
                    badge="DRY-RUN"
                    badgeVariant="dry-run"
                    name="MACD Cross"
                    pair="SOL-USDC · 1h"
                    pnl="+$18.40"
                    pnlVariant="brand"
                    onClick={() => navigate('/bots/2')}
                  />
                  <button
                    type="button"
                    onClick={onBuild}
                    className="card-coin98-flat flex min-h-[110px] flex-col items-center justify-center rounded-2xl p-4 text-center transition hover:bg-brand-soft"
                  >
                    <div className="text-xl text-fg-muted">＋</div>
                    <div className="mt-1 text-xs font-semibold text-fg-secondary">
                      Build another
                    </div>
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  body: string;
}

function FeatureCard({ icon: Icon, title, body }: FeatureCardProps) {
  return (
    <article className="card-coin98-flat rounded-2xl p-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-subtle text-brand">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-3 text-md font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">{body}</p>
    </article>
  );
}

function truncate(addr: string): string {
  if (!addr || addr.length < 12) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface BotCardProps {
  badge: string;
  badgeVariant: 'live' | 'dry-run' | 'error';
  streak?: string;
  name: string;
  pair: string;
  pnl: string;
  pnlVariant: 'bullish' | 'bearish' | 'brand';
  onClick: () => void;
}

function BotCard({
  badge,
  badgeVariant,
  streak,
  name,
  pair,
  pnl,
  pnlVariant,
  onClick,
}: BotCardProps) {
  const badgeClass = {
    live: 'border-bullish/30 bg-bullish-subtle text-bullish',
    'dry-run': 'border-brand/30 bg-brand-subtle text-brand',
    error: 'border-bearish/40 bg-bearish-subtle text-bearish',
  }[badgeVariant];
  const pnlClass = {
    bullish: 'text-bullish',
    bearish: 'text-bearish',
    brand: 'text-brand',
  }[pnlVariant];

  return (
    <button
      type="button"
      onClick={onClick}
      className="card-coin98-flat cursor-pointer rounded-2xl p-4 text-left transition hover:brightness-110"
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-bold uppercase ${badgeClass}`}
        >
          {badge}
        </span>
        {streak && (
          <span className="rounded-sm bg-bullish-subtle px-1.5 py-0.5 text-2xs font-bold text-bullish">
            {streak}
          </span>
        )}
      </div>
      <h3 className="mt-2 text-base font-semibold text-fg">{name}</h3>
      <div className="text-xs text-fg-muted">{pair}</div>
      <div
        className={`mt-2 font-mono text-lg font-bold tabular-nums ${pnlClass}`}
      >
        {pnl}
      </div>
    </button>
  );
}
