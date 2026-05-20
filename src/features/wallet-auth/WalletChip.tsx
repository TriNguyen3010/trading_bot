import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useWalletStore } from './wallet.store';
import { useRequireWallet } from './RequireWalletProvider';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address || '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletChip() {
  const address = useWalletStore((s) => s.address);
  const nonce = useWalletStore((s) => s.nonce);
  const signature = useWalletStore((s) => s.signature);
  const disconnect = useWalletStore((s) => s.disconnect);
  const switchAccount = useWalletStore((s) => s.switchAccount);
  const { openConnect } = useRequireWallet();
  const [open, setOpen] = useState(false);

  const isConnectedReal = !!address && !!nonce && !!signature;

  if (BYPASS_AUTH && !isConnectedReal) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className="rounded-full bg-info/10 px-3 text-info hover:bg-info/10 hover:text-info"
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            title="Wallet menu"
            className="rounded-full bg-bullish-subtle px-3 text-bullish hover:bg-bullish-subtle hover:text-bullish"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-bullish" />
            <span className="font-mono tabular-nums text-fg">
              {truncateAddress(address)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-0">
          <div className="border-b border-border px-4 py-3">
            <div className="text-2xs uppercase tracking-widest text-fg-muted">
              Connected wallet
            </div>
            <div className="mt-1 break-all font-mono text-xs text-fg">
              {address}
            </div>
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
              onClick={async () => {
                setOpen(false);
                await disconnect();
              }}
              className="rounded-md px-3 py-2 text-left text-sm font-medium text-bearish hover:bg-bearish-subtle"
            >
              Disconnect
            </button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={openConnect}
      className="rounded-full px-4 shadow-[0_0_16px_rgba(240,185,11,0.35)]"
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-black text-[7px] font-bold leading-none text-brand">
        C98
      </span>
      Connect wallet
    </Button>
  );
}
