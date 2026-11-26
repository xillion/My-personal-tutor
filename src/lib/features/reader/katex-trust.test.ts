import { describe, expect, it } from 'vitest';
import { katexTrust, renderMathToString } from './katex-trust.js';

function renderToDom(tex: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderMathToString(tex);
  return host;
}

describe('katexTrust', () => {
  it('allows \\htmlData', () => {
    expect(katexTrust({ command: '\\htmlData', attributes: { t: 'x' } })).toBe(true);
  });

  it.each([
    { command: '\\href', url: 'https://example.com' },
    { command: '\\url', url: 'https://example.com' },
    { command: '\\includegraphics', url: 'pic.png' },
    { command: '\\htmlStyle', style: 'color: red' },
    { command: '\\htmlClass', class: 'evil' },
    { command: '\\htmlId', id: 'evil' },
  ] as const)('rejects $command', (context) => {
    expect(katexTrust(context)).toBe(false);
  });
});

describe('renderMath with katexTrust', () => {
  it('renders \\htmlData as data-* attributes', () => {
    const host = renderToDom('\\htmlData{t=t1, kind=term}{x^2} + \\htmlData{t=t2}{1}');
    const parts = host.querySelectorAll('[data-t]');
    expect([...parts].map((el) => el.getAttribute('data-t'))).toEqual(['t1', 't2']);
    expect(parts[0]).toHaveAttribute('data-kind', 'term');
  });

  it('does not create a link for \\href', () => {
    const host = renderToDom('\\href{https://example.com}{x}');
    expect(host.querySelector('a, [href]')).toBeNull();
  });

  it('does not create a link for \\url', () => {
    const host = renderToDom('\\url{https://example.com}');
    expect(host.querySelector('a, [href]')).toBeNull();
  });

  it('does not create an image for \\includegraphics', () => {
    const host = renderToDom('\\includegraphics[height=1em]{pic.png}');
    expect(host.querySelector('img, [src]')).toBeNull();
  });

  it('does not apply \\htmlStyle', () => {
    const host = renderToDom('\\htmlStyle{background: url(x.png)}{x}');
    // Исходник формулы остаётся в MathML-`<annotation>`; проверяем только атрибуты `style`.
    const styles = [...host.querySelectorAll('[style]')].map((el) => el.getAttribute('style'));
    expect(styles.length).toBeGreaterThan(0);
    expect(styles.join(';')).not.toContain('background');
  });

  it('does not add a class for \\htmlClass', () => {
    const host = renderToDom('\\htmlClass{evil}{x}');
    expect(host.querySelector('.evil')).toBeNull();
  });

  it('does not add an id for \\htmlId', () => {
    const host = renderToDom('\\htmlId{evil}{x}');
    expect(host.querySelector('#evil, [id]')).toBeNull();
  });

  it('marks rejected commands as unsupported instead of throwing', () => {
    const host = renderToDom('\\htmlClass{evil}{x}');
    expect(host.textContent).toContain('\\htmlClass');
  });
});
