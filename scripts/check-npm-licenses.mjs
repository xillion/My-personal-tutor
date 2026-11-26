#!/usr/bin/env node
// Проверка лицензий npm-зависимостей (T-001.4, ADR-24): в бандл попадают только пакеты из
// `dependencies` (и их транзитивные зависимости), поэтому проверяется `pnpm licenses list --prod`.
// devDependencies (сборка, линтеры, тесты) в приложение не входят и не проверяются.
//
// Использование:
//   node scripts/check-npm-licenses.mjs            — запустить `pnpm licenses list --prod --json`
//   node scripts/check-npm-licenses.mjs <file.json> — проверить сохранённый вывод
// Код выхода: 0 — все лицензии разрешены, 1 — найдены неразрешённые/нераспознанные, 2 — сбой.
//
// Разбор SPDX-выражений упрощённый: `OR`, `AND`, `WITH`, скобки. `A OR B` проходит, если
// разрешена хотя бы одна сторона; `A AND B` — если разрешены обе; `X WITH Y` — если
// разрешена строка `X WITH Y` целиком. Всё, что не разбирается (`SEE LICENSE IN ...`,
// `UNKNOWN`, пусто), — ошибка: такой пакет нужно проверить вручную.
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/**
 * Лицензии, совместимые с GPL-3.0-or-later (ADR-24). Держать в согласии с `deny.toml`.
 * @type {ReadonlySet<string>}
 */
export const ALLOWED_LICENSES = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'Zlib',
  'MPL-2.0',
  'LGPL-2.1-or-later',
  'LGPL-3.0-or-later',
  'GPL-3.0-or-later',
  'Unicode-3.0',
  'Apache-2.0 WITH LLVM-exception',
]);

/** @typedef {{ type: 'license', id: string } | { type: 'and' | 'or', left: Expr, right: Expr }} Expr */

/**
 * Разбивает SPDX-выражение на токены: скобки, операторы и идентификаторы.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text
    .replace(/[()]/gu, ' $& ')
    .split(/\s+/u)
    .filter((token) => token.length > 0);
}

/**
 * Разбирает SPDX-выражение лицензии. Приоритет: `WITH` > `AND` > `OR`.
 * Устаревшая запись `MIT/Apache-2.0` трактуется как `MIT OR Apache-2.0`.
 * @param {string} text
 * @returns {Expr}
 * @throws {Error} если выражение не разбирается
 */
export function parseLicenseExpression(text) {
  const tokens = tokenize(text.replace(/\s*\/\s*/gu, ' OR '));
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  /** @returns {Expr} */
  const parseOr = () => {
    let left = parseAnd();
    while (peek()?.toUpperCase() === 'OR') {
      next();
      left = { type: 'or', left, right: parseAnd() };
    }
    return left;
  };

  /** @returns {Expr} */
  const parseAnd = () => {
    let left = parsePrimary();
    while (peek()?.toUpperCase() === 'AND') {
      next();
      left = { type: 'and', left, right: parsePrimary() };
    }
    return left;
  };

  /** @returns {Expr} */
  const parsePrimary = () => {
    const token = next();
    if (token === undefined) throw new Error(`unexpected end of expression: "${text}"`);
    if (token === '(') {
      const inner = parseOr();
      if (next() !== ')') throw new Error(`missing ")" in "${text}"`);
      return inner;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9.+-]*$/u.test(token) || isOperator(token)) {
      throw new Error(`unexpected token "${token}" in "${text}"`);
    }
    if (peek()?.toUpperCase() === 'WITH') {
      next();
      const exception = next();
      if (exception === undefined || !/^[A-Za-z0-9][A-Za-z0-9.+-]*$/u.test(exception)) {
        throw new Error(`missing exception after WITH in "${text}"`);
      }
      return { type: 'license', id: `${token} WITH ${exception}` };
    }
    return { type: 'license', id: token };
  };

  const expr = parseOr();
  if (pos !== tokens.length) throw new Error(`unexpected token "${tokens[pos]}" in "${text}"`);
  return expr;
}

/** @param {string} token */
function isOperator(token) {
  return ['AND', 'OR', 'WITH'].includes(token.toUpperCase());
}

/**
 * Проверяет, удовлетворяет ли SPDX-выражение списку разрешённых лицензий.
 * @param {string} text SPDX-выражение
 * @param {ReadonlySet<string>} [allowed]
 * @returns {boolean} `false` и для нераспознанных выражений
 */
export function isLicenseAllowed(text, allowed = ALLOWED_LICENSES) {
  let expr;
  try {
    expr = parseLicenseExpression(text);
  } catch {
    return false;
  }
  /** @param {Expr} node @returns {boolean} */
  const evaluate = (node) => {
    if (node.type === 'license') return allowed.has(node.id);
    if (node.type === 'and') return evaluate(node.left) && evaluate(node.right);
    return evaluate(node.left) || evaluate(node.right);
  };
  return evaluate(expr);
}

/**
 * Ищет пакеты с неразрешёнными лицензиями в JSON-выводе `pnpm licenses list --json`
 * (объект «лицензия → массив пакетов `{ name, versions, license }`»).
 * @param {unknown} report
 * @param {ReadonlySet<string>} [allowed]
 * @returns {{ name: string, versions: string[], license: string }[]}
 */
export function findDisallowed(report, allowed = ALLOWED_LICENSES) {
  if (report === null || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('unexpected `pnpm licenses list --json` output: expected an object');
  }
  /** @type {{ name: string, versions: string[], license: string }[]} */
  const problems = [];
  for (const [groupLicense, packages] of Object.entries(report)) {
    if (!Array.isArray(packages)) {
      throw new Error(`unexpected entry for "${groupLicense}": expected an array`);
    }
    for (const pkg of packages) {
      const license =
        typeof pkg?.license === 'string' && pkg.license.length > 0 ? pkg.license : groupLicense;
      if (!isLicenseAllowed(license, allowed)) {
        problems.push({
          name: String(pkg?.name ?? '<unknown>'),
          versions: Array.isArray(pkg?.versions) ? pkg.versions.map(String) : [],
          license,
        });
      }
    }
  }
  return problems;
}

/** @returns {string} */
function runPnpmLicenses() {
  const result = spawnSync('pnpm', ['licenses', 'list', '--prod', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // На Windows pnpm может быть `.cmd`-обёрткой, которую запускает только оболочка.
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm licenses list failed (exit ${result.status}):\n${result.stderr}`);
  }
  return result.stdout;
}

async function main() {
  const [file] = process.argv.slice(2);
  const raw = file === undefined ? runPnpmLicenses() : await readFile(file, 'utf8');
  // Без prod-зависимостей pnpm может вывести пустую строку.
  const report = raw.trim() === '' ? {} : JSON.parse(raw);
  const problems = findDisallowed(report);
  if (problems.length > 0) {
    console.error('npm licenses: not allowed or not recognised (ADR-24):');
    for (const p of problems) {
      console.error(`  ${p.name}@${p.versions.join(',')}: ${p.license}`);
    }
    console.error('Allowed: ' + [...ALLOWED_LICENSES].join(', '));
    process.exitCode = 1;
    return;
  }
  const count = Object.values(report).reduce((n, list) => n + list.length, 0);
  console.log(`npm licenses ok (${count} production packages)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  });
}
