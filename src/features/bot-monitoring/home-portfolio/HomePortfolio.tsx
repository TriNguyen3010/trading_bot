import { useState, type ReactNode } from 'react';
import {
  useIsWalletConnected,
  useWalletStore,
} from '@/features/wallet-auth/wallet.store';
import { useActiveAgent } from '@/features/agent-wallet/useActiveAgent';
import { AgentOnboardingDialog } from '@/features/agent-wallet/AgentOnboardingDialog';
import { usePortfolioOverview } from '../usePortfolioOverview';
import { pickTopBots } from './pick-top-bots';
import {
  MiniBotCard,
  PortfolioEmpty,
  PortfolioError,
  PortfolioHero,
  PortfolioSkeleton,
} from './portfolio-parts';

const TOP_BOTS_LIMIT = 3;

export interface HomePortfolioProps {
  /** "Build a bot" CTA (LandingPage routes via requireWalletThen → /builder). */
  onBuild: () => void;
  /** "Import config" CTA. */
  onImport: () => void;
  /** Navigate to a bot's detail page. */
  onBotClick: (id: number) => void;
  /** "View dashboard →". Defaults to no-op if omitted. */
  onViewDashboard?: () => void;
}

export function HomePortfolio({
  onBuild,
  onImport,
  onBotClick,
  onViewDashboard,
}: HomePortfolioProps) {
  const isConnected = useIsWalletConnected();
  const walletAddress = useWalletStore((s) => s.address);
  const { bots, perfById, stats, loading, error, refresh } =
    usePortfolioOverview({ enabled: isConnected });
  const {
    agent,
    loading: agentLoading,
    refresh: refreshAgent,
  } = useActiveAgent({ enabled: isConnected });
  const [onboardOpen, setOnboardOpen] = useState(false);

  const openOnboard = () => setOnboardOpen(true);

  // Not connected → render nothing; LandingPage shows the "What you get"
  // marketing cards instead. The `enabled: isConnected` flags above mean the
  // hooks never fetched, so there is no data to show and no 401 risk.
  if (!isConnected) return null;

  // ── State machine (priority order, spec §4) ──
  // Error is checked before the `bots === null` skeleton fallback: on a load
  // failure the list never set `bots`, so it stays null with loading=false —
  // checking it before error would mask the error behind a permanent skeleton.
  let body: ReactNode;
  if (loading) {
    body = <PortfolioSkeleton />;
  } else if (error) {
    body = <PortfolioError onRetry={refresh} />;
  } else if (bots === null) {
    // Not loading, no error, not loaded yet (e.g. just after connect, before
    // the fetch effect runs) — keep the skeleton, never flash an empty state.
    body = <PortfolioSkeleton />;
  } else if (bots.length === 0) {
    body = (
      <PortfolioEmpty
        agent={agent}
        agentLoading={agentLoading}
        walletAddress={walletAddress}
        onBuild={onBuild}
        onImport={onImport}
        onCreateAgent={openOnboard}
      />
    );
  } else {
    const top = pickTopBots(bots, perfById, TOP_BOTS_LIMIT);
    body = (
      <>
        <PortfolioHero
          stats={stats}
          agent={agent}
          agentLoading={agentLoading}
          walletAddress={walletAddress}
          onCreateAgent={openOnboard}
        />
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
              Recent activity · top bots
            </h2>
            {onViewDashboard && (
              <button
                type="button"
                onClick={onViewDashboard}
                className="text-2xs text-brand hover:underline"
              >
                View dashboard →
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {top.map((b) => (
              <MiniBotCard
                key={b.id}
                bot={b}
                perf={perfById.get(b.id)}
                onClick={() => onBotClick(b.id)}
              />
            ))}
            {top.length < TOP_BOTS_LIMIT && (
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
            )}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      {body}
      <AgentOnboardingDialog
        open={onboardOpen}
        onOpenChange={setOnboardOpen}
        onSuccess={() => {
          setOnboardOpen(false);
          refresh();
          refreshAgent();
        }}
      />
    </>
  );
}
