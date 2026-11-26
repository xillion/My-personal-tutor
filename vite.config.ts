import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Хост для разработки на мобильных устройствах (`tauri android|ios dev`, Фаза 8).
// `process` берём из globalThis, чтобы не тянуть @types/node ради одной переменной.
const host = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
  ?.env['TAURI_DEV_HOST'];

// https://vite.dev/config/ и https://v2.tauri.app/start/frontend/sveltekit/
export default defineConfig({
  plugins: [
    // SvelteKit 3: конфигурация Kit передаётся плагину, `svelte.config.js` не поддерживается.
    // Tauri не имеет Node.js-сервера для SSR, поэтому приложение — SPA: adapter-static
    // с fallback на index.html (ADR-01, https://svelte.dev/docs/kit/single-page-apps).
    sveltekit({
      adapter: adapter({ fallback: 'index.html' }),
    }),
  ],
  // Не прятать ошибки компиляции Rust, которые печатает `tauri dev`.
  clearScreen: false,
  server: {
    // Tauri ждёт фиксированный порт (`build.devUrl` в tauri.conf.json).
    port: 1420,
    strictPort: true,
    host: host ?? '127.0.0.1',
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // Rust-часть пересобирает сам `tauri dev`; `build/` — результат `pnpm build`,
      // его изменение не должно перезагружать окно dev.
      ignored: ['**/src-tauri/**', '**/target/**', '**/build/**'],
    },
  },
});
