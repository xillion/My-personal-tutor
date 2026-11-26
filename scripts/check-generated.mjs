#!/usr/bin/env node
// `just gen-check` (T-002): после `just gen` сгенерированные файлы не должны отличаться от git.
//
// `git status --porcelain` видит и изменённые, и новые неотслеживаемые файлы (в отличие от
// `git diff --exit-code`, KI из T-001.4). Пустой вывод — дерево актуально.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Пути, которые пишет `just gen` (ADR-23). `bindings.spikes.ts` — спайк-команды за cargo-feature
 * `spikes` (T-004.1), генерируется вторым запуском `gen_bindings`.
 */
export const GENERATED_PATHS = [
  'src/lib/ipc/bindings.ts',
  'src/lib/ipc/bindings.spikes.ts',
  'schemas/',
];

/**
 * Разбирает вывод `git status --porcelain` в список непустых строк.
 * @param {string} output
 * @returns {string[]}
 */
export function parsePorcelain(output) {
  return output.split(/\r?\n/).filter((line) => line.trim() !== '');
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    throw new Error(`git ${args.join(' ')} exited with ${result.status}`);
  }
  return result.stdout;
}

function main() {
  const changed = parsePorcelain(git(['status', '--porcelain', '--', ...GENERATED_PATHS]));
  if (changed.length === 0) {
    console.log('gen-check: generated files are up to date');
    return;
  }
  console.error('gen-check: generated files differ from git. Run `just gen` and commit:');
  for (const line of changed) console.error(`  ${line}`);
  process.stderr.write(git(['diff', '--stat', '--', ...GENERATED_PATHS]));
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
