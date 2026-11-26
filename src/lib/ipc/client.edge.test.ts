// QA T-002: граничные случаи `call()` / `toAppError()`.
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it } from 'vitest';
import { rejectWith } from '../../test/ipc.js';
import { call, commands, toAppError } from './client.js';

afterEach(() => {
  clearMocks();
});

describe('call() edge cases', () => {
  it('passes Unicode and large payloads through app_ping unchanged', async () => {
    mockIPC((cmd, payload) =>
      cmd === 'app_ping' ? (payload as { message: string }).message : undefined,
    );
    for (const message of ['Привет, мир! 👋🏽 ñ 中文 \u0000', 'я'.repeat(1_000_000)]) {
      await expect(call(() => commands.appPing(message))).resolves.toEqual({
        ok: true,
        data: message,
      });
    }
  });

  it('is stable across repeated calls with alternating outcomes', async () => {
    mockIPC((_cmd, payload) => {
      const { message } = payload as { message: string };
      return message === ''
        ? rejectWith({ code: 'app.invalid_argument', message: 'empty' })
        : message;
    });
    for (let i = 0; i < 20; i += 1) {
      const result = await call(() => commands.appPing(i % 2 === 0 ? '' : `m${i}`));
      expect(result.ok).toBe(i % 2 !== 0);
    }
  });
});

describe('toAppError() edge cases', () => {
  it('fills an empty message when a known code arrives without one', () => {
    expect(toAppError({ code: 'app.invalid_argument' })).toEqual({
      code: 'app.invalid_argument',
      message: '',
    });
  });

  it('ignores a non-string message and undefined details', () => {
    expect(toAppError({ code: 'app.internal', message: 42, details: undefined })).toEqual({
      code: 'app.internal',
      message: '',
    });
  });

  it('does not treat inherited keys as known codes', () => {
    expect(toAppError({ code: 'toString', message: 'x' }).code).toBe('app.internal');
    expect(toAppError({ code: '__proto__', message: 'x' }).code).toBe('app.internal');
  });

  it('stringifies primitives', () => {
    expect(toAppError(undefined)).toEqual({ code: 'app.internal', message: 'undefined' });
    expect(toAppError(7)).toEqual({ code: 'app.internal', message: '7' });
  });
});
