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

// Endpoints that BE explicitly does NOT require auth headers on
// (see BE Q1 response from Tuấn, 2026-05-14).
const PUBLIC_PATHS = [
  '/wallet/nonce',
  '/internal/',
  '/webhook/',
  '/docs',
  '/openapi',
  '/health',
];

// Endpoints with their own error UX (red box in dialog) → http.ts
// suppresses toast. 401 still triggers global clear+redirect.
const SILENT_TOAST_PREFIXES = ['/bot-strategy/', '/bot/'];

const STORAGE_KEY = 'trading_bot_wallet_auth';

interface WalletCreds {
  address: string;
  nonce: string;
  signature: string;
}

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

function hasSilentToast(path: string): boolean {
  return SILENT_TOAST_PREFIXES.some((p) => path.startsWith(p));
}

function getWalletCreds(): WalletCreds | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WalletCreds>;
    if (!parsed.address || !parsed.nonce || !parsed.signature) return null;
    return parsed as WalletCreds;
  } catch {
    return null;
  }
}

function clearWalletAuth() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';
const BYPASS_AUTH = import.meta.env.VITE_BYPASS_AUTH === 'true';

export async function http<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${baseURL}${path}`;
  const creds = getWalletCreds();
  const isPublic = isPublicPath(path);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (creds && !isPublic && !BYPASS_AUTH) {
    headers['X-Wallet-Address'] = creds.address;
    headers['X-Wallet-Nonce'] = creds.nonce;
    headers['X-Wallet-Signature'] = creds.signature;
  }

  const silentToast = hasSilentToast(path);

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

  // 401 anywhere → session expired / nonce invalid → clear + redirect to
  // landing. Em's defer-auth UX uses Landing page as the public entry,
  // not a forced /connect route — user re-triggers the wallet modal via
  // the header chip or CTA click on Landing.
  if (res.status === 401 && !BYPASS_AUTH) {
    clearWalletAuth();
    toast.warning('Phiên ví hết hạn, vui lòng kết nối lại.');
    window.location.href = '/';
    throw new HttpError(401, 'Unauthorized');
  }

  // 403 = sig mismatch / user deactivated / lack permission. Per spec §4.4:
  // toast (BE-provided message), no clear, no redirect, no auto-retry.
  // BE returns a different message per case → pass-through so the user
  // sees the actual reason.
  if (res.status === 403) {
    if (!silentToast) {
      const text = await res.text().catch(() => '');
      let msg = 'Quyền truy cập bị từ chối.';
      try {
        const data = JSON.parse(text) as { detail?: string };
        if (typeof data.detail === 'string' && data.detail.trim())
          msg = data.detail;
      } catch {
        if (text.trim()) msg = text;
      }
      toast.error(msg);
    }
    throw new HttpError(403, 'Forbidden');
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
