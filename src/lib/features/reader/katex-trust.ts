// Политика доверия KaTeX для формул из курсов (T-004.1, переиспользуется в T-302).
//
// Курсы — недоверенные данные (ADR-17). Из HTML-расширений KaTeX разрешён только `\htmlData`:
// он добавляет `data-*` атрибуты, по которым читалка находит части формулы (`data-t`).
// Запрещены `\href`, `\url` (ссылки), `\includegraphics` (загрузка картинок),
// `\htmlStyle`, `\htmlClass`, `\htmlId` (подмена стилей/классов/id приложения).
// Запрещённая команда рендерится KaTeX как неподдерживаемая (текст цветом `errorColor`).
import katex, { type KatexOptions, type TrustContext } from 'katex';

/** Функция для опции `trust` KaTeX: `true` только для `\htmlData`. */
export function katexTrust(context: TrustContext): boolean {
  return context.command === '\\htmlData';
}

/**
 * Базовые опции рендера. `strict: 'ignore'`: в режиме `warn` (по умолчанию) KaTeX пишет
 * предупреждение `htmlExtension` в консоль на каждый `\htmlData`; безопасность обеспечивает
 * `trust`, а не `strict`. `throwOnError: false` — ошибка разметки видна в формуле, а не роняет
 * урок. `maxExpand` ограничивает раскрытие макросов (защита от «макробомб»).
 */
export const KATEX_OPTIONS = {
  trust: katexTrust,
  strict: 'ignore',
  throwOnError: false,
  maxExpand: 1000,
  output: 'htmlAndMathml',
} as const satisfies KatexOptions;

/** Рендерит `tex` в `element` с политикой доверия курса. */
export function renderMath(element: HTMLElement, tex: string, displayMode = false): void {
  katex.render(tex, element, { ...KATEX_OPTIONS, displayMode });
}

/** Строковый вариант `renderMath` (тесты, предрендер). */
export function renderMathToString(tex: string, displayMode = false): string {
  return katex.renderToString(tex, { ...KATEX_OPTIONS, displayMode });
}
