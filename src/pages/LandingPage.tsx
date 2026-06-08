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
import { useIsWalletConnected } from '@/features/wallet-auth/wallet.store';
import { HomePortfolio } from '@/features/bot-monitoring/home-portfolio/HomePortfolio';
import { AppHeader } from './AppHeader';

export function LandingPage() {
  const navigate = useNavigate();
  const { requireWalletThen } = useRequireWallet();
  const isConnected = useIsWalletConnected();
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

      {/* Dot-grid texture — starts at the viewport edge so it sits behind the
          fixed floating header instead of leaving a black strip. */}
      <DotGridSpotlight
        className="pointer-events-none fixed z-0"
        style={{
          top: 0,
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

          {/* Authed portfolio — real data. Renders null when not connected
              (the "What you get" block above covers that case). */}
          <HomePortfolio
            onBuild={onBuild}
            onImport={onImport}
            onBotClick={(id) => navigate(`/bots/${id}`)}
            onViewDashboard={() => navigate('/dashboard')}
          />
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
