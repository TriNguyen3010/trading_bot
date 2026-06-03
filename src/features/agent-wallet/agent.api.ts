import { http } from '@/lib/http';
import type {
  CreateAgentRequest,
  AgentPrepareResponse,
  AgentConfirmRequest,
  AgentCreateResponse,
  AgentInfoResponse,
  SpendingLimitCheckRequest,
  SpendingLimitCheckResponse,
  HyperliquidWalletResponse,
  AgentSyncStatusResponse,
  AgentRevokeRequest,
  ExternalRevokeRequest,
} from '@/types/api-helpers';

export const agentApi = {
  /** Step 1 of onboarding: gen agent keypair + EIP-712 sign payload. */
  create: (payload: CreateAgentRequest) =>
    http<AgentPrepareResponse>('POST', '/agent/create', payload),

  /** Step 2 of onboarding: submit user signature, BE relays approveAgent on-chain. */
  confirm: (payload: AgentConfirmRequest) =>
    http<AgentCreateResponse>('POST', '/agent/confirm', payload),

  /** Current active agent for the authenticated wallet (null if none). */
  active: () => http<AgentInfoResponse | null>('GET', '/agent/active'),

  /** Historical list of all agents for this wallet. */
  list: () => http<AgentInfoResponse[]>('GET', '/agent/list'),

  /** Pre-flight: is the requested USD amount within today's remaining cap? */
  checkLimit: (payload: SpendingLimitCheckRequest) =>
    http<SpendingLimitCheckResponse>('POST', '/agent/check-limit', payload),

  /** All agent wallets currently registered on-chain in the user's Hyperliquid account.
   *  Includes externally-created wallets not tracked in our DB. */
  hyperliquidWallets: () =>
    http<HyperliquidWalletResponse[]>('GET', '/agent/hyperliquid-wallets'),

  /** DB ↔ Hyperliquid on-chain sync status for the active agent. */
  syncStatus: () => http<AgentSyncStatusResponse>('GET', '/agent/sync-status'),

  /** Get EIP-712 payload to revoke a specific app-managed agent by DB id. */
  revokePayload: (agentId: number) =>
    http<{ sign_payload: unknown }>('GET', `/agent/${agentId}/revoke-payload`),

  /** Submit master-wallet EIP-712 signature to revoke an app-managed agent on-chain + DB. */
  revoke: (agentId: number, body: AgentRevokeRequest) =>
    http<void>('POST', `/agent/${agentId}/revoke`, body),

  /** Get EIP-712 payload to revoke an externally-created agent by its Hyperliquid name. */
  externalRevokePayload: (agentName: string) =>
    http<{ sign_payload: unknown }>(
      'GET',
      `/agent/external-revoke-payload?agent_name=${encodeURIComponent(agentName)}`,
    ),

  /** Submit master-wallet EIP-712 signature to revoke an external agent on Hyperliquid (no DB change). */
  externalRevoke: (body: ExternalRevokeRequest) =>
    http<void>('POST', '/agent/external-revoke', body),
};
