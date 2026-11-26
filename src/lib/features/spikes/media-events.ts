// Вспомогательные функции для медиа-спайков.

/** Ждёт событие `name` на `target`; `false` — не дождались за `timeoutMs`. */
export function waitForEvent(
  target: EventTarget,
  name: string,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      target.removeEventListener(name, onEvent);
      resolve(false);
    }, timeoutMs);
    function onEvent(): void {
      clearTimeout(timer);
      resolve(true);
    }
    target.addEventListener(name, onEvent, { once: true });
  });
}

/** Ошибка медиа в JSON-виде: `MediaError.code` (1 aborted, 2 network, 3 decode, 4 src). */
export interface MediaErrorInfo {
  code: number;
  message: string;
}

export function mediaErrorInfo(audio: HTMLMediaElement): MediaErrorInfo | null {
  return audio.error === null ? null : { code: audio.error.code, message: audio.error.message };
}

/** Имя и текст исключения (`NotAllowedError`, `NotSupportedError`, `TypeError`...). */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/** Округление до 0,001 (секунды позиции) или 0,01 (мс). */
export function round(value: number, digits = 3): number {
  const k = 10 ** digits;
  return Math.round(value * k) / k;
}
