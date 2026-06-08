import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ManageAgentsModal } from '@/features/agent-wallet/ManageAgentsModal';
import { AgentOnboardingDialog } from '@/features/agent-wallet/AgentOnboardingDialog';
import { useWalletStore } from './wallet.store';
import { useRequireWallet } from './RequireWalletProvider';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address || '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface WalletChipProps {
  /**
   * Trigger button appearance.
   * - 'address-chip' (default): green status dot + address on a bg-bullish-subtle
   *   pill (Dashboard / Landing look).
   * - 'ghost': ghost pill + User icon + address (builder look).
   */
  triggerVariant?: 'address-chip' | 'ghost';
  /**
   * If set, navigate here after a successful disconnect (builder passes '/').
   * Omitted elsewhere — those screens rely on the RequireWalletProvider route guard.
   */
  redirectOnDisconnect?: string;
}

export function WalletChip({
  triggerVariant = 'address-chip',
  redirectOnDisconnect,
}: WalletChipProps) {
  const address = useWalletStore((s) => s.address);
  const nonce = useWalletStore((s) => s.nonce);
  const signature = useWalletStore((s) => s.signature);
  const user = useWalletStore((s) => s.user);
  const disconnect = useWalletStore((s) => s.disconnect);
  const switchAccount = useWalletStore((s) => s.switchAccount);
  const { openConnect } = useRequireWallet();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);

  const isConnectedReal = !!address && !!nonce && !!signature;

  if (BYPASS_AUTH && !isConnectedReal) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="h-10 rounded-full bg-info/10 px-3 text-info hover:bg-info/10 hover:text-info"
        title="VITE_BYPASS_AUTH=true · auth gate disabled"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-info" />
        <span className="font-mono text-xs uppercase tracking-wider">
          DEV bypass
        </span>
      </Button>
    );
  }

  if (isConnectedReal) {
    return (
      <>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {triggerVariant === 'ghost' ? (
              <Button
                variant="ghost"
                size="sm"
                title="Wallet menu"
                className="h-10 rounded-full px-3"
              >
                <User className="h-3.5 w-3.5" />
                <span className="max-w-[120px] truncate font-mono text-xs tabular-nums text-fg">
                  {truncateAddress(address)}
                </span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                title="Wallet menu"
                className="h-10 rounded-full bg-bullish-subtle px-3 text-bullish hover:bg-bullish-subtle hover:text-bullish"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-bullish" />
                <span className="font-mono tabular-nums text-fg">
                  {truncateAddress(address)}
                </span>
              </Button>
            )}
          </PopoverTrigger>
          <PopoverContent
            align={triggerVariant === 'ghost' ? 'start' : 'end'}
            className="w-72 p-0"
          >
            <div className="border-b border-border px-4 py-3">
              <div className="text-2xs uppercase tracking-widest text-fg-muted">
                Connected wallet
              </div>
              <div className="mt-1 break-all font-mono text-xs text-fg">
                {address}
              </div>
              {user ? (
                <div className="mt-1 text-xs text-fg-muted">
                  {user.is_admin ? 'Admin' : 'Member'}
                </div>
              ) : null}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(address ?? '');
                    toast.success('Address copied');
                  } catch {
                    toast.error('Could not copy address');
                  }
                }}
                className="mt-2 text-2xs uppercase tracking-widest text-brand hover:underline"
              >
                Copy address
              </button>
            </div>

            <div className="flex flex-col p-1.5">
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await switchAccount();
                }}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-fg hover:bg-brand-soft"
              >
                Switch wallet
                <span className="mt-0.5 block text-2xs font-normal text-fg-muted">
                  Coin98 will open the account picker.
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setManageOpen(true);
                }}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-fg hover:bg-brand-soft"
                aria-label="Manage agents"
              >
                Manage agents
                <span className="mt-0.5 block text-2xs font-normal text-fg-muted">
                  View, revoke, and rotate Hyperliquid agent wallets.
                </span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
                  await disconnect();
                  if (redirectOnDisconnect) {
                    navigate(redirectOnDisconnect, { replace: true });
                  }
                }}
                className="rounded-md px-3 py-2 text-left text-sm font-medium text-bearish hover:bg-bearish-subtle"
              >
                Disconnect
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <ManageAgentsModal
          open={manageOpen}
          onOpenChange={setManageOpen}
          onRequestOnboarding={() => {
            setManageOpen(false);
            setOnboardOpen(true);
          }}
          onRotateErrors={(results) => {
            results.forEach((r) => {
              toast.warning(
                `Bot "${r.bot_name}" rotate lỗi: ${r.error ?? 'unknown'}`,
              );
            });
          }}
        />

        <AgentOnboardingDialog
          open={onboardOpen}
          onOpenChange={setOnboardOpen}
          onSuccess={() => {
            setOnboardOpen(false);
            // Re-open ManageAgentsModal to offer rotate-wallet after new agent created
            setManageOpen(true);
          }}
          onManageAgents={() => {
            setOnboardOpen(false);
            setManageOpen(true);
          }}
        />
      </>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={openConnect}
      className="h-10 rounded-full px-4 shadow-[0_0_16px_rgba(240,185,11,0.35)]"
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-black text-[7px] font-bold leading-none text-brand">
        C98
      </span>
      Connect wallet
    </Button>
  );
}
