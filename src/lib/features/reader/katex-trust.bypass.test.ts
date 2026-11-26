// QA T-004.1: попытки обойти политику `katexTrust` через `\htmlData`, вложенность и макросы.
import { describe, expect, it } from 'vitest';
import { renderMath, renderMathToString } from './katex-trust.js';

/** Все имена атрибутов в отрендеренной формуле. */
function attributeNames(host: Element): string[] {
  const names = new Set<string>();
  for (const el of host.querySelectorAll('*')) {
    for (const attr of el.attributes) names.add(attr.name);
  }
  return [...names];
}

function renderToDom(tex: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderMathToString(tex);
  return host;
}

/** Нет ссылок, картинок, обработчиков событий и чужих id. */
function expectNoDangerousMarkup(host: HTMLElement): void {
  expect(host.querySelector('a, img, script, iframe, [href], [src], [id]')).toBeNull();
  const names = attributeNames(host);
  expect(names.filter((n) => /^on/i.test(n))).toEqual([]);
  // KaTeX сам ставит только эти атрибуты; всё остальное должно быть `data-*`.
  const allowed = new Set(['class', 'style', 'xmlns', 'encoding', 'aria-hidden', 'mathcolor']);
  expect(names.filter((n) => !allowed.has(n) && !n.startsWith('data-'))).toEqual([]);
}

describe('katexTrust bypass attempts', () => {
  it.each([
    ['onclick', '\\htmlData{onclick=alert(1)}{x}', 'data-onclick'],
    ['href', '\\htmlData{href=javascript:alert(1)}{x}', 'data-href'],
    ['style', '\\htmlData{style=color:red}{x}', 'data-style'],
    ['data- prefix', '\\htmlData{data-t=x}{y}', 'data-data-t'],
  ])('prefixes dangerous \\htmlData key %s with data-', (_name, tex, attr) => {
    const host = renderToDom(tex);
    expect(host.querySelector(`[${attr}]`)).not.toBeNull();
    expectNoDangerousMarkup(host);
  });

  it('escapes quotes and markup in \\htmlData values', () => {
    const host = renderToDom('\\htmlData{t=a"onmouseover="alert(1)}{x}');
    expect(host.querySelector('[data-t]')).toHaveAttribute('data-t', 'a"onmouseover="alert(1)');
    expectNoDangerousMarkup(host);

    const img = renderToDom('\\htmlData{t=<img src=x onerror=alert(1)>}{x}');
    expect(img.querySelector('[data-t]')).toHaveAttribute('data-t', '<img src=x onerror=alert(1)>');
    expectNoDangerousMarkup(img);
  });

  it('keeps Unicode \\htmlData values intact', () => {
    const host = renderToDom('\\htmlData{t=ёж😀}{y}');
    expect(host.querySelector('[data-t]')).toHaveAttribute('data-t', 'ёж😀');
  });

  it('rejects \\href nested inside allowed \\htmlData', () => {
    const host = renderToDom('\\htmlData{t=1}{\\href{javascript:alert(1)}{x}}');
    expect(host.querySelector('[data-t]')).toHaveAttribute('data-t', '1');
    expectNoDangerousMarkup(host);
    expect(host.textContent).toContain('\\href');
  });

  it('rejects \\htmlClass nested two levels inside \\htmlData', () => {
    const host = renderToDom('\\htmlData{t=1}{\\htmlData{t=2}{\\htmlClass{evil}{z}}}');
    expect(host.querySelector('.evil')).toBeNull();
    expect([...host.querySelectorAll('[data-t]')].map((el) => el.getAttribute('data-t'))).toEqual([
      '1',
      '2',
    ]);
  });

  it.each([
    '\\url{javascript:alert(1)}',
    '\\href{javascript:alert(1)}{x}',
    '\\href{data:text/html,x}{x}',
  ])('does not create a link for %s', (tex) => {
    expectNoDangerousMarkup(renderToDom(tex));
  });

  it.each(['\\def\\a{\\a\\a}\\a', '\\def\\a{x\\a}\\a', '\\gdef\\b{\\b}\\b'])(
    'stops macro bomb %s with maxExpand instead of hanging',
    (tex) => {
      const host = renderToDom(tex);
      expect(host.querySelector('.katex-error')).not.toBeNull();
      expect(host.querySelector('.katex-error')?.getAttribute('title')).toContain(
        'Too many expansions',
      );
    },
  );

  it('renders a long flat expression without throwing', () => {
    const tex = `${'x+'.repeat(5000)}x`;
    expect(() => renderMathToString(tex)).not.toThrow();
  });

  it('renders \\htmlData with empty key as harmless data- attribute', () => {
    const host = renderToDom('\\htmlData{=x}{y}');
    expectNoDangerousMarkup(host);
  });

  it('renders \\htmlData with no key/value as a parse error', () => {
    const host = renderToDom('\\htmlData{}{y}');
    expect(host.querySelector('.katex-error')).not.toBeNull();
  });

  it('applies the same policy in DOM rendering (renderMath)', () => {
    const el = document.createElement('div');
    renderMath(el, '\\htmlData{t=1}{\\href{javascript:alert(1)}{x}} + \\htmlId{evil}{y}');
    expect(el.querySelector('[data-t]')).toHaveAttribute('data-t', '1');
    expectNoDangerousMarkup(el);
  });
});
