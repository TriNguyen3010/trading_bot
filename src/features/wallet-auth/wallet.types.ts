export interface WalletCredentials {
  address: string;
  nonce: string;
  signature: string;
}

export interface AuthUser {
  id: number;
  email: string | null;
  wallet_address: string;
  is_active: boolean;
  is_admin: boolean;
}

export type WalletStatus =
  | 'idle'
  | 'detecting'
  | 'no-c98'
  | 'connecting'
  | 'signing'
  | 'ready'
  | 'error';

export interface NonceResponse {
  nonce: string;
  message: string;
}

// Minimal EIP-1193 provider shape we actually call.
export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
}
