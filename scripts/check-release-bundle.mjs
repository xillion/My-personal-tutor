#!/usr/bin/env node
// Релизная сборка фронтенда не должна содержать стенд спайков (T-004.1, 01_ARCHITECTURE §4a).
// Страховка для плагина `stubSpikesStandInRelease` в vite.config.ts: он привязан к пути файла
// и при переименовании молча перестал бы работать.
//
// Использование: node scripts/check-release-bundle.mjs [каталог=build]
// Код выхода: 0 — чисто, 1 — найдены маркеры стенда, 2 — каталог не найден / нет JS.
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const FORBIDDEN_MARKERS = ['spike_', 'SpikesStand'];

/** @param {string} text @returns {string[]} */
export function findMarkers(text) {
  return FORBIDDEN_MARKERS.filter((marker) => text.includes(marker));
}

/** @param {string} dir @returns {AsyncGenerator<string>} */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile() && ['.js', '.html'].includes(extname(entry.name))) yield path;
  }
}

async function main() {
  const root = process.argv[2] ?? 'build';
  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) {
    console.error(`check-release-bundle: каталог "${root}" не найден — сначала pnpm build`);
    return 2;
  }
  let files = 0;
  let problems = 0;
  for await (const file of walk(root)) {
    files += 1;
    for (const marker of findMarkers(await readFile(file, 'utf8'))) {
      problems += 1;
      console.error(`${relative(process.cwd(), file)}: найден маркер стенда спайков "${marker}"`);
    }
  }
  if (files === 0) {
    console.error(`check-release-bundle: в "${root}" нет файлов .js/.html`);
    return 2;
  }
  if (problems > 0) {
    console.error('check-release-bundle: стенд спайков попал в релизную сборку');
    return 1;
  }
  console.log(`check-release-bundle: OK (${files} файлов без стенда спайков)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main().catch((/** @type {unknown} */ error) => {
    console.error('check-release-bundle: ошибка чтения:', error);
    return 2;
  });
}
