import { Button } from '@/components/ui/button';
import { useWalletStore } from './wallet.store';
import { useRequireWallet } from './RequireWalletProvider';

const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

function truncateAddress(address: string): string {
  if (!address || address.length < 12) return address || '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletChip() {
  const address = useWalletStore((s) => s.address);
  const signature = useWalletStore((s) => s.signature);
  const disconnect = useWalletStore((s) => s.disconnect);
  const { openConnect } = useRequireWallet();

  const isConnectedReal = !!address && !!signature;

  // In bypass mode the chip can't usefully connect/disconnect. Show a
  // dev-only badge so it's obvious the auth wall is off (and clicks
  // don't open the modal — RequireWalletProvider swallows them).
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
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void disconnect()}
        title="Click to disconnect"
        className="rounded-full bg-bullish-subtle px-3 text-bullish hover:bg-bullish-subtle hover:text-bullish"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-bullish" />
        <span className="font-mono tabular-nums text-fg">
          {truncateAddress(address)}
        </span>
      </Button>
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
