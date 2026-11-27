import { clearMocks, mockConvertFileSrc, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rejectWith } from '../../../test/ipc.js';
import { AudioProbe } from './audio-probe.svelte.js';
import { AudioSpike } from './audio.svelte.js';

const FILE = {
  name: 'speech.m4a',
  mime: 'audio/mp4',
  path: '/home/alice/.local/share/app/courses/_spike/speech.m4a',
  sizeBytes: 4,
};

const createObjectURL = vi.fn((_blob: Blob) => 'blob:x/1');
const revokeObjectURL = vi.fn((_url: string) => undefined);
// jsdom их не реализует; сохраняем как есть, чтобы вернуть после теста.
const original: Partial<Record<string, PropertyDescriptor>> = Object.getOwnPropertyDescriptors(URL);

beforeEach(() => {
  mockConvertFileSrc('linux');
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
  clearMocks();
  vi.unstubAllGlobals();
  for (const key of ['createObjectURL', 'revokeObjectURL'] as const) {
    const descriptor = original[key];
    if (descriptor === undefined) Reflect.deleteProperty(URL, key);
    else Object.defineProperty(URL, key, descriptor);
  }
});

describe('AudioProbe (blob source)', () => {
  it('builds the Blob URL from spike_media_bytes and does not depend on fetch', async () => {
    const calls: unknown[] = [];
    mockIPC((cmd, args) => {
      calls.push({ cmd, args });
      return new Uint8Array([1, 2, 3, 4]).buffer;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Load failed'))),
    );
    const probe = new AudioProbe(FILE, 'blob');
    await probe.load();
    await vi.waitFor(() => {
      expect(probe.result.assetFetch).toBe('failed');
    });
    expect(calls).toEqual([{ cmd: 'spike_media_bytes', args: { name: 'speech.m4a' } }]);
    expect(probe.result.bytesIsArrayBuffer).toBe(true);
    expect(probe.result.blobBytes).toBe(4);
    expect(probe.result.bytesError).toBeNull();
    expect(probe.result.url).toBe('blob:x/1');
    expect(probe.result.assetFetchError).toContain('Load failed');
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe('audio/mp4');
    expect(blob?.size).toBe(4);
    probe.dispose();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x/1');
  });

  it('records assetFetch ok separately', async () => {
    mockIPC(() => new ArrayBuffer(2));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(new Uint8Array([1])))),
    );
    const probe = new AudioProbe(FILE, 'blob');
    await probe.load();
    await vi.waitFor(() => {
      expect(probe.result.assetFetch).toBe('ok');
    });
    expect(probe.result.url).toBe('blob:x/1');
  });

  it('reports a command error without creating a Blob URL', async () => {
    mockIPC(() => rejectWith({ code: 'app.invalid_argument', message: 'unknown name' }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('blocked'))),
    );
    const probe = new AudioProbe(FILE, 'blob');
    await probe.load();
    expect(probe.result.bytesError).toBe('app.invalid_argument: unknown name');
    expect(probe.result.url).toBeNull();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('AudioSpike.report', () => {
  it('does not leak the OS user name', async () => {
    mockIPC((cmd) => {
      if (cmd === 'spike_prepare_media') {
        return { dir: '/home/alice/.local/share/app/courses/_spike', files: [FILE] };
      }
      return new ArrayBuffer(4);
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('blocked'))),
    );
    const audio = new AudioSpike();
    await audio.prepare();
    const report = audio.report();
    expect(report.dir).toBe('$APPDATA/courses/_spike');
    expect(report.probes.map((p) => p.url)).toEqual(['asset://localhost/…/speech.m4a', 'blob:x/1']);
    expect(JSON.stringify(report)).not.toContain('alice');
    audio.dispose();
  });
});
