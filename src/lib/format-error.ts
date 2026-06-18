import { HttpError, ValidationError } from './http';

export function formatBackendError(err: unknown): string {
  if (err instanceof ValidationError) {
    return err.detail
      .map((d) => `${d.loc.join('.') || '(root)'}: ${d.msg}`)
      .join('\n');
  }
  if (err instanceof HttpError) {
    // BE body is usually JSON `{detail: "..."}` or plain text. Try JSON first.
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
    return 'Could not reach the server';
  }
  return err instanceof Error ? err.message : String(err);
}
