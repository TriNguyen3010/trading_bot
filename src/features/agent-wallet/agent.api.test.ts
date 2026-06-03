import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http } from '@/lib/http';
import { agentApi } from './agent.api';

vi.mock('@/lib/http', () => ({ http: vi.fn() }));
const mockHttp = vi.mocked(http);
beforeEach(() => mockHttp.mockReset());

describe('agentApi.create', () => {
  it('POSTs /agent/create with label + spending_limit_usd', async () => {
    mockHttp.mockResolvedValue({
      agent_address: '0xagent',
      label: 'main',
      spending_limit_usd: 1000,
      sign_payload: { primaryType: 'ApproveAgent' },
    });
    const res = await agentApi.create({
      label: 'main',
      spending_limit_usd: 1000,
    });
    expect(mockHttp).toHaveBeenCalledWith('POST', '/agent/create', {
      label: 'main',
      spending_limit_usd: 1000,
    });
    expect(res.agent_address).toBe('0xagent');
  });
});

describe('agentApi.confirm', () => {
  it('POSTs /agent/confirm with signature + nonce', async () => {
    mockHttp.mockResolvedValue({
      id: 1,
      agent_address: '0xagent',
      label: null,
      spending_limit_usd: null,
      is_active: true,
      spent_today_usd: 0,
      created_at: '2026-05-28T00:00:00Z',
    });
    await agentApi.confirm({
      wallet_address: '0xuser',
      agent_address: '0xagent',
      signature: '0xsig',
      nonce: 1234,
    });
    expect(mockHttp).toHaveBeenCalledWith('POST', '/agent/confirm', {
      wallet_address: '0xuser',
      agent_address: '0xagent',
      signature: '0xsig',
      nonce: 1234,
    });
  });
});

describe('agentApi.active', () => {
  it('GETs /agent/active', async () => {
    mockHttp.mockResolvedValue(null);
    await agentApi.active();
    expect(mockHttp).toHaveBeenCalledWith('GET', '/agent/active');
  });
});

describe('agentApi.list', () => {
  it('GETs /agent/list', async () => {
    mockHttp.mockResolvedValue([]);
    await agentApi.list();
    expect(mockHttp).toHaveBeenCalledWith('GET', '/agent/list');
  });
});

describe('agentApi.checkLimit', () => {
  it('POSTs /agent/check-limit', async () => {
    mockHttp.mockResolvedValue({ allowed: true, reason: 'ok' });
    await agentApi.checkLimit({ amount_usd: 200 });
    expect(mockHttp).toHaveBeenCalledWith('POST', '/agent/check-limit', {
      amount_usd: 200,
    });
  });
});

describe('agentApi.hyperliquidWallets', () => {
  it('GETs /agent/hyperliquid-wallets', async () => {
    mockHttp.mockResolvedValue([]);
    await agentApi.hyperliquidWallets();
    expect(mockHttp).toHaveBeenCalledWith('GET', '/agent/hyperliquid-wallets');
  });
});

describe('agentApi.syncStatus', () => {
  it('GETs /agent/sync-status', async () => {
    mockHttp.mockResolvedValue({
      has_db_active_agent: false,
      db_active_agent_id: null,
      db_active_agent_address: null,
      onchain_verification_status: 'ok',
      onchain_active_addresses: [],
      is_db_agent_onchain_active: null,
      mismatch_db_active_but_onchain_missing: false,
      message: 'no agent',
    });
    await agentApi.syncStatus();
    expect(mockHttp).toHaveBeenCalledWith('GET', '/agent/sync-status');
  });
});

describe('agentApi.revokePayload', () => {
  it('GETs /agent/{id}/revoke-payload with agent_id in path', async () => {
    mockHttp.mockResolvedValue({ sign_payload: {} });
    await agentApi.revokePayload(42);
    expect(mockHttp).toHaveBeenCalledWith('GET', '/agent/42/revoke-payload');
  });
});

describe('agentApi.revoke', () => {
  it('POSTs /agent/{id}/revoke with AgentRevokeRequest body', async () => {
    mockHttp.mockResolvedValue(undefined);
    await agentApi.revoke(42, {
      wallet_address: '0xmaster',
      nonce: 12345,
      signature: '0xsig',
    });
    expect(mockHttp).toHaveBeenCalledWith('POST', '/agent/42/revoke', {
      wallet_address: '0xmaster',
      nonce: 12345,
      signature: '0xsig',
    });
  });
});

describe('agentApi.externalRevokePayload', () => {
  it('GETs /agent/external-revoke-payload?agent_name=<name>', async () => {
    mockHttp.mockResolvedValue({ sign_payload: {} });
    await agentApi.externalRevokePayload('my-agent');
    expect(mockHttp).toHaveBeenCalledWith(
      'GET',
      '/agent/external-revoke-payload?agent_name=my-agent',
    );
  });

  it('uses empty string when name is empty', async () => {
    mockHttp.mockResolvedValue({ sign_payload: {} });
    await agentApi.externalRevokePayload('');
    expect(mockHttp).toHaveBeenCalledWith(
      'GET',
      '/agent/external-revoke-payload?agent_name=',
    );
  });
});

describe('agentApi.externalRevoke', () => {
  it('POSTs /agent/external-revoke with ExternalRevokeRequest body', async () => {
    mockHttp.mockResolvedValue(undefined);
    await agentApi.externalRevoke({
      wallet_address: '0xmaster',
      agent_name: 'my-agent',
      nonce: 999,
      signature: '0xsig',
    });
    expect(mockHttp).toHaveBeenCalledWith('POST', '/agent/external-revoke', {
      wallet_address: '0xmaster',
      agent_name: 'my-agent',
      nonce: 999,
      signature: '0xsig',
    });
  });
});
