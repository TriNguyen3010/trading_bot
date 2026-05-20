import { describe, it, expect } from 'vitest';
import { formatBackendError } from './format-error';
import { HttpError, ValidationError } from './http';

describe('formatBackendError', () => {
  it('formats ValidationError as field.path: msg per line', () => {
    const err = new ValidationError([
      { loc: ['body', 'bot_name'], msg: 'Field required', type: 'missing' },
      {
        loc: ['body', 'stake_amount'],
        msg: 'must be > 0',
        type: 'value_error',
      },
    ]);
    expect(formatBackendError(err)).toBe(
      'body.bot_name: Field required\nbody.stake_amount: must be > 0',
    );
  });

  it('uses "(root)" when ValidationError loc is empty', () => {
    const err = new ValidationError([
      { loc: [], msg: 'boom', type: 'unknown' },
    ]);
    expect(formatBackendError(err)).toBe('(root): boom');
  });

  it('parses HttpError JSON body and shows {status}: {detail}', () => {
    const err = new HttpError(400, '{"detail":"Strategy name already exists"}');
    expect(formatBackendError(err)).toBe('400: Strategy name already exists');
  });

  it('joins array detail in HttpError JSON body', () => {
    const err = new HttpError(400, '{"detail":["x","y"]}');
    expect(formatBackendError(err)).toBe('400:\nx\ny');
  });

  it('falls back to raw body when HttpError body is not JSON', () => {
    const err = new HttpError(500, 'Internal Server Error');
    expect(formatBackendError(err)).toBe('500: Internal Server Error');
  });

  it('falls back to status when HttpError body is empty', () => {
    const err = new HttpError(502, '');
    expect(formatBackendError(err)).toBe('502: HTTP 502');
  });

  it('returns localized message for Network error', () => {
    expect(formatBackendError(new Error('Network error'))).toBe(
      'Không thể kết nối server',
    );
  });

  it('falls back to message for generic Error', () => {
    expect(formatBackendError(new Error('something broke'))).toBe(
      'something broke',
    );
  });

  it('stringifies non-Error values', () => {
    expect(formatBackendError('boom')).toBe('boom');
    expect(formatBackendError(null)).toBe('null');
  });
});
