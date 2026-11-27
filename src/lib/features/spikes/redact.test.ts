import { describe, expect, it } from 'vitest';
import { redactLocation, redactReport, scrubHomeDirs } from './redact.js';

describe('redactLocation', () => {
  it.each([
    [
      '/home/alice/.local/share/com.mpt.app/courses/_spike/speech.m4a',
      '$APPDATA/courses/_spike/speech.m4a',
    ],
    ['/home/alice/.local/share/com.mpt.app/courses/_spike', '$APPDATA/courses/_spike'],
    [
      'C:\\Users\\Alice\\AppData\\Roaming\\com.mpt.app\\courses\\_spike\\speech.ogg',
      '$APPDATA/courses/_spike/speech.ogg',
    ],
    [
      '/Users/alice/Library/Application Support/com.mpt.app/courses/_spike/speech.m4a',
      '$APPDATA/courses/_spike/speech.m4a',
    ],
    ['/home/alice/tmp/other.wav', '…/other.wav'],
  ])('redacts path %s', (input, expected) => {
    expect(redactLocation(input)).toBe(expected);
  });

  it.each([
    [
      'asset://localhost/%2Fhome%2Falice%2F.local%2Fshare%2Fapp%2Fcourses%2F_spike%2Fspeech.m4a',
      'asset://localhost/…/speech.m4a',
    ],
    [
      'http://asset.localhost/C%3A%5CUsers%5CAlice%5CAppData%5CRoaming%5Capp%5Ccourses%5C_spike%5Cspeech.ogg',
      'http://asset.localhost/…/speech.ogg',
    ],
    [
      'asset://localhost/%2FUsers%2Falice%2FLibrary%2FApplication%20Support%2Fapp%2Fspeech%20one.m4a',
      'asset://localhost/…/speech one.m4a',
    ],
  ])('redacts URL-encoded asset URL %s', (input, expected) => {
    expect(redactLocation(input)).toBe(expected);
    expect(redactLocation(input)).not.toMatch(/alice/i);
  });

  it('keeps ordinary URLs, blob URLs and plain strings', () => {
    expect(redactLocation('http://tauri.localhost/_app/immutable/app.js')).toBe(
      'http://tauri.localhost/_app/immutable/app.js',
    );
    expect(redactLocation('blob:http://tauri.localhost/1234-abcd')).toBe(
      'blob:http://tauri.localhost/1234-abcd',
    );
    expect(redactLocation('inline')).toBe('inline');
    expect(redactLocation('\\frac{1}{2}')).toBe('\\frac{1}{2}');
  });
});

describe('scrubHomeDirs', () => {
  it('replaces home directories inside text', () => {
    expect(scrubHomeDirs('cannot create /home/alice/x: denied')).toBe('cannot create ~/x: denied');
    expect(scrubHomeDirs('open C:\\Users\\Alice\\AppData failed')).toBe('open ~\\AppData failed');
    expect(scrubHomeDirs('at /Users/alice/Library')).toBe('at ~/Library');
    expect(scrubHomeDirs('url %2Fhome%2Falice%2Fx')).toBe('url ~%2Fx');
  });
});

describe('redactReport', () => {
  it('redacts nested strings and keeps other values', () => {
    const report = {
      dir: '/home/alice/.local/share/app/courses/_spike',
      probes: [{ url: 'asset://localhost/%2Fhome%2Falice%2Fcourses%2F_spike%2Fa.m4a', n: 1 }],
      error: { message: 'io error at /home/alice/.local' },
      ok: true,
      none: null,
    };
    expect(redactReport(report)).toEqual({
      dir: '$APPDATA/courses/_spike',
      probes: [{ url: 'asset://localhost/…/a.m4a', n: 1 }],
      error: { message: 'io error at ~/.local' },
      ok: true,
      none: null,
    });
  });
});
