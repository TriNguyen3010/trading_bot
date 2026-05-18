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
      <button
        type="button"
        onClick={() => {
          void disconnect();
        }}
        title="Click to disconnect"
        className="inline-flex items-center gap-2 rounded-lg border border-bullish/30 bg-bullish/10 px-3 py-1.5 text-[12px] text-bullish hover:bg-bullish/15"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-bullish" />
        <span className="font-mono tabular-nums text-fg">
          {truncateAddress(address)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openConnect}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-input px-3 py-1.5 text-[12px] text-fg-secondary hover:border-brand hover:text-fg"
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-brand text-[7px] font-bold leading-none text-black">
        C98
      </span>
      Connect wallet
    </button>
  );
}
