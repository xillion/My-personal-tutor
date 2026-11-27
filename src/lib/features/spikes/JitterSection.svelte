<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import { JITTER_DURATION_MS, JITTER_SOURCES } from './jitter.svelte.js';
  import SpikeSection from './SpikeSection.svelte';
  import { getSpikes } from './spikes.svelte.js';
  import { BUTTON, BUTTON_SECONDARY } from './ui.js';

  const { audio, jitter } = getSpikes();
  const files = $derived(audio.media?.files ?? []);
</script>

<SpikeSection id="spike-jitter" title={m.spike_jitter_title()} result={() => jitter.report()}>
  <p>{m.spike_jitter_hint({ seconds: JITTER_DURATION_MS / 1000 })}</p>
  {#if files.length === 0}
    <p>{m.spike_jitter_need_media()}</p>
  {/if}
  {#each files as file (file.name)}
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class={BUTTON}
        disabled={jitter.running !== null}
        onclick={() => jitter.measureAll(file)}
      >
        {m.spike_jitter_run({ file: file.name })}
      </button>
      {#each JITTER_SOURCES as source (source)}
        <button
          type="button"
          class={BUTTON_SECONDARY}
          disabled={jitter.running !== null}
          aria-label="{file.name}: {m.spike_jitter_run_source({ source })}"
          onclick={() => jitter.measureAll(file, [source])}
        >
          {m.spike_jitter_run_source({ source })}
        </button>
      {/each}
    </div>
  {/each}
  {#if jitter.running !== null}
    <div class="flex flex-wrap items-center gap-2">
      <p aria-live="polite">
        {m.spike_jitter_progress({
          file: jitter.running.file,
          source: jitter.running.source,
          seconds: Math.floor(jitter.elapsedMs / 1000),
        })}
      </p>
      <button
        type="button"
        class={BUTTON_SECONDARY}
        onclick={() => {
          jitter.cancel();
        }}
      >
        {m.spike_stop()}
      </button>
    </div>
  {/if}
  {#each jitter.runs as run (`${run.file}:${run.source}`)}
    <p>
      {#if run.stats !== null}
        {m.spike_jitter_summary({
          file: run.file,
          source: run.source,
          p50: run.stats.frameError.p50 ?? '-',
          p95: run.stats.frameError.p95 ?? '-',
          max: run.stats.frameError.max ?? '-',
        })}
      {:else}
        {m.spike_jitter_failed({ file: run.file, source: run.source, error: run.error ?? '' })}
      {/if}
    </p>
  {/each}
</SpikeSection>
