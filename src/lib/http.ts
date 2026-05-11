import { toast } from 'sonner';

export type ValidationDetail = {
  loc: (string | number)[];
  msg: string;
  type: string;
};

export class ValidationError extends Error {
  detail: ValidationDetail[];

  constructor(detail: ValidationDetail[]) {
    super('Validation failed');
    this.name = 'ValidationError';
    this.detail = detail;
  }
}

// BE trả 422 ở 2 format:
//   1. FastAPI default — `[{loc, msg, type}, ...]`
//   2. Gamma BE custom — `["Field 'body -> bot_name' (missing): Field required", ...]`
// Normalize cả 2 về `ValidationDetail[]` để UI render đồng nhất.
const STRING_DETAIL_RE = /^Field '([^']+)' \(([^)]+)\): (.+)$/;

export function normalizeValidationDetail(raw: unknown): ValidationDetail[] {
  if (!Array.isArray(raw)) {
    return [
      {
        loc: [],
        msg: raw == null ? 'Validation failed' : String(raw),
        type: 'unknown',
      },
    ];
  }
  return raw.map((item): ValidationDetail => {
    if (typeof item === 'string') {
      const m = STRING_DETAIL_RE.exec(item);
      if (m) {
        return {
          loc: m[1].split(/\s*->\s*/),
          msg: m[3],
          type: m[2],
        };
      }
      return { loc: [], msg: item, type: 'unknown' };
    }
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return {
        loc: Array.isArray(obj.loc) ? (obj.loc as (string | number)[]) : [],
        msg: typeof obj.msg === 'string' ? obj.msg : String(obj.msg ?? ''),
        type: typeof obj.type === 'string' ? obj.type : 'unknown',
      };
    }
    return { loc: [], msg: String(item), type: 'unknown' };
  });
}

export class HttpError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(body || `HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

// `/user/login`: 401 = sai cred (không phải session expired) + LoginPage
// đã có custom message → skip toàn bộ global side-effects.
const LOGIN_PATH = '/user/login';

// Endpoints có error UX riêng (red box in dialog) → http.ts không fire toast.
// 401 vẫn được xử lý global (clearAuth + redirect) vì có thể là token expired.
const SILENT_TOAST_PREFIXES = ['/bot-strategy/', '/bot/'];

function hasSilentToast(path: string): boolean {
  return (
    path === LOGIN_PATH || SILENT_TOAST_PREFIXES.some((p) => path.startsWith(p))
  );
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

  const silentToast = hasSilentToast(path);
  const isLoginRequest = path === LOGIN_PATH;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    if (!silentToast) {
      toast.error('Không thể kết nối server. Vui lòng kiểm tra mạng.');
    }
    throw new Error('Network error');
  }

  // 401 on /user/login = wrong credentials → LoginPage render error, no redirect.
  // 401 elsewhere = session expired → clear auth + redirect to login.
  if (res.status === 401 && !isLoginRequest) {
    clearAuth();
    toast.warning('Phiên hết hạn, vui lòng đăng nhập lại.');
    window.location.href = '/login';
    throw new HttpError(401, 'Unauthorized');
  }

  if (res.status === 422) {
    const data = (await res.json().catch(() => ({}))) as { detail?: unknown };
    throw new ValidationError(normalizeValidationDetail(data?.detail));
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    if (!silentToast) {
      toast.error(text || 'Đã có lỗi xảy ra.');
    }
    throw new HttpError(res.status, text);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
