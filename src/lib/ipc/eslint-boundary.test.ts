// @vitest-environment node
//
// Граница IPC (CLAUDE.md, правило 5): `@tauri-apps/api/*` разрешён только в src/lib/ipc/.
// Проверяем реальный eslint.config.js через ESLint Node API на виртуальных файлах.
import { ESLint, type Linter } from 'eslint';
import ts from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

// Фикстуры не существуют на диске, поэтому типовую информацию выключаем: правило границы
// синтаксическое и от неё не зависит.
const eslint = new ESLint({
  overrideConfig: [{ files: ['**/*.ts'], ...ts.configs.disableTypeChecked }],
});

async function boundaryErrors(code: string, filePath: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter(
    (message) =>
      message.ruleId === 'no-restricted-imports' || message.ruleId === 'no-restricted-syntax',
  );
}

const CORE_IMPORT = "import { invoke } from '@tauri-apps/api/core';\nexport const run = invoke;\n";

describe('ESLint IPC boundary', () => {
  it('rejects @tauri-apps/api/core imports in feature code', async () => {
    const errors = await boundaryErrors(CORE_IMPORT, 'src/lib/features/x/fixture.ts');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('src/lib/ipc/');
  });

  it('allows @tauri-apps/api/core imports inside src/lib/ipc', async () => {
    expect(await boundaryErrors(CORE_IMPORT, 'src/lib/ipc/fixture.ts')).toEqual([]);
  });

  it('rejects other Tauri modules, plugins and dynamic imports outside src/lib/ipc', async () => {
    const code = [
      "import { listen } from '@tauri-apps/api/event';",
      "import { readFile } from '@tauri-apps/plugin-fs';",
      "export const lazy = () => import('@tauri-apps/api/core');",
      'export { listen, readFile };',
    ].join('\n');
    expect(await boundaryErrors(code, 'src/routes/fixture.ts')).toHaveLength(3);
  });

  it('rejects template-literal dynamic imports and Tauri globals outside src/lib/ipc', async () => {
    const code = [
      'export const lazy = () => import(`@tauri-apps/api/core`);',
      "export const raw = (w: { __TAURI_INTERNALS__: { invoke: (c: string) => void } }) => w.__TAURI_INTERNALS__.invoke('x');",
    ].join('\n');
    expect(await boundaryErrors(code, 'src/routes/fixture.ts')).toHaveLength(2);
    expect(await boundaryErrors(code, 'src/lib/ipc/fixture.ts')).toEqual([]);
  });

  it('allows @tauri-apps/api/mocks only in tests', async () => {
    const code = "import { mockIPC } from '@tauri-apps/api/mocks';\nexport { mockIPC };\n";
    expect(await boundaryErrors(code, 'src/lib/features/x/fixture.test.ts')).toEqual([]);
    expect(await boundaryErrors(code, 'src/lib/features/x/fixture.ts')).toHaveLength(1);
  });
});
