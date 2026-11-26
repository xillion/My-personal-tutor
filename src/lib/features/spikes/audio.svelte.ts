// Раздел (1): подготовка тестового аудио и набор проверок «файл × способ загрузки».
import type { AppError } from '#lib/ipc/client.js';
import { spikePrepareMedia, type SpikeMediaDto } from '#lib/ipc/spikes.js';
import { AudioProbe, type AudioProbeResult } from './audio-probe.svelte.js';

export interface AudioReport {
  dir: string | null;
  files: { name: string; mime: string; sizeBytes: number }[];
  prepareError: AppError | null;
  probes: AudioProbeResult[];
}

export class AudioSpike {
  preparing = $state(false);
  media = $state<SpikeMediaDto | null>(null);
  error = $state<AppError | null>(null);
  probes = $state<AudioProbe[]>([]);

  async prepare(): Promise<void> {
    if (this.preparing) return;
    this.preparing = true;
    try {
      const result = await spikePrepareMedia();
      this.dispose();
      if (result.ok) {
        this.media = result.data;
        this.error = null;
        this.probes = result.data.files.flatMap((file) => [
          new AudioProbe(file, 'asset'),
          new AudioProbe(file, 'blob'),
        ]);
        await Promise.all(this.probes.map((probe) => probe.load()));
      } else {
        this.media = null;
        this.error = result.error;
      }
    } finally {
      this.preparing = false;
    }
  }

  dispose(): void {
    for (const probe of this.probes) probe.dispose();
    this.probes = [];
  }

  report(): AudioReport {
    return {
      dir: this.media?.dir ?? null,
      files: (this.media?.files ?? []).map(({ name, mime, sizeBytes }) => ({
        name,
        mime,
        sizeBytes,
      })),
      prepareError: this.error,
      probes: this.probes.map((probe) => $state.snapshot(probe.result)),
    };
  }
}
