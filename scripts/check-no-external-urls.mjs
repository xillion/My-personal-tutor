#!/usr/bin/env node
// Проверка офлайн-сборки (T-001.3, ADR-21): в HTML и CSS из `build/` не должно быть ссылок
// на внешние хосты — приложение работает без сети, а CSP всё равно заблокирует такие запросы.
//
// Использование: node scripts/check-no-external-urls.mjs [каталог=build]
// Код выхода: 0 — чисто, 1 — найдены внешние URL, 2 — каталог не найден / нет файлов.
//
// Разрешены только идентификаторы XML-неймспейсов из явного списка: это не сетевые адреса,
// браузер по ним ничего не загружает (например, `xmlns="http://www.w3.org/2000/svg"` во
// встроенных SVG). Любой другой `http(s)://` — ошибка, в том числе в комментариях:
// проверка намеренно строгая и простая.
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ALLOWED_XML_NAMESPACES = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/XML/1998/namespace',
]);

const CHECKED_EXTENSIONS = new Set(['.html', '.css']);
// `http(s)://`, `ws(s)://` и адреса без схемы (`//host`) в контексте url()/@import/src/href.
const URL_PATTERN = /(?:https?|wss?):\/\/[^\s"'`()<>\\%]*/giu;
const SCHEMELESS_PATTERN =
  /(?:url\(\s*|@import\s+|(?:src|href)\s*=\s*)["']?(\/\/[^\s"'`()<>\\]+)/giu;

/** @param {string} dir @returns {AsyncGenerator<string>} */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile() && CHECKED_EXTENSIONS.has(extname(entry.name))) yield path;
  }
}

/**
 * @param {string} text
 * @returns {{ line: number, url: string }[]}
 */
export function findExternalUrls(text) {
  /** @type {{ line: number, url: string }[]} */
  const found = [];
  const lines = text.split('\n');
  lines.forEach((content, index) => {
    for (const match of content.matchAll(URL_PATTERN)) {
      const url = match[0].replace(/[.,;]+$/u, '');
      if (!ALLOWED_XML_NAMESPACES.has(url)) found.push({ line: index + 1, url });
    }
    for (const match of content.matchAll(SCHEMELESS_PATTERN)) {
      found.push({ line: index + 1, url: match[1] ?? match[0] });
    }
  });
  return found;
}

async function main() {
  const root = process.argv[2] ?? 'build';
  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) {
    console.error(`check-no-external-urls: каталог "${root}" не найден — сначала pnpm build`);
    return 2;
  }

  let files = 0;
  let problems = 0;
  for await (const file of walk(root)) {
    files += 1;
    for (const { line, url } of findExternalUrls(await readFile(file, 'utf8'))) {
      problems += 1;
      console.error(`${relative(process.cwd(), file)}:${line}: внешний URL ${url}`);
    }
  }

  if (files === 0) {
    console.error(`check-no-external-urls: в "${root}" нет файлов .html/.css`);
    return 2;
  }
  if (problems > 0) {
    console.error(`check-no-external-urls: найдено внешних URL: ${problems}`);
    return 1;
  }
  console.log(`check-no-external-urls: OK (${files} файлов .html/.css без внешних URL)`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main().catch((/** @type {unknown} */ error) => {
    console.error('check-no-external-urls: ошибка чтения:', error);
    return 2;
  });
}
