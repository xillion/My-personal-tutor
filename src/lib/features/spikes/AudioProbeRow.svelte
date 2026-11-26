<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import type { AudioProbe } from './audio-probe.svelte.js';
  import { BUTTON_SECONDARY } from './ui.js';

  let { probe }: { probe: AudioProbe } = $props();

  const r = $derived(probe.result);
  const label = $derived(
    `${r.file} · ${r.source === 'asset' ? m.spike_audio_source_asset() : m.spike_audio_source_blob()}`,
  );
</script>

<div
  class="flex flex-col gap-2 rounded-xl border-2 border-ink/10 p-3"
  role="group"
  aria-label={label}
>
  <p class="font-bold">{label}</p>
  <p class="text-base" aria-live="polite">
    {#if r.fetchError !== null}
      {m.spike_audio_fetch_failed({ error: r.fetchError })}
    {:else if r.mediaError !== null}
      {m.spike_audio_media_error({ code: r.mediaError.code })}
    {:else if r.canplayMs === null}
      {m.spike_loading()}
    {:else}
      {m.spike_audio_ready({ duration: r.duration ?? '?', ms: r.canplayMs })}
    {/if}
  </p>
  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      class={BUTTON_SECONDARY}
      disabled={probe.busy}
      onclick={() => probe.play()}
    >
      {m.spike_audio_play()}
    </button>
    <button
      type="button"
      class={BUTTON_SECONDARY}
      onclick={() => {
        probe.pause();
      }}
    >
      {m.spike_audio_pause()}
    </button>
    <button
      type="button"
      class={BUTTON_SECONDARY}
      disabled={probe.busy}
      onclick={() => probe.seekHalf()}
    >
      {m.spike_audio_seek_half()}
    </button>
    <button
      type="button"
      class={BUTTON_SECONDARY}
      disabled={probe.busy}
      onclick={() => probe.seekEndAndWait()}
    >
      {m.spike_audio_seek_end()}
    </button>
    <button
      type="button"
      class={BUTTON_SECONDARY}
      disabled={probe.busy}
      onclick={() => probe.slowDown()}
    >
      {m.spike_audio_slow()}
    </button>
  </div>
</div>
