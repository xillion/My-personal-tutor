import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it } from 'vitest';
import { rejectWith } from '../../test/ipc.js';
import { changeLocale } from '#lib/i18n/locale.js';
import { baseLocale } from '#lib/paraglide/runtime.js';
import { call, commands, errorMessage, toAppError, type AppErrorCode } from './client.js';

afterEach(async () => {
  clearMocks();
  await changeLocale(baseLocale, { reload: false });
  localStorage.clear();
});

describe('call()', () => {
  it('returns ok with data for app_ping', async () => {
    let received: unknown;
    mockIPC((cmd, payload) => {
      received = { cmd, payload };
      if (cmd === 'app_ping') return (payload as { message: string }).message;
      return undefined;
    });
    await expect(call(() => commands.appPing('hello'))).resolves.toEqual({
      ok: true,
      data: 'hello',
    });
    expect(received).toEqual({ cmd: 'app_ping', payload: { message: 'hello' } });
  });

  it('returns a typed AppError rejected by the command', async () => {
    mockIPC(() =>
      rejectWith({
        code: 'app.invalid_argument',
        message: 'message must not be empty',
        details: { field: 'message' },
      }),
    );
    await expect(call(() => commands.appPing(''))).resolves.toEqual({
      ok: false,
      error: {
        code: 'app.invalid_argument',
        message: 'message must not be empty',
        details: { field: 'message' },
      },
    });
  });

  it('turns a framework string error into app.internal', async () => {
    mockIPC(() => rejectWith('Command app_nope not found'));
    await expect(call(() => commands.appPing('x'))).resolves.toEqual({
      ok: false,
      error: { code: 'app.internal', message: 'Command app_nope not found' },
    });
  });

  it('turns an object with an unknown code into app.internal', async () => {
    mockIPC(() => rejectWith({ code: 'db.unknown', message: 'nope' }));
    const result = await call(() => commands.appPing('x'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('app.internal');
  });

  it('turns a thrown Error into app.internal instead of rejecting', async () => {
    mockIPC(() => {
      throw new Error('IPC bridge is gone');
    });
    await expect(call(() => commands.appInfo())).resolves.toEqual({
      ok: false,
      error: { code: 'app.internal', message: 'IPC bridge is gone' },
    });
  });

  it('turns a throwing command function into app.internal', async () => {
    const result = await call<string>(() => {
      throw new TypeError('not a function');
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'app.internal', message: 'not a function' },
    });
  });
});

describe('toAppError()', () => {
  it('keeps a well-formed AppError without details', () => {
    expect(toAppError({ code: 'app.internal', message: 'boom' })).toEqual({
      code: 'app.internal',
      message: 'boom',
    });
  });

  it('stringifies null and non-AppError objects', () => {
    expect(toAppError(null)).toEqual({ code: 'app.internal', message: 'null' });
    expect(toAppError({ reason: 'x' })).toEqual({
      code: 'app.internal',
      message: '{"reason":"x"}',
    });
  });
});

describe('errorMessage()', () => {
  const expected: Record<'ru' | 'en', Record<AppErrorCode, string>> = {
    ru: {
      'app.internal': 'Ой, что-то пошло не так. Попробуй ещё раз чуть позже.',
      'app.invalid_argument': 'Кажется, тут чего-то не хватает. Проверь и попробуй ещё раз.',
    },
    en: {
      'app.internal': 'Oops, something went wrong. Please try again a little later.',
      'app.invalid_argument': 'Looks like something is missing here. Check it and try again.',
    },
  };

  for (const locale of ['ru', 'en'] as const) {
    for (const [code, text] of Object.entries(expected[locale]) as [AppErrorCode, string][]) {
      it(`translates ${code} in ${locale}`, async () => {
        await changeLocale(locale, { reload: false });
        expect(errorMessage(code)).toBe(text);
      });
    }
  }
});
