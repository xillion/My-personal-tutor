import { error } from '@sveltejs/kit';

// Dev-маршруты существуют только в `vite dev` / `tauri dev` (docs/01_ARCHITECTURE.md §4a).
// В production-сборке `import.meta.env.DEV` = false: страница отвечает 404 и не рендерится.
export function load(): void {
  if (!import.meta.env.DEV) error(404, 'Not Found');
}
