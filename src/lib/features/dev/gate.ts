// Доступ к dev-маршрутам (docs/01_ARCHITECTURE.md §4a).
//
// `/dev` — только `vite dev` / `tauri dev`. `/dev/spikes` — ещё и в debug-сборке
// `just build-spikes` (`VITE_MPT_SPIKES=1`): в `tauri dev` CSP не применяется, а спайкам нужна
// настоящая CSP и прогон на Windows без dev-сервера. В обычном `pnpm build` оба маршрута — 404.

/** Доступна ли страница `/dev`. */
export function devPageEnabled(): boolean {
  return import.meta.env.DEV;
}

/** Доступна ли страница `/dev/spikes`. */
export function spikesPageEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_MPT_SPIKES === '1';
}
