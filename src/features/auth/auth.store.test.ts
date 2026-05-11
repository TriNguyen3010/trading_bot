import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from './auth.store';

vi.mock('./auth.api', () => ({
  authApi: {
    login: vi.fn(),
    getStatus: vi.fn(),
  },
}));

import { authApi } from './auth.api';

const mockLogin = vi.mocked(authApi.login);
const mockGetStatus = vi.mocked(authApi.getStatus);

describe('auth.store', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null });
    vi.clearAllMocks();
  });

  it('starts with null token and user', () => {
    const { token, user } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  it('login sets token and fetches user', async () => {
    mockLogin.mockResolvedValueOnce({
      access_token: 'abc123',
      token_type: 'bearer',
    });
    mockGetStatus.mockResolvedValueOnce({
      id: 1,
      email: 'test@example.com',
      is_active: true,
      is_admin: false,
    });

    await useAuthStore.getState().login('test@example.com', 'pass');

    const { token, user } = useAuthStore.getState();
    expect(token).toBe('abc123');
    expect(user).toEqual({
      id: 1,
      email: 'test@example.com',
      is_active: true,
      is_admin: false,
    });
  });

  it('logout clears token and user', async () => {
    useAuthStore.setState({
      token: 'abc123',
      user: {
        id: 1,
        email: 'test@example.com',
        is_active: true,
        is_admin: false,
      },
    });

    useAuthStore.getState().logout();

    const { token, user } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  it('login propagates error on API failure', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    await expect(
      useAuthStore.getState().login('bad@email.com', 'wrong'),
    ).rejects.toThrow('Invalid credentials');

    expect(useAuthStore.getState().token).toBeNull();
  });
});
