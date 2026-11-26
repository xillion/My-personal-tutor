// Раздел (1): воспроизведение одного файла одним способом — `convertFileSrc` или Blob URL.
import { mediaSrc } from '#lib/ipc/client.js';
import type { SpikeMediaFileDto } from '#lib/ipc/spikes.js';
import {
  describeError,
  mediaErrorInfo,
  round,
  waitForEvent,
  type MediaErrorInfo,
} from './media-events.js';

export type AudioSourceKind = 'asset' | 'blob';

/** Результат проверки (попадает в JSON-отчёт). */
export interface AudioProbeResult {
  file: string;
  mime: string;
  source: AudioSourceKind;
  url: string | null;
  /** `canPlayType(mime)`: `''`, `'maybe'` или `'probably'`. */
  canPlayType: string;
  /** Blob URL: размер полученного blob, байт; ошибка `fetch`. */
  blobBytes: number | null;
  fetchError: string | null;
  /** Время от назначения `src` до `canplay`, мс. */
  canplayMs: number | null;
  duration: number | null;
  playOk: boolean | null;
  playError: string | null;
  seekTarget: number | null;
  seekActual: number | null;
  seekedMs: number | null;
  ended: boolean | null;
  playbackRate: number | null;
  preservesPitch: boolean | null;
  /** Фактическая скорость по `currentTime` за ~2 с после `playbackRate = 0.75`. */
  measuredRate: number | null;
  mediaError: MediaErrorInfo | null;
}

const SEEK_TIMEOUT_MS = 3000;
const ENDED_TIMEOUT_MS = 5000;
const RATE_SAMPLE_MS = 2000;

export class AudioProbe {
  busy = $state(false);
  result: AudioProbeResult;
  #audio: HTMLAudioElement | null = null;
  #blobUrl: string | null = null;
  #loadStarted = 0;

  constructor(
    readonly file: SpikeMediaFileDto,
    readonly source: AudioSourceKind,
  ) {
    this.result = $state({
      file: file.name,
      mime: file.mime,
      source,
      url: null,
      canPlayType: document.createElement('audio').canPlayType(file.mime),
      blobBytes: null,
      fetchError: null,
      canplayMs: null,
      duration: null,
      playOk: null,
      playError: null,
      seekTarget: null,
      seekActual: null,
      seekedMs: null,
      ended: null,
      playbackRate: null,
      preservesPitch: null,
      measuredRate: null,
      mediaError: null,
    });
  }

  /** Создаёт `<audio>` и назначает `src`; Blob URL — через `fetch` asset-URL. */
  async load(): Promise<void> {
    if (this.#audio !== null) return;
    const assetUrl = mediaSrc(this.file.path);
    let url = assetUrl;
    if (this.source === 'blob') {
      try {
        const response = await fetch(assetUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        this.result.blobBytes = blob.size;
        this.#blobUrl = URL.createObjectURL(blob);
        url = this.#blobUrl;
      } catch (error: unknown) {
        this.result.fetchError = describeError(error);
        return;
      }
    }
    const audio = new Audio();
    audio.preload = 'auto';
    audio.addEventListener('canplay', () => {
      if (this.result.canplayMs === null) {
        this.result.canplayMs = round(performance.now() - this.#loadStarted, 1);
      }
      this.result.duration = Number.isFinite(audio.duration) ? round(audio.duration) : null;
    });
    audio.addEventListener('durationchange', () => {
      if (Number.isFinite(audio.duration)) this.result.duration = round(audio.duration);
    });
    audio.addEventListener('error', () => {
      this.result.mediaError = mediaErrorInfo(audio);
    });
    audio.addEventListener('ended', () => {
      this.result.ended = true;
    });
    this.#audio = audio;
    this.result.url = url;
    this.#loadStarted = performance.now();
    audio.src = url;
    audio.load();
  }

  async play(): Promise<void> {
    await this.#run(async (audio) => {
      try {
        await audio.play();
        this.result.playOk = true;
        this.result.playError = null;
      } catch (error: unknown) {
        this.result.playOk = false;
        this.result.playError = describeError(error);
      }
    });
  }

  pause(): void {
    this.#audio?.pause();
  }

  /** Перемотка на середину; фиксирует фактический `currentTime` после `seeked`. */
  async seekHalf(): Promise<void> {
    await this.#run(async (audio) => {
      if (!Number.isFinite(audio.duration)) return;
      const target = audio.duration / 2;
      const started = performance.now();
      const seeked = waitForEvent(audio, 'seeked', SEEK_TIMEOUT_MS);
      audio.currentTime = target;
      const ok = await seeked;
      this.result.seekTarget = round(target);
      this.result.seekActual = round(audio.currentTime);
      this.result.seekedMs = ok ? round(performance.now() - started, 1) : null;
    });
  }

  /** Перемотка к концу − 1 с, воспроизведение и ожидание `ended`. */
  async seekEndAndWait(): Promise<void> {
    await this.#run(async (audio) => {
      if (!Number.isFinite(audio.duration)) return;
      this.result.ended = false;
      const ended = waitForEvent(audio, 'ended', ENDED_TIMEOUT_MS);
      audio.currentTime = Math.max(0, audio.duration - 1);
      await audio.play().catch((error: unknown) => {
        this.result.playError = describeError(error);
      });
      this.result.ended = await ended;
    });
  }

  /** `playbackRate = 0.75` с `preservesPitch`; скорость измеряется по `currentTime`. */
  async slowDown(): Promise<void> {
    await this.#run(async (audio) => {
      audio.preservesPitch = true;
      audio.playbackRate = 0.75;
      this.result.playbackRate = audio.playbackRate;
      this.result.preservesPitch = 'preservesPitch' in audio ? audio.preservesPitch : null;
      if (audio.ended || audio.currentTime > audio.duration - 3) audio.currentTime = 0;
      await audio.play().catch((error: unknown) => {
        this.result.playError = describeError(error);
      });
      const ct0 = audio.currentTime;
      const t0 = performance.now();
      await new Promise((resolve) => setTimeout(resolve, RATE_SAMPLE_MS));
      const wall = (performance.now() - t0) / 1000;
      this.result.measuredRate = wall > 0 ? round((audio.currentTime - ct0) / wall, 2) : null;
    });
  }

  dispose(): void {
    this.#audio?.pause();
    this.#audio?.removeAttribute('src');
    this.#audio = null;
    if (this.#blobUrl !== null) URL.revokeObjectURL(this.#blobUrl);
    this.#blobUrl = null;
  }

  async #run(action: (audio: HTMLAudioElement) => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.load();
      if (this.#audio !== null) await action(this.#audio);
    } finally {
      this.busy = false;
    }
  }
}
