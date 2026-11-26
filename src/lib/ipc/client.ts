// Единая точка входа фронтенда в IPC (CLAUDE.md, правило 5; ADR-10, ADR-11).
//
// Фичи импортируют только `#lib/ipc/client.js`: сгенерированный `bindings.ts` напрямую не
// используется, чтобы все вызовы проходили через `call()` и нормализацию ошибок.
import { m } from '#lib/paraglide/messages.js';
import { commands, type AppError, type AppErrorCode, type AppInfoDto } from './bindings.js';

export { commands };
export type { AppError, AppErrorCode, AppInfoDto };

/** Результат команды для фич: успех с данными или типизированная ошибка. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

/** Форма результата, которую возвращают команды `tauri-specta` из `bindings.ts`. */
export type CommandResult<T> = { status: 'ok'; data: T } | { status: 'error'; error: AppError };

/**
 * Известные коды. `satisfies` требует ключ для каждого варианта `AppErrorCode`, поэтому
 * новый код без записи здесь (как и без ветки в `errorMessage`) ломает `pnpm check`.
 */
const KNOWN_CODES = {
  'app.internal': true,
  'app.invalid_argument': true,
} as const satisfies Record<AppErrorCode, true>;

function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === 'string' && Object.hasOwn(KNOWN_CODES, value);
}

/**
 * Приводит значение из ветки ошибки к `AppError`.
 *
 * Типизированы только ошибки наших команд. Ошибки фреймворка (неизвестная команда, неверные
 * аргументы, отказ ACL) приходят строкой, хотя `bindings.ts` объявляет их как `AppError`;
 * они и объекты с неизвестным кодом сводятся к `app.internal`.
 */
export function toAppError(raw: unknown): AppError {
  if (typeof raw === 'object' && raw !== null && 'code' in raw && isAppErrorCode(raw.code)) {
    const message = 'message' in raw && typeof raw.message === 'string' ? raw.message : '';
    const error: AppError = { code: raw.code, message };
    if ('details' in raw && raw.details !== undefined) error.details = raw.details;
    return error;
  }
  if (raw instanceof Error) return { code: 'app.internal', message: raw.message };
  if (typeof raw === 'object' && raw !== null) {
    return { code: 'app.internal', message: JSON.stringify(raw) };
  }
  return { code: 'app.internal', message: String(raw) };
}

/**
 * Выполняет команду и возвращает `{ ok: true, data } | { ok: false, error }`. Никогда не
 * отклоняется: исключения (в том числе `Error`, который пробрасывает рантайм `tauri-specta`)
 * становятся `app.internal`.
 *
 * @example
 * const result = await call(() => commands.appPing('hello'));
 * if (result.ok) console.log(result.data);
 * else showToast(errorMessage(result.error.code));
 */
export async function call<T>(command: () => Promise<CommandResult<T>>): Promise<Result<T>> {
  try {
    const result = await command();
    if (result.status === 'ok') return { ok: true, data: result.data };
    return { ok: false, error: toAppError(result.error) };
  } catch (thrown: unknown) {
    return { ok: false, error: toAppError(thrown) };
  }
}

/**
 * Дружелюбный текст для ребёнка по коду ошибки (на текущем языке UI). Технический
 * `AppError.message` пользователю не показывается.
 */
export function errorMessage(code: AppErrorCode): string {
  switch (code) {
    case 'app.internal':
      return m.error_app_internal();
    case 'app.invalid_argument':
      return m.error_app_invalid_argument();
    default: {
      // Новый вариант `AppErrorCode` без ветки здесь — ошибка типов в `pnpm check`.
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}
