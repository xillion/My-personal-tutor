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

/** Минимальный интерфейс медиа-элемента для измерения скорости (подменяется в тестах). */
export interface RateSource {
  readonly currentTime: number;
  readonly paused: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Фактическая скорость воспроизведения: (Δ`currentTime`) / (Δ wall-clock) между двумя точками,
 * взятыми **после** того, как `currentTime` начал расти. `play()` резолвится раньше, чем
 * конвейер (GStreamer в WebKitGTK) реально выдаёт звук; если начать окно сразу после `play()`,
 * задержка старта (сотни мс) входит в знаменатель и занижает скорость (0.75 → ~0.4).
 * `null` — воспроизведение не началось за `startTimeoutMs`.
 */
export async function measurePlaybackRate(
  media: RateSource,
  sampleMs: number,
  { startTimeoutMs = 3000, pollMs = 20, now = (): number => performance.now() } = {},
): Promise<number | null> {
  const initial = media.currentTime;
  const deadline = now() + startTimeoutMs;
  while (media.currentTime === initial) {
    if (media.paused || now() >= deadline) return null;
    await sleep(pollMs);
  }
  const ct0 = media.currentTime;
  const t0 = now();
  await sleep(sampleMs);
  const wall = (now() - t0) / 1000;
  return wall > 0 ? round((media.currentTime - ct0) / wall, 2) : null;
}
