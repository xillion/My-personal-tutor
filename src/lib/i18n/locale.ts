import { getLocale, getTextDirection, setLocale, type Locale } from '#lib/paraglide/runtime.js';

export type { Locale };

/**
 * Проставляет `lang` и `dir` на <html> по текущей локали Paraglide (ADR-20).
 * `lang` нужен для правильных переносов, выбора глифов и голоса TTS.
 */
export function syncDocumentLocale(doc: Document = document): void {
  const locale = getLocale();
  doc.documentElement.lang = locale;
  doc.documentElement.dir = getTextDirection(locale);
}

/**
 * Меняет язык UI. По умолчанию Paraglide перезагружает документ, и всё дерево
 * отрисовывается заново на новом языке; без перезагрузки обновляется только `lang`.
 */
export async function changeLocale(locale: Locale, options?: { reload?: boolean }): Promise<void> {
  await setLocale(locale, options);
  syncDocumentLocale();
}
