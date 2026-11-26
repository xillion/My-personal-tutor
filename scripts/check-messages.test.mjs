// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findMessageProblems, messagePath } from './check-messages.mjs';

describe('findMessageProblems', () => {
  it('accepts catalogs with the same keys', () => {
    expect(
      findMessageProblems({
        ru: { $schema: 'x', a: 'А', b: 'Б' },
        en: { a: 'A', b: 'B' },
      }),
    ).toEqual([]);
  });

  it('reports a key missing in en', () => {
    expect(findMessageProblems({ ru: { a: 'А', b: 'Б' }, en: { a: 'A' } })).toEqual([
      'en: missing key "b"',
    ]);
  });

  it('reports a key missing in ru (the base locale) as well', () => {
    expect(findMessageProblems({ ru: { a: 'А' }, en: { a: 'A', extra: 'E' } })).toEqual([
      'ru: missing key "extra"',
    ]);
  });

  it('reports empty messages', () => {
    expect(findMessageProblems({ ru: { a: ' ' }, en: { a: 'A' } })).toEqual([
      'ru: empty message "a"',
    ]);
  });
});

describe('messagePath', () => {
  it('substitutes the locale into the inlang path pattern', () => {
    expect(messagePath('./messages/{locale}.json', 'en')).toBe('./messages/en.json');
  });
});
