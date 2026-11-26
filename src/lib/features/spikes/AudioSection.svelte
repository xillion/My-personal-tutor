<script lang="ts">
  import { errorMessage } from '#lib/ipc/client.js';
  import { m } from '#lib/paraglide/messages.js';
  import AudioProbeRow from './AudioProbeRow.svelte';
  import SpikeSection from './SpikeSection.svelte';
  import { getSpikes } from './spikes.svelte.js';
  import { BUTTON } from './ui.js';

  const { audio } = getSpikes();
</script>

<SpikeSection id="spike-audio" title={m.spike_audio_title()} result={() => audio.report()}>
  <p>{m.spike_audio_hint()}</p>
  <div>
    <button type="button" class={BUTTON} disabled={audio.preparing} onclick={() => audio.prepare()}>
      {m.spike_audio_prepare()}
    </button>
  </div>
  {#if audio.error !== null}
    <p role="alert">
      {errorMessage(audio.error.code)}
      <code class="text-base opacity-70">{audio.error.code}</code>
    </p>
  {/if}
  <div class="grid gap-3 md:grid-cols-2">
    {#each audio.probes as probe (`${probe.file.name}-${probe.source}`)}
      <AudioProbeRow {probe} />
    {/each}
  </div>
</SpikeSection>
