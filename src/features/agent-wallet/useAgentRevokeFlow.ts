import { useCallback, useState } from 'react';
import { agentApi } from './agent.api';
import { eip712Sign, extractNonceFromSignPayload } from './agent-helpers';
import {
  detectCoin98,
  UserRejectedError,
  NoProviderError,
} from '@/features/wallet-auth/wallet.provider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';

export type RevokeTarget =
  | { type: 'app-managed'; agentId: number }
  | { type: 'external'; agentName: string };

export type AgentRevokeFlowState =
  | { stage: 'idle' }
  | { stage: 'fetching-payload' }
  | { stage: 'signing' }
  | { stage: 'submitting' }
  | { stage: 'success' }
  | { stage: 'error'; message: string; userRejected: boolean };

export interface UseAgentRevokeFlowResult {
  state: AgentRevokeFlowState;
  run: (target: RevokeTarget) => Promise<void>;
  reset: () => void;
}

export function useAgentRevokeFlow(): UseAgentRevokeFlowResult {
  const [state, setState] = useState<AgentRevokeFlowState>({ stage: 'idle' });

  const run = useCallback(async (target: RevokeTarget) => {
    const walletAddress = useWalletStore.getState().address;
    if (!walletAddress) {
      setState({
        stage: 'error',
        message: 'Wallet not connected',
        userRejected: false,
      });
      return;
    }
    const provider = detectCoin98();
    if (!provider) {
      setState({
        stage: 'error',
        message: 'Wallet not found — please install Coin98',
        userRejected: false,
      });
      return;
    }

    try {
      setState({ stage: 'fetching-payload' });

      let signPayload: unknown;
      if (target.type === 'app-managed') {
        const res = await agentApi.revokePayload(target.agentId);
        signPayload = res.sign_payload;
      } else {
        const res = await agentApi.externalRevokePayload(target.agentName);
        signPayload = res.sign_payload;
      }

      setState({ stage: 'signing' });
      const signature = await eip712Sign(provider, walletAddress, signPayload);
      const nonce = extractNonceFromSignPayload(signPayload);

      setState({ stage: 'submitting' });
      if (target.type === 'app-managed') {
        await agentApi.revoke(target.agentId, {
          wallet_address: walletAddress,
          nonce,
          signature,
        });
      } else {
        await agentApi.externalRevoke({
          wallet_address: walletAddress,
          agent_name: target.agentName,
          nonce,
          signature,
        });
      }

      setState({ stage: 'success' });
    } catch (err) {
      const userRejected = err instanceof UserRejectedError;
      const noProvider = err instanceof NoProviderError;
      setState({
        stage: 'error',
        message: userRejected
          ? 'Signature rejected — agent was not revoked'
          : noProvider
            ? 'Wallet not found — please install Coin98'
            : err instanceof Error
              ? err.message
              : 'Unknown error',
        userRejected,
      });
    }
  }, []);

  const reset = useCallback(() => setState({ stage: 'idle' }), []);

  return { state, run, reset };
}
