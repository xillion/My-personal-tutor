// Раздел (2): джиттер `audio.currentTime`, считанного в rAF, за 10 с воспроизведения.
import { mediaSrc } from '#lib/ipc/client.js';
import type { SpikeMediaFileDto } from '#lib/ipc/spikes.js';
import { describeError, waitForEvent } from './media-events.js';
import { analyzeJitter, type FrameSample, type JitterStats } from './stats.js';

export const JITTER_DURATION_MS = 10_000;
const CANPLAY_TIMEOUT_MS = 5000;

export interface JitterRun {
  file: string;
  stats: JitterStats | null;
  error: string | null;
}

export class JitterSpike {
  running = $state<string | null>(null);
  elapsedMs = $state(0);
  runs = $state<JitterRun[]>([]);
  #cancel: (() => void) | null = null;

  /** Воспроизводит файл (через `convertFileSrc`) 10 с и считает статистику по кадрам rAF. */
  async measure(file: SpikeMediaFileDto): Promise<void> {
    if (this.running !== null) return;
    this.running = file.name;
    this.elapsedMs = 0;
    const audio = new Audio(mediaSrc(file.path));
    let run: JitterRun;
    try {
      if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        const ready = await waitForEvent(audio, 'canplay', CANPLAY_TIMEOUT_MS);
        if (!ready) throw new Error(`canplay timeout, error code ${audio.error?.code ?? '-'}`);
      }
      await audio.play();
      const samples = await this.#sample(audio);
      run = { file: file.name, stats: analyzeJitter(samples, audio.playbackRate), error: null };
    } catch (error: unknown) {
      run = { file: file.name, stats: null, error: describeError(error) };
    } finally {
      audio.pause();
      audio.removeAttribute('src');
      this.running = null;
      this.#cancel = null;
    }
    this.runs = [...this.runs.filter((r) => r.file !== file.name), run];
  }

  cancel(): void {
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
