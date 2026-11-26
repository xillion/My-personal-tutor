#!/usr/bin/env node
// Хук `prepare` (запускается `pnpm install`): `svelte-kit sync` и компиляция сообщений Paraglide.
//
// Шаг пропускается, только если dev-зависимостей нет (например, `pnpm install --prod`):
// тогда `svelte-kit` и `paraglide-js` не установлены. Любая другая ошибка возвращает ненулевой
// код и роняет установку (KI-008: раньше `|| echo ''` глотал все ошибки).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const svelteKitBin = fileURLToPath(
  new URL('../node_modules/@sveltejs/kit/svelte-kit.js', import.meta.url),
);
const paraglideBin = fileURLToPath(
  new URL('../node_modules/@inlang/paraglide-js/bin/run.js', import.meta.url),
);

if (!existsSync(svelteKitBin) || !existsSync(paraglideBin)) {
  console.log('prepare: dev dependencies are not installed, skipping svelte-kit sync and i18n');
} else {
  const steps = [
    [svelteKitBin, 'sync'],
    [paraglideBin, 'compile', '--project', './project.inlang', '--silent'],
  ];
  for (const args of steps) {
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
}
