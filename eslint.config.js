// ESLint flat config (https://eslint.org/docs/latest/use/configure/configuration-files).
// Форматирование — забота Prettier: eslint-config-prettier выключает конфликтующие правила.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

/**
 * Граница IPC (CLAUDE.md, правило 5; ADR-10, ADR-11): весь доступ к Tauri — только через
 * сгенерированные bindings и обёртки в `src/lib/ipc/`. Запрещён весь `@tauri-apps/api`
 * (core: `invoke`, `convertFileSrc`; event, window, path, ...) и плагины `@tauri-apps/plugin-*`
 * (в частности, `plugin-fs`). Исключения: `src/lib/ipc/**` и `@tauri-apps/api/mocks` в тестах.
 */
const IPC_BOUNDARY_MESSAGE =
  'Tauri API is only allowed in src/lib/ipc/ (generated bindings + client.ts). Use #lib/ipc instead.';
// Регэксп для esquery (без `/` внутри): `@tauri-apps/api`, `@tauri-apps/api/*`, `@tauri-apps/plugin-*`.
const TAURI_DYNAMIC_IMPORT = 'ImportExpression[source.value=/^@tauri-apps.(api($|.)|plugin-)/]';
// Динамический импорт по шаблонной строке не проверить статически — запрещён целиком вне ipc.
const TEMPLATE_DYNAMIC_IMPORT = "ImportExpression[source.type='TemplateLiteral']";
// Обход через глобальные объекты Tauri (`window.__TAURI_INTERNALS__.invoke(...)`).
const TAURI_GLOBALS = 'MemberExpression[property.name=/^__TAURI(_INTERNALS)?__$/]';

/**
 * @param {{ allowMocks: boolean }} options
 * @returns {import('eslint').Linter.RulesRecord}
 */
function ipcBoundaryRules({ allowMocks }) {
  // Шаблоны — в синтаксисе gitignore; голый `@tauri-apps/api` задаётся через `paths`, иначе
  // он исключил бы весь каталог и отрицание `!…/mocks` не сработало бы.
  const group = ['@tauri-apps/api/*', '@tauri-apps/plugin-*'];
  if (allowMocks) group.push('!@tauri-apps/api/mocks');
  return {
    'no-restricted-imports': [
      'error',
      {
        paths: [{ name: '@tauri-apps/api', message: IPC_BOUNDARY_MESSAGE }],
        patterns: [{ group, message: IPC_BOUNDARY_MESSAGE }],
      },
    ],
    // no-restricted-imports не видит динамический `import('...')`.
    'no-restricted-syntax': [
      'error',
      { selector: TAURI_DYNAMIC_IMPORT, message: IPC_BOUNDARY_MESSAGE },
      { selector: TEMPLATE_DYNAMIC_IMPORT, message: IPC_BOUNDARY_MESSAGE },
      { selector: TAURI_GLOBALS, message: IPC_BOUNDARY_MESSAGE },
    ],
  };
}

export default defineConfig(
  globalIgnores([
    'build/',
    '.svelte-kit/',
    'target/',
    'dist/',
    'src-tauri/',
    'static/',
    'schemas/',
    // Сгенерированный код: bindings (tauri-specta, ADR-23) и сообщения Paraglide.
    'src/lib/ipc/bindings.ts',
    'src/lib/paraglide/',
    'project.inlang/cache/',
  ]),
  js.configs.recommended,
  ts.configs.strictTypeChecked,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        // `import.meta.dirname` (Node ≥ 20.11); тип объявлен вручную, чтобы не подключать
        // @types/node ко всему проекту (tsconfig проверяет и этот файл).
        tsconfigRootDir: /** @type {ImportMeta & { dirname: string }} */ (import.meta).dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Неиспользуемые аргументы с префиксом `_` — осознанные.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Шаблонные строки с числами (`${count} px`) — норма.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    // Конфиги и скрипты исполняет Node; они не входят в tsconfig (кроме корневых).
    files: ['*.{js,mjs,ts}', 'scripts/**/*.{js,mjs,ts}', 'project.inlang/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['scripts/**/*.{js,mjs}', 'project.inlang/*.js'],
    extends: [ts.configs.disableTypeChecked],
  },
  { files: ['src/**'], rules: ipcBoundaryRules({ allowMocks: false }) },
  {
    files: ['src/**/*.test.ts', 'src/test/**'],
    rules: ipcBoundaryRules({ allowMocks: true }),
  },
  {
    files: ['src/lib/ipc/**'],
    rules: { 'no-restricted-imports': 'off', 'no-restricted-syntax': 'off' },
  },
);
