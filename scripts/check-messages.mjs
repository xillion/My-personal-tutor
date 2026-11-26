#!/usr/bin/env node
// Полнота переводов (KI-005, T-002): у каждой локали из project.inlang/settings.json тот же
// набор ключей в messages/{locale}.json, без пустых строк. Paraglide при отсутствии ключа
// молча берёт базовую локаль, поэтому без этой проверки пропуск перевода не виден.
// Запускается в `pnpm check`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SETTINGS_PATH = 'project.inlang/settings.json';
/** Служебные ключи формата сообщений, не являющиеся сообщениями. */
const IGNORED_KEYS = new Set(['$schema']);

/**
 * Сравнивает каталоги сообщений: ключ, который есть хотя бы в одной локали, обязан быть во
 * всех; значение не может быть пустой строкой.
 * @param {Record<string, Record<string, unknown>>} catalogs локаль → содержимое JSON
 * @returns {string[]} описания проблем; пустой массив — каталоги согласованы
 */
export function findMessageProblems(catalogs) {
  const locales = Object.keys(catalogs).sort();
  const allKeys = new Set();
  for (const locale of locales) {
    for (const key of Object.keys(catalogs[locale] ?? {})) {
      if (!IGNORED_KEYS.has(key)) allKeys.add(key);
    }
  }
  const problems = [];
  for (const key of [...allKeys].sort()) {
    for (const locale of locales) {
      const catalog = catalogs[locale] ?? {};
      if (!Object.hasOwn(catalog, key)) {
        problems.push(`${locale}: missing key "${key}"`);
      } else if (typeof catalog[key] === 'string' && catalog[key].trim() === '') {
        problems.push(`${locale}: empty message "${key}"`);
      }
    }
  }
  return problems;
}

/**
 * @param {string} pattern `pathPattern` плагина message-format, например `./messages/{locale}.json`
 * @param {string} locale
 */
export function messagePath(pattern, locale) {
  return pattern.replace('{locale}', locale);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const settings = readJson(SETTINGS_PATH);
  const pattern = settings['plugin.inlang.messageFormat']?.pathPattern;
  if (typeof pattern !== 'string') {
    throw new Error(`${SETTINGS_PATH}: plugin.inlang.messageFormat.pathPattern is not set`);
  }
  /** @type {Record<string, Record<string, unknown>>} */
  const catalogs = {};
  const problems = [];
  for (const locale of settings.locales) {
    const path = messagePath(pattern, locale);
    try {
      catalogs[locale] = readJson(path);
    } catch (error) {
      problems.push(
        `${locale}: cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  problems.push(...findMessageProblems(catalogs));
  if (problems.length === 0) {
    console.log(`check-messages: ${settings.locales.join(', ')} have the same message keys`);
    return;
  }
  console.error('check-messages: message catalogs are incomplete:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
