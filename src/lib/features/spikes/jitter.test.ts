import { clearMocks, mockConvertFileSrc, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rejectWith } from '../../../test/ipc.js';
import { JitterSpike } from './jitter.svelte.js';
import { measurePlaybackRate } from './media-events.js';

const FILE = {
  name: 'speech.ogg',
  mime: 'audio/ogg',
  path: '/home/alice/.local/share/app/courses/_spike/speech.ogg',
  sizeBytes: 4,
};

/**
 * Фиктивный `<audio>`: asset-URL не играет (как WebKitGTK: `NotSupportedError`), Blob URL играет,
 * `currentTime` растёт вместе с «кадрами».
 */
class FakeAudio extends EventTarget {
  static clock = 0;
  src = '';
  preload = '';
  playbackRate = 1;
  ended = false;
  error: { code: number } | null = null;
  readonly readyState = 4;
  #started = 0;
  #playing = false;
  get currentTime(): number {
    return this.#playing ? (FakeAudio.clock - this.#started) / 1000 : 0;
  }
  play(): Promise<void> {
    if (!this.src.startsWith('blob:')) {
      this.error = { code: 4 };
      return Promise.reject(new DOMException('not supported', 'NotSupportedError'));
    }
    this.#started = FakeAudio.clock;
    this.#playing = true;
    return Promise.resolve();
  }
  pause(): void {
    this.#playing = false;
  }
  removeAttribute(): void {
    this.src = '';
  }
}

const createObjectURL = vi.fn((_blob: Blob) => 'blob:x/2');
const revokeObjectURL = vi.fn((_url: string) => undefined);
const original: Partial<Record<string, PropertyDescriptor>> = Object.getOwnPropertyDescriptors(URL);

beforeEach(() => {
  mockConvertFileSrc('linux');
  FakeAudio.clock = 0;
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    FakeAudio.clock += 250;
    queueMicrotask(() => {
      cb(FakeAudio.clock);
    });
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
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

describe('JitterSpike', () => {
  it('measures both sources by default; an asset failure does not block blob', async () => {
    const calls: unknown[] = [];
    mockIPC((cmd, args) => {
      calls.push({ cmd, args });
      return new Uint8Array([1, 2, 3, 4]).buffer;
    });
    const jitter = new JitterSpike();
    await jitter.measureAll(FILE);
    const runs = jitter.report();
    expect(runs.map((r) => r.source)).toEqual(['asset', 'blob']);
    expect(runs[0]?.stats).toBeNull();
    expect(runs[0]?.error).toContain('NotSupportedError');
    expect(runs[1]?.error).toBeNull();
    expect(runs[1]?.stats).not.toBeNull();
    expect(calls).toEqual([{ cmd: 'spike_media_bytes', args: { name: 'speech.ogg' } }]);
    expect(createObjectURL.mock.calls[0]?.[0].type).toBe('audio/ogg');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x/2');
    expect(jitter.running).toBeNull();
  });

  it('measures a single chosen source and replaces only its previous run', async () => {
    mockIPC(() => new ArrayBuffer(4));
    const jitter = new JitterSpike();
    await jitter.measureAll(FILE);
    await jitter.measureAll(FILE, ['blob']);
    expect(jitter.report().map((r) => r.source)).toEqual(['asset', 'blob']);
  });

  it('reports a spike_media_bytes error for the blob source', async () => {
    mockIPC(() => rejectWith({ code: 'app.invalid_argument', message: 'unknown name' }));
    const jitter = new JitterSpike();
    await jitter.measure(FILE, 'blob');
    expect(jitter.report()).toEqual([
      {
        file: 'speech.ogg',
        source: 'blob',
        stats: null,
        error: 'Error: app.invalid_argument: unknown name',
      },
    ]);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('measurePlaybackRate', () => {
  it('starts the window only after currentTime begins to advance', async () => {
    vi.useFakeTimers();
    let wall = 0;
    // Старт конвейера — 800 мс после play(); затем скорость 0.75.
    const media = {
      paused: false,
      get currentTime(): number {
        return Math.max(0, wall - 800) * 0.00075;
      },
    };
    const now = (): number => wall;
    const pending = measurePlaybackRate(media, 2000, { now, pollMs: 20 });
    for (let i = 0; i < 200; i++) {
      wall += 20;
      await vi.advanceTimersByTimeAsync(20);
    }
    await expect(pending).resolves.toBeCloseTo(0.75, 2);
    vi.useRealTimers();
  });

  it('returns null when playback never starts', async () => {
    vi.useFakeTimers();
    let wall = 0;
    const pending = measurePlaybackRate({ paused: false, currentTime: 0 }, 2000, {
      now: () => wall,
      startTimeoutMs: 500,
    });
    for (let i = 0; i < 30; i++) {
      wall += 20;
      await vi.advanceTimersByTimeAsync(20);
    }
    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();
  });
});
