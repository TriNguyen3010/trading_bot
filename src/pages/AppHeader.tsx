import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useRequireWallet } from '@/features/wallet-auth/RequireWalletProvider';
import { WalletChip } from '@/features/wallet-auth/WalletChip';
import { useIsWalletConnected } from '@/features/wallet-auth/wallet.store';
import { dropInItem, dropInStagger } from '@/lib/motion';
import { cn } from '@/lib/utils';

// =============================================================================
// AppHeader · shared floating pill header for Landing + Dashboard.
//
// Matches the Coin98 marketing site pattern:
//   [logo · COIN98 BOT]   [Dashboard  Builder  Docs]              [Wallet]
//
// Nav items gate through requireWalletThen when the user is anonymous —
// clicking "Dashboard" or "Builder" before connecting opens the wallet modal
// then routes after sign success.
// =============================================================================

export function AppHeader({ actions }: { actions?: ReactNode } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isConnected = useIsWalletConnected();
  const { requireWalletThen } = useRequireWallet();

  const goTo = (path: string) => {
    if (isConnected) {
      navigate(path);
      return;
    }
    requireWalletThen(() => navigate(path));
  };

  const isActive = (path: string) =>
    location.pathname === path ||
    (path === '/dashboard' && location.pathname.startsWith('/bots/'));

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-[var(--layout-header,56px)] items-center px-3 pt-2">
        <motion.div
          className="app-header-pill mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 rounded-full py-3 pl-4 pr-3"
          variants={dropInStagger}
          initial="hidden"
          animate="visible"
        >
          {/* Left cluster — brand identity + primary nav */}
          <div className="flex items-center gap-1 pl-1">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="Home"
              className="flex items-center gap-2 rounded-full pr-2 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <img
                src="/logo.png"
                alt="Trading Bot"
                className="h-8 w-8 select-none rounded-full object-contain"
                draggable={false}
              />
              <motion.span
                variants={dropInItem}
                className="text-sm font-bold tracking-wide text-fg"
              >
                COIN98 BOT
              </motion.span>
            </button>

            <nav className="ml-4 flex items-center gap-0.5">
              <NavLink
                label="Dashboard"
                active={isActive('/dashboard')}
                onClick={() => goTo('/dashboard')}
              />
              <NavLink
                label="Builder"
                active={isActive('/builder')}
                onClick={() => goTo('/builder')}
              />
              <motion.a
                variants={dropInItem}
                href="https://docs.coin98.com"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center rounded-full px-3 text-sm font-medium text-fg-secondary transition-colors hover:text-fg"
              >
                Docs
              </motion.a>
            </nav>
          </div>

          {/* Right cluster — builder actions (when provided) + wallet */}
          <motion.div
            variants={dropInItem}
            className="flex items-center gap-2 pr-1"
          >
            {actions}
            <WalletChip />
          </motion.div>
        </motion.div>
      </header>
      <div
        aria-hidden="true"
        className="h-[var(--layout-header,56px)] flex-shrink-0"
      />
    </>
  );
}

interface NavLinkProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavLink({ label, active, onClick }: NavLinkProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div variants={dropInItem} className="inline-flex">
      <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative h-10 rounded-none px-3 text-sm font-medium hover:bg-transparent',
          active ? 'text-fg' : 'text-fg-secondary hover:text-fg',
        )}
      >
        <span className="relative z-[1]">{label}</span>
        {active ? (
          reduceMotion ? (
            <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-brand" />
          ) : (
            <motion.span
              layoutId="header-nav-underline"
              className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-brand"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )
        ) : null}
      </Button>
    </motion.div>
  );
}
