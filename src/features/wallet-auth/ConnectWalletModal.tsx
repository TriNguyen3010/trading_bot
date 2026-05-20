import { useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useWalletStore } from './wallet.store';
import { ConnectWalletPanel } from './ConnectWalletPanel';

export interface ConnectWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once after the user successfully connects + signs. */
  onSuccess?: () => void;
}

function truncate(addr: string | null): string {
  if (!addr || addr.length < 12) return addr ?? '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function ConnectWalletModal({
  open,
  onOpenChange,
  onSuccess,
}: ConnectWalletModalProps) {
  const status = useWalletStore((s) => s.status);
  const address = useWalletStore((s) => s.address);
  const reset = useWalletStore((s) => s.reset);

  useEffect(() => {
    if (open && status === 'ready') {
      // Hold the success state visible briefly so the user sees the green
      // checkmark, then close + fire toast + run the pending action.
      const timer = setTimeout(() => {
        toast.success(`Đã kết nối ${truncate(address)}`, {
          description: 'Phiên đăng nhập sẵn sàng — chuyển sang builder…',
        });
        if (onSuccess) onSuccess();
        onOpenChange(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [open, status, address, onSuccess, onOpenChange]);

  useEffect(() => {
    // When modal closes without success, leave creds untouched but clear
    // transient UI states so re-opening starts clean.
    if (!open && status !== 'ready') {
      // Only soft-reset transient state, not the credentials.
      useWalletStore.setState({ status: 'idle', error: null });
    }
  }, [open, status]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          // Cancel mid-flow: reset the credentials side too so the next
          // attempt starts fresh (stub-only behavior; real impl may differ).
          if (status !== 'ready') reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-[440px] border border-white/[0.08] bg-white/[0.05] p-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-[100px]">
        <DialogTitle className="sr-only">Connect Coin98 Wallet</DialogTitle>
        <DialogDescription className="sr-only">
          Authorize Trading Bot with your Coin98 wallet to continue.
        </DialogDescription>
        <div className="p-6">
          <ConnectWalletPanel onCancel={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
