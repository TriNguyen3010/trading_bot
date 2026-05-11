import { toast } from 'sonner';

export class ValidationError extends Error {
  detail: Array<{ loc: (string | number)[]; msg: string; type: string }>;

  constructor(
    detail: Array<{ loc: (string | number)[]; msg: string; type: string }>,
  ) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.detail = detail;
  }
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function clearAuth() {
  try {
    localStorage.removeItem('auth-storage');
  } catch {
    /* noop */
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function http<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${baseURL}${path}`;
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    toast.error('Không thể kết nối server. Vui lòng kiểm tra mạng.');
    throw new Error('Network error');
  }

  if (res.status === 401) {
    clearAuth();
    toast.warning('Phiên hết hạn, vui lòng đăng nhập lại.');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (res.status === 422) {
    const data = (await res.json()) as {
      detail: Array<{ loc: (string | number)[]; msg: string; type: string }>;
    };
    throw new ValidationError(data.detail);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    toast.error(text || 'Đã có lỗi xảy ra.');
    throw new Error(text || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
