// Раздел (2): джиттер `audio.currentTime`, считанного в rAF, за 10 с воспроизведения.
// Источник выбирается на каждый файл: `asset` (`convertFileSrc`) или `blob` (байты из
// `spike_media_bytes` → Blob URL, как в аудио-пробе). Ошибка одного источника не мешает другому.
import { mediaSrc } from '#lib/ipc/client.js';
import { spikeMediaBytes, type SpikeMediaFileDto } from '#lib/ipc/spikes.js';
import type { AudioSourceKind } from './audio-probe.svelte.js';
import { describeError, waitForEvent } from './media-events.js';
import { analyzeJitter, type FrameSample, type JitterStats } from './stats.js';

export const JITTER_DURATION_MS = 10_000;
export const JITTER_SOURCES: readonly AudioSourceKind[] = ['asset', 'blob'];
const CANPLAY_TIMEOUT_MS = 5000;

export interface JitterRun {
  file: string;
  source: AudioSourceKind;
  stats: JitterStats | null;
  error: string | null;
}

export interface JitterTarget {
  file: string;
  source: AudioSourceKind;
}

export class JitterSpike {
  running = $state<JitterTarget | null>(null);
  elapsedMs = $state(0);
  runs = $state<JitterRun[]>([]);
  #cancel: (() => void) | null = null;
  /** Увеличивается при `cancel()`: оставшиеся источники `measureAll` не запускаются. */
  #generation = 0;

  /** Измеряет файл по очереди из каждого источника (по умолчанию — оба). */
  async measureAll(
    file: SpikeMediaFileDto,
    sources: readonly AudioSourceKind[] = JITTER_SOURCES,
  ): Promise<void> {
    if (this.running !== null) return;
    const generation = this.#generation;
    for (const source of sources) {
      if (generation !== this.#generation) break;
      await this.measure(file, source);
    }
  }

  /** Воспроизводит файл из `source` 10 с и считает статистику по кадрам rAF. */
  async measure(file: SpikeMediaFileDto, source: AudioSourceKind): Promise<void> {
    if (this.running !== null) return;
    this.running = { file: file.name, source };
    this.elapsedMs = 0;
    const audio = new Audio();
    let blobUrl: string | null = null;
    let run: JitterRun;
    try {
      let url = mediaSrc(file.path);
      if (source === 'blob') {
        const bytes = await spikeMediaBytes(file.name);
        if (!bytes.ok) throw new Error(`${bytes.error.code}: ${bytes.error.message}`);
        blobUrl = URL.createObjectURL(new Blob([bytes.data], { type: file.mime }));
        url = blobUrl;
      }
      audio.preload = 'auto';
      audio.src = url;
      if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        const ready = await waitForEvent(audio, 'canplay', CANPLAY_TIMEOUT_MS);
        if (!ready) throw new Error(`canplay timeout, error code ${audio.error?.code ?? '-'}`);
      }
      await audio.play();
      const samples = await this.#sample(audio);
      run = {
        file: file.name,
        source,
        stats: analyzeJitter(samples, audio.playbackRate),
        error: null,
      };
    } catch (error: unknown) {
      run = { file: file.name, source, stats: null, error: describeError(error) };
    } finally {
      audio.pause();
      audio.removeAttribute('src');
      if (blobUrl !== null) URL.revokeObjectURL(blobUrl);
      this.running = null;
      this.#cancel = null;
    }
    this.runs = [...this.runs.filter((r) => r.file !== file.name || r.source !== source), run];
  }

  /** Останавливает текущее измерение и не запускает следующие источники `measureAll`. */
  cancel(): void {
    this.#generation += 1;
    this.#cancel?.();
  }

  #sample(audio: HTMLAudioElement): Promise<FrameSample[]> {
    return new Promise((resolve) => {
      const samples: FrameSample[] = [];
      let frame = 0;
      const finish = (): void => {
        cancelAnimationFrame(frame);
        resolve(samples);
      };
      this.#cancel = finish;
      const tick = (now: number): void => {
        samples.push({ now, currentTime: audio.currentTime });
        const start = samples[0]?.now ?? now;
        this.elapsedMs = now - start;
        if (now - start >= JITTER_DURATION_MS || audio.ended) finish();
        else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
  }

  report(): JitterRun[] {
    return $state.snapshot(this.runs);
  }
}
