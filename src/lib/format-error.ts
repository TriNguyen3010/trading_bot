import { HttpError, ValidationError } from './http';

export function formatBackendError(err: unknown): string {
  if (err instanceof ValidationError) {
    return err.detail
      .map((d) => `${d.loc.join('.') || '(root)'}: ${d.msg}`)
      .join('\n');
  }
  if (err instanceof HttpError) {
    // Body từ BE thường là JSON `{detail: "..."}` hoặc text. Cố parse JSON trước.
    try {
      const parsed = JSON.parse(err.body) as { detail?: unknown };
      if (typeof parsed.detail === 'string')
        return `${err.status}: ${parsed.detail}`;
      if (Array.isArray(parsed.detail))
        return `${err.status}:\n${parsed.detail.map(String).join('\n')}`;
      return `${err.status}: ${err.body || err.message}`;
    } catch {
      return `${err.status}: ${err.body || err.message}`;
    }
  }
  if (err instanceof Error && err.message === 'Network error') {
    return 'Không thể kết nối server';
  }
  return err instanceof Error ? err.message : String(err);
}
