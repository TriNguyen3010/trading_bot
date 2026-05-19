import { Button } from '@/components/ui/button';
import { useWalletStore } from './wallet.store';
import { useRequireWallet } from './RequireWalletProvider';

function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletChip() {
  const address = useWalletStore((s) => s.address);
  const signature = useWalletStore((s) => s.signature);
  const disconnect = useWalletStore((s) => s.disconnect);
  const { openConnect } = useRequireWallet();

  const isConnected = !!address && !!signature;

  if (isConnected) {
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
