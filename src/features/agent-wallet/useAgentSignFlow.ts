import { useCallback, useState } from 'react';
import { agentApi } from './agent.api';
import {
  eip712Sign,
  extractNonceFromSignPayload,
  formatAgentFlowError,
} from './agent-helpers';
import {
  detectCoin98,
  UserRejectedError,
  NoProviderError,
} from '@/features/wallet-auth/wallet.provider';
import { useWalletStore } from '@/features/wallet-auth/wallet.store';
import type { AgentCreateResponse } from '@/types/api-helpers';

export type AgentFlowState =
  | { stage: 'idle' }
  | { stage: 'creating' }
  | { stage: 'signing'; agentAddress: string }
  | { stage: 'confirming' }
  | { stage: 'success'; agent: AgentCreateResponse }
  | { stage: 'error'; message: string; userRejected: boolean };

export interface UseAgentSignFlowResult {
  state: AgentFlowState;
  run: (opts: {
    label?: string;
    spendingLimitUsd?: number | null;
  }) => Promise<void>;
  reset: () => void;
}

export function useAgentSignFlow(): UseAgentSignFlowResult {
  const [state, setState] = useState<AgentFlowState>({ stage: 'idle' });

  const run = useCallback(
    async (opts: { label?: string; spendingLimitUsd?: number | null }) => {
      const walletAddress = useWalletStore.getState().address;
      if (!walletAddress) {
        setState({
          stage: 'error',
          message: 'Wallet chưa connect',
          userRejected: false,
        });
        return;
      }
      const provider = detectCoin98();
      if (!provider) {
        setState({
          stage: 'error',
          message: 'Không tìm thấy ví — vui lòng cài Coin98',
          userRejected: false,
        });
        return;
      }

      try {
        setState({ stage: 'creating' });
        const prep = await agentApi.create({
          label: opts.label ?? null,
          spending_limit_usd: opts.spendingLimitUsd ?? null,
        });

        setState({ stage: 'signing', agentAddress: prep.agent_address });
        const signature = await eip712Sign(
          provider,
          walletAddress,
          prep.sign_payload,
        );

        setState({ stage: 'confirming' });
        const agent = await agentApi.confirm({
          wallet_address: walletAddress,
          agent_address: prep.agent_address,
          signature,
          nonce: extractNonceFromSignPayload(prep.sign_payload),
        });

        setState({ stage: 'success', agent });
      } catch (err) {
        const userRejected = err instanceof UserRejectedError;
        const noProvider = err instanceof NoProviderError;
        setState({
          stage: 'error',
          message: userRejected
            ? 'Bạn đã huỷ ký — agent không được tạo'
            : // Belt-and-suspenders: unreachable on current path — run() already guards
              // non-null provider before calling eip712Sign, which only throws
              // NoProviderError on a falsy provider argument.
              noProvider
              ? 'Không tìm thấy ví — vui lòng cài Coin98'
              : formatAgentFlowError(err),
          userRejected,
        });
      }
    },
    [],
  );

  const reset = useCallback(() => setState({ stage: 'idle' }), []);

  return { state, run, reset };
}
