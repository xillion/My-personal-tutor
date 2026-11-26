import { clearMocks, mockConvertFileSrc, mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, describe, expect, it } from 'vitest';
import { rejectWith } from '../../test/ipc.js';
import { mediaSrc } from './client.js';
import {
  spikePrepareMedia,
  spikeTtsSpeak,
  spikeTtsVoices,
  type SpikeMediaDto,
  type SpikeTtsVoicesDto,
} from './spikes.js';

const MEDIA: SpikeMediaDto = {
  dir: '/data/courses/_spike',
  files: [
    {
      name: 'speech.m4a',
      mime: 'audio/mp4',
      path: '/data/courses/_spike/speech.m4a',
      sizeBytes: 10,
    },
    {
      name: 'speech.ogg',
      mime: 'audio/ogg',
      path: '/data/courses/_spike/speech.ogg',
      sizeBytes: 8,
    },
  ],
};

const VOICES: SpikeTtsVoicesDto = {
  backend: 'SpeechDispatcher',
  voices: [{ id: 'en-us', name: 'English (America)', language: 'en-US' }],
  totalVoices: 3,
  rateMin: -100,
  rateNormal: 0,
  rateMax: 100,
};

afterEach(() => {
  clearMocks();
});

describe('spike IPC wrappers', () => {
  it('spikePrepareMedia returns media paths', async () => {
    mockIPC((cmd) => (cmd === 'spike_prepare_media' ? MEDIA : undefined));
    await expect(spikePrepareMedia()).resolves.toEqual({ ok: true, data: MEDIA });
  });

  it('spikePrepareMedia returns a typed error', async () => {
    mockIPC(() => rejectWith({ code: 'app.internal', message: 'no data dir' }));
    await expect(spikePrepareMedia()).resolves.toEqual({
      ok: false,
      error: { code: 'app.internal', message: 'no data dir' },
    });
  });

  it('spikeTtsVoices returns voices', async () => {
    mockIPC((cmd) => (cmd === 'spike_tts_voices' ? VOICES : undefined));
    await expect(spikeTtsVoices()).resolves.toEqual({ ok: true, data: VOICES });
  });

  it('spikeTtsVoices maps a missing command (release build) to app.internal', async () => {
    mockIPC((cmd) => rejectWith(`Command ${cmd} not found`));
    const result = await spikeTtsVoices();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('app.internal');
  });

  it('spikeTtsSpeak passes text, lang and rate', async () => {
    let payload: unknown;
    mockIPC((cmd, args) => {
      payload = { cmd, args };
      return { voice: VOICES.voices[0], backendRate: 25 };
    });
    await expect(spikeTtsSpeak('Hello', 'en-US', 1.5)).resolves.toEqual({
      ok: true,
      data: { voice: VOICES.voices[0], backendRate: 25 },
    });
    expect(payload).toEqual({
      cmd: 'spike_tts_speak',
      args: { text: 'Hello', lang: 'en-US', rate: 1.5 },
    });
  });

  it('spikeTtsSpeak returns invalid_argument', async () => {
    mockIPC(() => rejectWith({ code: 'app.invalid_argument', message: 'no voice for xx' }));
    const result = await spikeTtsSpeak('Hi', 'xx', null);
    expect(result).toEqual({
      ok: false,
      error: { code: 'app.invalid_argument', message: 'no voice for xx' },
    });
  });
});

describe('mediaSrc', () => {
  it('converts a path with convertFileSrc', () => {
    mockConvertFileSrc('linux');
    expect(mediaSrc('/data/courses/_spike/speech.m4a')).toBe(
      'asset://localhost/%2Fdata%2Fcourses%2F_spike%2Fspeech.m4a',
    );
  });
});
