// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findDisallowed, isLicenseAllowed, parseLicenseExpression } from './check-npm-licenses.mjs';

describe('parseLicenseExpression', () => {
  it('gives WITH a higher precedence than AND, and AND than OR', () => {
    expect(parseLicenseExpression('MIT OR Apache-2.0 AND Apache-2.0 WITH LLVM-exception')).toEqual({
      type: 'or',
      left: { type: 'license', id: 'MIT' },
      right: {
        type: 'and',
        left: { type: 'license', id: 'Apache-2.0' },
        right: { type: 'license', id: 'Apache-2.0 WITH LLVM-exception' },
      },
    });
  });

  it('respects parentheses', () => {
    expect(parseLicenseExpression('(MIT OR Apache-2.0) AND Unicode-3.0')).toEqual({
      type: 'and',
      left: {
        type: 'or',
        left: { type: 'license', id: 'MIT' },
        right: { type: 'license', id: 'Apache-2.0' },
      },
      right: { type: 'license', id: 'Unicode-3.0' },
    });
  });

  it('rejects malformed expressions', () => {
    for (const bad of [
      '',
      'MIT OR',
      '(MIT',
      'MIT)',
      'MIT Apache-2.0',
      'SEE LICENSE IN LICENSE.md',
    ]) {
      expect(() => parseLicenseExpression(bad), bad).toThrow();
    }
  });
});

describe('isLicenseAllowed', () => {
  it('accepts allowed single licenses and exceptions', () => {
    expect(isLicenseAllowed('MIT')).toBe(true);
    expect(isLicenseAllowed('(Apache-2.0 WITH LLVM-exception)')).toBe(true);
  });

  it('needs one allowed side of OR and both sides of AND', () => {
    expect(isLicenseAllowed('Apache-2.0 OR MIT')).toBe(true);
    expect(isLicenseAllowed('SSPL-1.0 OR MIT')).toBe(true);
    expect(isLicenseAllowed('MIT AND SSPL-1.0')).toBe(false);
    expect(isLicenseAllowed('(MIT OR SSPL-1.0) AND (BUSL-1.1 OR ISC)')).toBe(true);
  });

  it('treats the legacy slash form as OR', () => {
    expect(isLicenseAllowed('MIT/Apache-2.0')).toBe(true);
  });

  it('rejects unknown, incompatible and unparsable licenses', () => {
    expect(isLicenseAllowed('GPL-2.0-only')).toBe(false);
    expect(isLicenseAllowed('Apache-2.0 WITH Commons-Clause')).toBe(false);
    expect(isLicenseAllowed('UNKNOWN')).toBe(false);
    expect(isLicenseAllowed('SEE LICENSE IN LICENSE.txt')).toBe(false);
  });
});

describe('findDisallowed', () => {
  it('reports packages from pnpm licenses json whose license is not allowed', () => {
    const report = {
      MIT: [{ name: 'ok', versions: ['1.0.0'], license: 'MIT' }],
      'BUSL-1.1': [{ name: 'bad', versions: ['2.0.0', '2.1.0'], license: 'BUSL-1.1' }],
      Unknown: [{ name: 'mystery', versions: ['0.1.0'] }],
    };
    expect(findDisallowed(report)).toEqual([
      { name: 'bad', versions: ['2.0.0', '2.1.0'], license: 'BUSL-1.1' },
      { name: 'mystery', versions: ['0.1.0'], license: 'Unknown' },
    ]);
  });

  it('rejects output that is not a license map', () => {
    expect(() => findDisallowed([])).toThrow();
    expect(() => findDisallowed({ MIT: 'x' })).toThrow();
  });
});
