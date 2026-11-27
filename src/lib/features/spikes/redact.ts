// Обезличивание JSON-отчёта стенда (T-004.1): абсолютные пути и asset-URL содержат имя
// пользователя ОС (`/home/<u>`, `C:\Users\<u>`, `/Users/<u>`), которое не должно уходить в отчёт.
//
// - Путь внутри каталога данных → `$APPDATA/courses/…` (всё до сегмента `courses` отбрасывается).
// - Другой абсолютный путь → `…/<файл>`.
// - URL с закодированным путём ФС (`convertFileSrc`) → `<схема>://<хост>/…/<файл>`.
// - Прочие строки: домашние каталоги внутри текста (сообщения ошибок) заменяются на `~`.

const URL_WITH_AUTHORITY = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)(\/[^?#]*)?/i;
const WINDOWS_ABSOLUTE = /^[a-z]:[\\/]/i;
const UNC = /^\\\\[^\\]+\\/;
const ENCODED_FS_PATH = /%2F|%5C|%3A/i;

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || WINDOWS_ABSOLUTE.test(value) || UNC.test(value);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function lastSegment(path: string): string {
  const parts = path.split(/[\\/]/).filter((part) => part !== '');
  return parts.at(-1) ?? '';
}

/** Обезличивает абсолютный путь ФС. */
export function redactPath(path: string): string {
  const parts = path.split(/[\\/]/).filter((part) => part !== '');
  const courses = parts.lastIndexOf('courses');
  if (courses >= 0) return ['$APPDATA', ...parts.slice(courses)].join('/');
  return `…/${parts.at(-1) ?? ''}`;
}

/**
 * Обезличивает одно значение-«местоположение»: путь или URL. Строки, которые не являются
 * абсолютным путём или URL с путём ФС, возвращаются через `scrubHomeDirs`.
 */
export function redactLocation(value: string): string {
  const url = URL_WITH_AUTHORITY.exec(value);
  if (url !== null) {
    const [, scheme = '', host = '', path = ''] = url;
    if (!ENCODED_FS_PATH.test(path)) return scrubHomeDirs(value);
    return `${scheme}://${host}/…/${lastSegment(safeDecode(path))}`;
  }
  if (isAbsolutePath(value)) return redactPath(value);
  return scrubHomeDirs(value);
}

const HOME_PATTERNS: [RegExp, string][] = [
  [/\/(home|Users)\/[^/\\\s"'<>]+/g, '~'],
  [/\b[a-z]:[\\/]+Users[\\/]+[^/\\\s"'<>]+/gi, '~'],
  [/%2F(home|Users)%2F((?!%2F)[^/\s"'<>])+/gi, '~'],
  [/\b[a-z]%3A(%5C|%2F)Users(%5C|%2F)((?!%5C|%2F)[^/\s"'<>])+/gi, '~'],
];

/** Заменяет домашние каталоги пользователя внутри произвольного текста на `~`. */
export function scrubHomeDirs(text: string): string {
  let result = text;
  for (const [pattern, replacement] of HOME_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Рекурсивно обезличивает все строки отчёта (объекты и массивы копируются). */
export function redactReport(value: unknown): unknown {
  if (typeof value === 'string') return redactLocation(value);
  if (Array.isArray(value)) return value.map(redactReport);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactReport(item)]),
    );
  }
  return value;
}
