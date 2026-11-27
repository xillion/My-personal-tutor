import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Хост для разработки на мобильных устройствах (`tauri android|ios dev`, Фаза 8).
// `process` берём из globalThis, чтобы не тянуть @types/node ради одной переменной.
const host = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[
  'TAURI_DEV_HOST'
];

const SVELTE_VIRTUAL_CSS = /[?&]svelte&type=style&lang\.css$/;

/**
 * Обход гонки в dev-сервере (vite-plugin-svelte 7.3.2 + Vite 8), найденной в T-001.3.
 *
 * Скомпилированный CSS компонента лежит в `meta.svelte.css` модуля `.svelte` и появляется
 * только после его трансформации. Если браузер запрашивает виртуальный модуль
 * `X.svelte?svelte&type=style&lang.css` раньше самого `X.svelte` (WebKitGTK делает это при
 * старте `tauri dev`: спекулятивная загрузка подресурсов из своего сетевого кеша),
 * `load-compiled-css` не находит meta, а Vite подставляет исходник `.svelte` как CSS.
 * Результат кешируется в графе модулей, и scoped-стили не применяются до первого HMR.
 *
 * Плагин срабатывает до vite-plugin-svelte и сначала трансформирует родительский `.svelte`;
 * затем штатный загрузчик находит CSS. На production-сборку не влияет (`apply: 'serve'`).
 */
function svelteVirtualCssWarmup(): Plugin {
  return {
    name: 'mpt:svelte-virtual-css-warmup',
    apply: 'serve',
    enforce: 'pre',
    load: {
      filter: { id: SVELTE_VIRTUAL_CSS },
      async handler(id) {
        const file = id.slice(0, id.indexOf('?'));
        const meta = this.getModuleInfo(file)?.meta as { svelte?: { css?: unknown } } | undefined;
        if (meta?.svelte?.css === undefined && 'transformRequest' in this.environment) {
          await this.environment.transformRequest(file);
        }
        // Загрузку выполняет vite-plugin-svelte:load-compiled-css.
        return null;
      },
    },
  };
}

const TAILWIND_BANNER =
  /(\/\*! tailwindcss v[\w.-]+ \| MIT License) \| https:\/\/tailwindcss\.com \*\//g;

/**
 * Офлайн-сборка (ADR-21, проверка `pnpm check:offline`): Tailwind v4 безусловно добавляет
 * в CSS баннер `/*! tailwindcss vX | MIT License | https://tailwindcss.com *\/`. Уведомление
 * о лицензии оставляем, убираем только URL, чтобы в build/ не было ссылок на внешние хосты.
 */
function stripTailwindBannerUrl(): Plugin {
  return {
    name: 'mpt:strip-tailwind-banner-url',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css')) {
          if (typeof file.source === 'string') {
            file.source = file.source.replace(TAILWIND_BANNER, '$1 */');
          }
        }
      }
    },
  };
}

const SPIKES_STAND = '/src/lib/features/spikes/SpikesStand.svelte';

/**
 * Стенд спайков (T-004.1, §4a) не попадает в обычный `vite build`. Страница `/dev/spikes`
 * импортирует его через `import()` в ветке, мёртвой без `VITE_MPT_SPIKES=1`; Rolldown удаляет
 * вызов, но чанк динамического импорта всё равно выпускает. Поэтому в такой сборке модуль
 * стенда подменяется пустым компонентом — UI стенда и `spike_*` в build/ не попадают.
 * `just build-spikes` (`VITE_MPT_SPIKES=1`), `vite dev` и Vitest получают настоящий стенд.
 */
function stubSpikesStandInRelease(): Plugin {
  let stub = false;
  return {
    name: 'mpt:stub-spikes-stand-in-release',
    apply: 'build',
    enforce: 'pre',
    configResolved(config) {
      stub = config.env['VITE_MPT_SPIKES'] !== '1';
    },
    load(id) {
      if (stub && id.endsWith(SPIKES_STAND)) return '<!-- stand is excluded from this build -->\n';
      return null;
    },
  };
}

// https://vite.dev/config/ и https://v2.tauri.app/start/frontend/sveltekit/
export default defineConfig({
  plugins: [
    // Tailwind v4: токены и тема — в src/lib/ui/tokens.css (`@theme`).
    tailwindcss(),
    // Конфигурация компилятора — в project.inlang/paraglide.config.js (общая с CLI).
    paraglideVitePlugin({ project: './project.inlang' }),
    svelteVirtualCssWarmup(),
    stripTailwindBannerUrl(),
    stubSpikesStandInRelease(),
    // SvelteKit 3: конфигурация Kit передаётся плагину, `svelte.config.js` не поддерживается.
    // Tauri не имеет Node.js-сервера для SSR, поэтому приложение — SPA: adapter-static
    // с fallback на index.html (ADR-01, https://svelte.dev/docs/kit/single-page-apps).
    sveltekit({
      adapter: adapter({ fallback: 'index.html' }),
    }),
    // Только под Vitest: браузерная сборка Svelte и автоочистка DOM между тестами.
    svelteTesting(),
  ],
  // Не прятать ошибки компиляции Rust, которые печатает `tauri dev`.
  clearScreen: false,
  server: {
    // Tauri ждёт фиксированный порт (`build.devUrl` в tauri.conf.json).
    port: 1420,
    strictPort: true,
    host: host ?? '127.0.0.1',
    // Vite 8: параметры WebSocket HMR перенесены из `server.hmr` в `server.ws`.
    ws: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // Rust-часть пересобирает сам `tauri dev`; `build/` — результат `pnpm build`,
      // его изменение не должно перезагружать окно dev.
      ignored: ['**/src-tauri/**', '**/target/**', '**/build/**'],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    setupFiles: ['src/test/setup.ts'],
  },
});
