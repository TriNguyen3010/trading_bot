import { http } from '@/lib/http';
import type { AuthUser, LoginRequest, TokenResponse } from './auth.types';

export const authApi = {
  login: (body: LoginRequest) =>
    http<TokenResponse>('POST', '/user/login', body),
  getStatus: () => http<AuthUser>('GET', '/user/status'),
};
