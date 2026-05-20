import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useRequireWallet } from '@/features/wallet-auth/RequireWalletProvider';
import { WalletChip } from '@/features/wallet-auth/WalletChip';
import { useIsWalletConnected } from '@/features/wallet-auth/wallet.store';
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

export function AppHeader() {
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
    <header className="relative z-20 flex h-[var(--layout-header,56px)] flex-shrink-0 items-center px-3 pt-2">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 rounded-full border border-white/[0.08] bg-white/[0.05] py-3 pl-4 pr-3 shadow-[0_8px_24px_rgba(0,0,0,0.15)] backdrop-blur-[100px]">
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
            <span className="text-sm font-bold tracking-wide text-fg">
              COIN98 BOT
            </span>
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
            <a
              href="https://docs.coin98.com"
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center rounded-full px-3 text-sm font-medium text-fg-secondary transition-colors hover:text-fg"
            >
              Docs
            </a>
          </nav>
        </div>

        {/* Right cluster — wallet */}
        <div className="flex items-center pr-1">
          <WalletChip />
        </div>
      </div>
    </header>
  );
}

interface NavLinkProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function NavLink({ label, active, onClick }: NavLinkProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        'h-10 rounded-full px-3 text-sm font-medium',
        active
          ? 'text-fg hover:bg-surface-hover'
          : 'text-fg-secondary hover:bg-surface-hover hover:text-fg',
      )}
    >
      {label}
    </Button>
  );
}
