// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GENERATED_PATHS, parsePorcelain } from './check-generated.mjs';

describe('parsePorcelain', () => {
  it('treats empty output as clean', () => {
    expect(parsePorcelain('')).toEqual([]);
    expect(parsePorcelain('\n')).toEqual([]);
  });

  it('reports modified and untracked files', () => {
    expect(parsePorcelain(' M src/lib/ipc/bindings.ts\n?? schemas/course.json\n')).toEqual([
      ' M src/lib/ipc/bindings.ts',
      '?? schemas/course.json',
    ]);
  });

  it('handles CRLF output', () => {
    expect(parsePorcelain('?? schemas/a.json\r\n')).toEqual(['?? schemas/a.json']);
  });

  it('covers bindings, spike bindings and schemas', () => {
    expect(GENERATED_PATHS).toEqual([
      'src/lib/ipc/bindings.ts',
      'src/lib/ipc/bindings.spikes.ts',
      'schemas/',
    ]);
  });
});
