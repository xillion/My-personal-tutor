// Политика доверия KaTeX для формул из курсов (T-004.1, переиспользуется в T-302).
//
// Курсы — недоверенные данные (ADR-17). Из HTML-расширений KaTeX разрешён только `\htmlData`:
// он добавляет `data-*` атрибуты, по которым читалка находит части формулы (`data-t`).
// Запрещены `\href`, `\url` (ссылки), `\includegraphics` (загрузка картинок),
// `\htmlStyle`, `\htmlClass`, `\htmlId` (подмена стилей/классов/id приложения).
// Запрещённая команда рендерится KaTeX как неподдерживаемая (текст цветом `errorColor`).
// `renderMath`/`renderMathToString` не бросают: любой сбой KaTeX и слишком длинный TeX дают
// fallback `.katex-error` с исходником (см. `renderMath`).
import katex, { type KatexOptions, type TrustContext } from 'katex';

/** Функция для опции `trust` KaTeX: `true` только для `\htmlData`. */
export function katexTrust(context: TrustContext): boolean {
  return context.command === '\\htmlData';
}

/**
 * Базовые опции рендера. `strict: 'ignore'`: в режиме `warn` (по умолчанию) KaTeX пишет
 * предупреждение `htmlExtension` в консоль на каждый `\htmlData`; безопасность обеспечивает
 * `trust`, а не `strict`. `throwOnError: false` — `ParseError` парсера рендерится как
 * `.katex-error`, но не все ошибки он ловит (см. `renderMath`). `maxExpand` ограничивает
 * раскрытие макросов (защита от «макробомб»). `maxSize: 20` (em) ограничивает размеры из TeX
 * (`\rule`, `\kern`, `\hspace`…): без него `\rule{9999em}{9999em}` перекрывает весь урок.
 * 20 em при шрифте 18–22 px ≈ 360–440 px — с запасом для честных отступов и линеек в
 * формулах 8–11 лет и не шире половины экрана планшета.
 */
export const KATEX_OPTIONS = {
  trust: katexTrust,
  strict: 'ignore',
  throwOnError: false,
  maxExpand: 1000,
  maxSize: 20,
  output: 'htmlAndMathml',
} as const satisfies KatexOptions;

/**
 * Предел длины TeX одной формулы: длиннее — fallback без вызова KaTeX. Формулы курсов — сотни
 * символов; предел отсекает заведомо патологический ввод (глубокая вложенность, время и память
 * парсера) ещё до рекурсии. Переполнение стека на более коротком вводе ловит `try/catch`.
 */
export const MAX_TEX_LENGTH = 10_000;

/** Класс fallback-разметки — тот же, что у KaTeX при `throwOnError: false`. */
export const KATEX_ERROR_CLASS = 'katex-error';

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function tooLong(tex: string): string | null {
  return tex.length > MAX_TEX_LENGTH
    ? `TeX is too long: ${tex.length} > ${MAX_TEX_LENGTH} characters`
    : null;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Рендерит `tex` в `element` с политикой доверия курса. Никогда не бросает: курсовой TeX —
 * недоверенные данные, а KaTeX при `throwOnError: false` всё же бросает `ParseError` из
 * `toMarkup` (например, `\htmlData{a onclick=1}{y}`) и `RangeError` при глубокой вложенности.
 * Тогда (и при `tex` длиннее `MAX_TEX_LENGTH`) в `element` — `<span class="katex-error">` с
 * исходником как текстом и сообщением ошибки в `title`. Без красного цвета KaTeX (`errorColor`):
 * детям — без «ошибок», стиль задаёт приложение по классу.
 */
export function renderMath(element: HTMLElement, tex: string, displayMode = false): void {
  let message = tooLong(tex);
  if (message === null) {
    try {
      katex.render(tex, element, { ...KATEX_OPTIONS, displayMode });
      return;
    } catch (error: unknown) {
      message = errorText(error);
    }
  }
  const span = element.ownerDocument.createElement('span');
  span.className = KATEX_ERROR_CLASS;
  span.title = message;
  span.textContent = tex;
  element.replaceChildren(span);
}

/** Строковый вариант `renderMath` (тесты, предрендер); тот же fallback, HTML экранирован. */
export function renderMathToString(tex: string, displayMode = false): string {
  let message = tooLong(tex);
  if (message === null) {
    try {
      return katex.renderToString(tex, { ...KATEX_OPTIONS, displayMode });
    } catch (error: unknown) {
      message = errorText(error);
    }
  }
  return `<span class="${KATEX_ERROR_CLASS}" title="${escapeHtml(message)}">${escapeHtml(tex)}</span>`;
}
