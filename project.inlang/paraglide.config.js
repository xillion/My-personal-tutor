// Единая конфигурация компилятора Paraglide для Vite-плагина и CLI
// (`paraglide-js compile` в скрипте `i18n`). Документация: https://paraglidejs.com
import { defineConfig } from '@inlang/paraglide-js';

export default defineConfig({
  // Сгенерированный код не коммитится: его создают Vite-плагин (dev/build/vitest)
  // и `pnpm i18n` (перед lint/check). Внутри outdir Paraglide кладёт свой .gitignore.
  outdir: './src/lib/paraglide',
  // SPA в Tauri: нет сервера, cookie и URL-префиксы не нужны. Выбор языка хранится в
  // localStorage, по умолчанию — базовая локаль (ru). Позже язык берётся из профиля (T-406).
  strategy: ['localStorage', 'baseLocale'],
  localStorageKey: 'mpt.locale',
  // Физические модули сообщений и в Vite, и в CLI (у Vite-плагина по умолчанию
  // virtual-modules). С виртуальными модулями `tauri dev` при старте ловил ошибку импорта:
  // WebKitGTK спекулятивно запрашивает `virtual:paraglide/<hash>/...` из своего кеша.
  outputStructure: 'message-modules',
  emitTsDeclarations: true,
  emitReadme: false,
});
