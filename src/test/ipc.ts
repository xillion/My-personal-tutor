// Помощники для тестов IPC.

/**
 * Отклонение «как у Tauri»: бэкенд отклоняет `invoke` не `Error`, а сериализованным значением
 * (`AppError`-объект или строка ошибки фреймворка). Для `mockIPC`-обработчиков.
 */
export function rejectWith(value: unknown): Promise<never> {
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- имитируем не-Error отклонения Tauri
  return Promise.reject(value);
}
