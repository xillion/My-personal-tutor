import { describe, expect, it } from 'vitest';
import { CspSpike } from './csp.svelte.js';
import { widen } from './pointer.svelte.js';
import { voicesFor } from './tts.svelte.js';

describe('widen', () => {
  it('extends an empty range and keeps min/max', () => {
    let range = widen({ min: null, max: null }, 0.5);
    range = widen(range, 0.2);
    range = widen(range, 0.9);
    expect(range).toEqual({ min: 0.2, max: 0.9 });
  });
});

describe('voicesFor', () => {
  it('matches language prefixes case-insensitively', () => {
    const voices = [
      { id: '1', name: 'A', language: 'en-US' },
      { id: '2', name: 'B', language: 'EN-gb' },
      { id: '3', name: 'C', language: 'ru-RU' },
    ];
    expect(voicesFor(voices, 'en').map((v) => v.id)).toEqual(['1', '2']);
    expect(voicesFor(voices, 'ru').map((v) => v.id)).toEqual(['3']);
  });
});

describe('CspSpike', () => {
  it('counts securitypolicyviolation events and keeps the last five', () => {
    const csp = new CspSpike();
    const stop = csp.listen();
    for (let i = 0; i < 7; i++) {
      const event = new Event('securitypolicyviolation');
      Object.assign(event, {
        effectiveDirective: 'img-src',
        blockedURI: `https://example.com/${i}.png`,
        sourceFile: '',
        disposition: 'enforce',
      });
      document.dispatchEvent(event);
    }
    stop();
    document.dispatchEvent(new Event('securitypolicyviolation'));
    expect(csp.count).toBe(7);
    expect(csp.last).toHaveLength(5);
    expect(csp.last[0]?.blockedURI).toBe('https://example.com/2.png');
  });
});
