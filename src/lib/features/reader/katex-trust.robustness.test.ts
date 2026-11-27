// QA T-004.1, дефект D1: renderMath/renderMathToString бросают исключение на курсовой TeX,
// несмотря на `throwOnError: false` («ошибка разметки видна в формуле, а не роняет урок»).
// Исправлено try/catch + fallback `.katex-error` и пределом длины в katex-trust.ts.
import { describe, expect, it } from 'vitest';
import { renderMath, renderMathToString } from './katex-trust.js';

const HOSTILE = [
  // KaTeX бросает ParseError из toMarkup, а не из парсера — throwOnError его не ловит.
  '\\htmlData{a onclick=1}{y}',
  '\\htmlData{t>=1}{y}',
  // Глубокая вложенность — RangeError: Maximum call stack size exceeded.
  `${'\\frac{1}{'.repeat(1000)}x${'}'.repeat(1000)}`,
  `${'{'.repeat(5000)}x${'}'.repeat(5000)}`,
];

describe('katex-trust robustness (D1)', () => {
  it.each(HOSTILE.map((tex) => [tex.slice(0, 40), tex]))(
    'renderMathToString does not throw: %s',
    (_l, tex) => {
      expect(() => renderMathToString(tex)).not.toThrow();
    },
  );

  it.each(HOSTILE.map((tex) => [tex.slice(0, 40), tex]))(
    'renderMath does not throw: %s',
    (_l, tex) => {
      expect(() => {
        renderMath(document.createElement('div'), tex);
      }).not.toThrow();
    },
  );
});
