<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import { JITTER_DURATION_MS } from './jitter.svelte.js';
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
  <div class="flex flex-wrap gap-2">
    {#each files as file (file.name)}
      <button
        type="button"
        class={BUTTON}
        disabled={jitter.running !== null}
        onclick={() => jitter.measure(file)}
      >
        {m.spike_jitter_run({ file: file.name })}
      </button>
    {/each}
    {#if jitter.running !== null}
      <button
        type="button"
        class={BUTTON_SECONDARY}
        onclick={() => {
          jitter.cancel();
        }}
      >
        {m.spike_stop()}
      </button>
    {/if}
  </div>
  {#if jitter.running !== null}
    <p aria-live="polite">
      {m.spike_jitter_progress({
        file: jitter.running,
        seconds: Math.floor(jitter.elapsedMs / 1000),
      })}
    </p>
  {/if}
  {#each jitter.runs as run (run.file)}
    <p>
      {#if run.stats !== null}
        {m.spike_jitter_summary({
          file: run.file,
          p50: run.stats.frameError.p50 ?? '-',
          p95: run.stats.frameError.p95 ?? '-',
          max: run.stats.frameError.max ?? '-',
        })}
      {:else}
        {m.spike_jitter_failed({ file: run.file, error: run.error ?? '' })}
      {/if}
    </p>
  {/each}
</SpikeSection>
