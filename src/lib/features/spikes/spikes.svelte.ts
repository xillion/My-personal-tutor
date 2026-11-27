// Состояние стенда `/dev/spikes` (T-004.1): шесть разделов и общий JSON-отчёт.
import { createContext } from 'svelte';
import { AudioSpike } from './audio.svelte.js';
import { CspSpike } from './csp.svelte.js';
import { JitterSpike } from './jitter.svelte.js';
import { KatexSpike } from './katex.svelte.js';
import { PointerSpike } from './pointer.svelte.js';
import { redactReport } from './redact.js';
import { TtsSpike } from './tts.svelte.js';

export type CopyStatus = 'idle' | 'copied' | 'manual';

export class SpikesState {
  readonly audio = new AudioSpike();
  readonly jitter = new JitterSpike();
  readonly tts = new TtsSpike();
  readonly pointer = new PointerSpike();
  readonly katex = new KatexSpike();
  readonly csp = new CspSpike();
  copyStatus = $state<CopyStatus>('idle');
  /** JSON для ручного копирования, если буфер обмена недоступен. */
  manualJson = $state<string | null>(null);

  /** Все строки обезличены (`redact.ts`): разделы делают это сами, здесь — страховка. */
  report(): object {
    return redactReport({
      task: 'T-004.1',
      // eslint-disable-next-line svelte/prefer-svelte-reactivity -- момент снимка, не реактивное значение
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      build: {
        dev: import.meta.env.DEV,
        mode: import.meta.env.MODE,
        spikesFlag: import.meta.env.VITE_MPT_SPIKES ?? null,
      },
      screen: {
        devicePixelRatio: window.devicePixelRatio,
        width: screen.width,
        height: screen.height,
      },
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      audio: this.audio.report(),
      jitter: this.jitter.report(),
      tts: this.tts.report(),
      pointer: this.pointer.report(),
      katex: this.katex.report(),
      csp: this.csp.report(),
    }) as object;
  }

  json(): string {
    return JSON.stringify(this.report(), null, 2);
  }

  async copy(): Promise<void> {
    const json = this.json();
    try {
      if (typeof navigator.clipboard === 'undefined') throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(json);
      this.copyStatus = 'copied';
      this.manualJson = null;
    } catch {
      this.copyStatus = 'manual';
      this.manualJson = json;
    }
  }

  dispose(): void {
    this.audio.dispose();
    this.jitter.cancel();
  }
}

export const [getSpikes, setSpikes] = createContext<SpikesState>();
