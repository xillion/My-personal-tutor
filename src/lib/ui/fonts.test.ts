// @vitest-environment node
//
// Локальные шрифты (ADR-15, T-001.3): каждый `@font-face` указывает на существующий файл из
// static/, у каждого семейства четыре начертания, рядом лежит лицензия OFL-1.1, а
// `data-font="dyslexic"` даёт стек "OpenDyslexic", "Andika".
//
// CSS читаем с диска: в Vitest импорт `*.css?raw` возвращает пустую строку (обработка CSS
// выключена). `node:fs` берём через getBuiltinModule, чтобы не подключать @types/node.
import { describe, expect, it } from 'vitest';

interface NodeFs {
  readFileSync(path: URL, encoding: 'utf8'): string;
  existsSync(path: URL): boolean;
}
const fs = (
  globalThis as unknown as { process: { getBuiltinModule(id: 'node:fs'): NodeFs } }
).process.getBuiltinModule('node:fs');

const STATIC_ROOT = new URL('../../../static/', import.meta.url);
const read = (relative: string): string =>
  fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const fontsCss = read('./fonts.css');
const tokensCss = read('./tokens.css');
const licenses = Object.fromEntries(
  ['andika', 'opendyslexic'].map((dir) => [
    dir,
    fs.readFileSync(new URL(`fonts/${dir}/OFL.txt`, STATIC_ROOT), 'utf8'),
  ]),
);

interface FontFace {
  family: string;
  style: string;
  weight: string;
  urls: string[];
}

function parseFontFaces(css: string): FontFace[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body = '']) => {
    const prop = (name: string): string =>
      new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim() ?? '';
    return {
      family: prop('font-family').replace(/['"]/g, ''),
      style: prop('font-style'),
      weight: prop('font-weight'),
      urls: [...body.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(([, url = '']) => url),
    };
  });
}

const faces = parseFontFaces(fontsCss);

describe('local fonts', () => {
  it('declares regular, italic, bold and bold italic for Andika and OpenDyslexic', () => {
    for (const family of ['Andika', 'OpenDyslexic']) {
      const variants = faces
        .filter((face) => face.family === family)
        .map((face) => `${face.style} ${face.weight}`)
        .sort();
      expect(variants, family).toEqual(['italic 400', 'italic 700', 'normal 400', 'normal 700']);
    }
  });

  it('points every @font-face at an existing woff2 file under static/', () => {
    const urls = faces.flatMap((face) => face.urls);
    expect(urls).toHaveLength(8);
    for (const url of urls) {
      expect(url, url).toMatch(/^\/fonts\/.+\.woff2$/);
      expect(fs.existsSync(new URL(`.${url}`, STATIC_ROOT)), url).toBe(true);
    }
  });

  it('ships an OFL-1.1 license next to each font family', () => {
    for (const [path, text] of Object.entries(licenses)) {
      expect(text, path).toContain('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007');
      expect(text, path).toContain('licensed under the SIL Open Font License, Version 1.1');
    }
  });
});

describe('reading font tokens', () => {
  it('uses Andika by default', () => {
    expect(tokensCss).toMatch(/@theme\s*\{[^}]*--font-reading:\s*'Andika'/);
  });

  it('switches to OpenDyslexic with Andika fallback under data-font="dyslexic"', () => {
    const rule = /:root\[data-font=['"]dyslexic['"]\]\s*\{([^}]*)\}/.exec(tokensCss)?.[1] ?? '';
    expect(rule).toMatch(/--font-reading:\s*'OpenDyslexic',\s*'Andika'/);
  });
});
