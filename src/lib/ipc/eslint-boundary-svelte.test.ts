// @vitest-environment node
//
// Граница IPC для компонентов: правило из eslint.config.js должно срабатывать и в `<script>`
// файлов `.svelte` (их разбирает svelte-eslint-parser, а не typescript-eslint напрямую).
import { ESLint, type Linter } from 'eslint';
import ts from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

// Фикстуры виртуальные (нет на диске), поэтому типовую информацию выключаем.
const eslint = new ESLint({
  overrideConfig: [{ files: ['**/*.ts', '**/*.svelte'], ...ts.configs.disableTypeChecked }],
});

async function boundaryErrors(code: string, filePath: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath });
  const messages = result?.messages ?? [];
  // Фатальная ошибка разбора тоже провалила бы lint, но не по той причине — ловим явно.
  expect(messages.filter((message) => message.fatal === true)).toEqual([]);
  return messages.filter(
    (message) =>
      message.ruleId === 'no-restricted-imports' || message.ruleId === 'no-restricted-syntax',
  );
}

const COMPONENT = [
  '<script lang="ts">',
  "  import { invoke } from '@tauri-apps/api/core';",
  '  console.log(invoke);',
  '</script>',
  '',
  '<p>x</p>',
  '',
].join('\n');

describe('ESLint IPC boundary in Svelte components', () => {
  it('rejects @tauri-apps/api/core imports in a feature component', async () => {
    const errors = await boundaryErrors(COMPONENT, 'src/lib/features/x/Fixture.svelte');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.ruleId).toBe('no-restricted-imports');
    expect(errors[0]?.line).toBe(2);
  });

  it('rejects @tauri-apps/api/core imports in route components', async () => {
    expect(await boundaryErrors(COMPONENT, 'src/routes/+page.svelte')).toHaveLength(1);
  });

  it('rejects the import in .svelte.ts state modules', async () => {
    const code = "import { invoke } from '@tauri-apps/api/core';\nexport const run = invoke;\n";
    expect(await boundaryErrors(code, 'src/lib/features/x/state.svelte.ts')).toHaveLength(1);
  });

  it('allows the import in a component inside src/lib/ipc', async () => {
    expect(await boundaryErrors(COMPONENT, 'src/lib/ipc/Fixture.svelte')).toEqual([]);
  });

  it('does not exempt directories that only look like ipc', async () => {
    const code = "import { invoke } from '@tauri-apps/api/core';\nexport const run = invoke;\n";
    expect(await boundaryErrors(code, 'src/lib/ipc-helpers/fixture.ts')).toHaveLength(1);
    expect(await boundaryErrors(code, 'src/lib/features/ipc/fixture.ts')).toHaveLength(1);
  });
});
