export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
}

export interface AuthUser {
  id: number;
  email: string;
  is_active: boolean;
  is_admin: boolean;
}
