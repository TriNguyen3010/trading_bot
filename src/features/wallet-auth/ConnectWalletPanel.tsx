// =============================================================================
// PLACEHOLDER UI · Connect wallet panel body
//
// TODO(wallet-team): replace this component with the final Coin98 visual.
// Keep these contract points stable so the rest of the app keeps working:
//   - reads useWalletStore.status to drive UI state
//   - calls useWalletStore.connect() when user accepts
//   - calls props.onCancel when user dismisses
//   - signals "ready" by transitioning useWalletStore.status to 'ready'
// =============================================================================

import { CheckCircle2, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWalletStore } from './wallet.store';

export interface ConnectWalletPanelProps {
  onCancel?: () => void;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectWalletPanel({ onCancel }: ConnectWalletPanelProps) {
  const status = useWalletStore((s) => s.status);
  const error = useWalletStore((s) => s.error);
  const address = useWalletStore((s) => s.address);
  const signingMessage = useWalletStore((s) => s.signingMessage);
  const connect = useWalletStore((s) => s.connect);

  const busy =
    status === 'detecting' ||
    status === 'connecting' ||
    status === 'signing';

  const buttonLabel = (() => {
    switch (status) {
      case 'detecting':
        return 'Đang tìm Coin98…';
      case 'connecting':
        return 'Đang chờ Coin98 chấp thuận…';
      case 'signing':
        return 'Đang chờ ký…';
      case 'ready':
        return 'Đã kết nối ✓';
      case 'no-c98':
        return 'Install Coin98 →';
      default:
        return 'Connect Coin98 Wallet';
    }
  })();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          Sign in
        </div>
        <h2 className="mt-1 text-2xl font-semibold leading-tight text-fg">
          Connect your wallet
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-fg-secondary">
          Your wallet is your identity. It signs trades. Keys never leave
          Coin98.
        </p>
      </div>

      {/* Step indicator — visible during the flow so user sees progress. */}
      {(status === 'detecting' ||
        status === 'connecting' ||
        status === 'signing') && (
        <ol className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-base/60 p-3 text-[12px]">
          <StepRow
            label="Tìm ví Coin98"
            state={
              status === 'detecting'
                ? 'active'
                : 'done'
            }
          />
          <StepRow
            label={
              address
                ? `Kết nối ví · ${truncateAddress(address)}`
                : 'Kết nối ví (mở Coin98 để chấp thuận)'
            }
            state={
              status === 'connecting'
                ? 'active'
                : status === 'detecting'
                  ? 'pending'
                  : 'done'
            }
          />
          <StepRow
            label="Ký xác thực phiên đăng nhập"
            state={status === 'signing' ? 'active' : 'pending'}
          />
        </ol>
      )}

      {/* Wallet address card — appears as soon as we discover the account. */}
      {address && status !== 'ready' && (
        <div className="rounded-lg border border-border bg-input p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
              Wallet
            </div>
            <Wallet className="h-3.5 w-3.5 text-fg-muted" />
          </div>
          <div className="mt-1 break-all font-mono text-[12px] font-semibold text-fg">
            {address}
          </div>
        </div>
      )}

      {/* Signing message preview — shown while waiting for personal_sign. */}
      {status === 'signing' && signingMessage && (
        <div className="rounded-lg border border-brand/30 bg-brand-soft p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-brand">
            Message to sign
          </div>
          <pre className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-fg-secondary">
            {signingMessage}
          </pre>
          <p className="mt-2 text-[11px] text-fg-muted">
            Off-chain signature only — no transaction, no gas.
          </p>
        </div>
      )}

      {status === 'ready' && address && (
        <div className="flex items-start gap-3 rounded-lg border border-bullish/30 bg-bullish/10 p-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-bullish" />
          <div>
            <div className="text-[12px] font-semibold text-bullish">
              Đã kết nối
            </div>
            <div className="mt-0.5 break-all font-mono text-[11px] text-fg-secondary">
              {address}
            </div>
          </div>
        </div>
      )}

      {status === 'error' && error && (
        <div className="rounded-lg border border-bearish/40 bg-bearish/10 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-bearish">
            Signature rejected
          </div>
          <p className="mt-1 text-[13px] text-fg-secondary">{error}</p>
        </div>
      )}

      <Button
        variant="primary"
        className="w-full"
        disabled={busy || status === 'ready'}
        onClick={() => {
          void connect();
        }}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === 'ready' && <CheckCircle2 className="h-4 w-4" />}
        {buttonLabel}
      </Button>

      <div className="flex items-center justify-between text-[11px] text-fg-muted">
        <span>
          By connecting, you accept that you alone control the keys and the
          strategy.
        </span>
        {onCancel && status !== 'ready' && (
          <button
            type="button"
            onClick={onCancel}
            className="ml-3 shrink-0 text-fg-secondary hover:text-fg"
          >
            Cancel
          </button>
        )}
      </div>

      {/* DEV NOTE — visible to dev only. Remove or comment out before prod. */}
      <div className="rounded-md border border-dashed border-cyan/40 bg-cyan/5 px-3 py-2 text-[10px] leading-relaxed text-cyan/90">
        <span className="font-semibold">PLACEHOLDER UI</span> · final visual +
        real wallet logic owned by external team. Stub <code>connect()</code>{' '}
        plays detect → connecting → signing → ready over ~3.2s for end-to-end
        demo.
      </div>
    </div>
  );
}

interface StepRowProps {
  label: string;
  state: 'pending' | 'active' | 'done';
}

function StepRow({ label, state }: StepRowProps) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={
          state === 'done'
            ? 'flex h-4 w-4 items-center justify-center rounded-full bg-bullish/20 text-bullish'
            : state === 'active'
              ? 'flex h-4 w-4 items-center justify-center rounded-full bg-brand/20 text-brand'
              : 'flex h-4 w-4 items-center justify-center rounded-full border border-border-subtle text-fg-disabled'
        }
      >
        {state === 'done' && <CheckCircle2 className="h-3 w-3" />}
        {state === 'active' && (
          <Loader2 className="h-3 w-3 animate-spin" />
        )}
      </span>
      <span
        className={
          state === 'done'
            ? 'text-fg-secondary'
            : state === 'active'
              ? 'text-fg'
              : 'text-fg-disabled'
        }
      >
        {label}
      </span>
    </li>
  );
}
