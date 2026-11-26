// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findExternalUrls } from './check-no-external-urls.mjs';

describe('findExternalUrls', () => {
  it('allows only listed XML namespaces', () => {
    const html =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">';
    expect(findExternalUrls(html)).toEqual([]);
  });

  it('reports external hosts in html and css with line numbers', () => {
    const css = 'a{}\n@import url(https://fonts.googleapis.com/css2?family=Andika);\n';
    expect(findExternalUrls(css)).toEqual([
      { line: 2, url: 'https://fonts.googleapis.com/css2?family=Andika' },
    ]);
    expect(findExternalUrls('<script src="http://cdn.example.com/x.js"></script>')).toEqual([
      { line: 1, url: 'http://cdn.example.com/x.js' },
    ]);
  });

  it('reports scheme-relative and websocket URLs', () => {
    expect(findExternalUrls('body{background:url(//cdn.example.org/bg.png)}')).toEqual([
      { line: 1, url: '//cdn.example.org/bg.png' },
    ]);
    expect(findExternalUrls('<link href="//cdn.example.org/x.css">')).toHaveLength(1);
    expect(findExternalUrls('a{b:"wss://live.example.org/socket"}')).toHaveLength(1);
  });

  it('accepts url-encoded svg namespaces in data URIs', () => {
    const css =
      'a{background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E")}';
    expect(findExternalUrls(css)).toEqual([]);
  });

  it('treats lookalikes of allowed namespaces as external', () => {
    expect(findExternalUrls('http://www.w3.org/2000/svg.evil.example/x')).toHaveLength(1);
  });
});
