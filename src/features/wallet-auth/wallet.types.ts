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
