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
