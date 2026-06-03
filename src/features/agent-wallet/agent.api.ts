import { http } from '@/lib/http';
import type {
  CreateAgentRequest,
  AgentPrepareResponse,
  AgentConfirmRequest,
  AgentCreateResponse,
  AgentInfoResponse,
  SpendingLimitCheckRequest,
  SpendingLimitCheckResponse,
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
};
