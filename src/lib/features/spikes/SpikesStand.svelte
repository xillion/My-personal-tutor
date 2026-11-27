<!-- Стенд спайков T-004.1 (/dev/spikes). Загружается динамически только при spikesPageEnabled(). -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '#lib/paraglide/messages.js';
  import AudioSection from './AudioSection.svelte';
  import CspSection from './CspSection.svelte';
  import JitterSection from './JitterSection.svelte';
  import KatexSection from './KatexSection.svelte';
  import PointerSection from './PointerSection.svelte';
  import { setSpikes, SpikesState } from './spikes.svelte.js';
  import TtsSection from './TtsSection.svelte';
  import { BUTTON } from './ui.js';

  const spikes = setSpikes(new SpikesState());

  // onMount, а не $effect: методы читают собственный $state, эффект подписался бы на него.
  onMount(() => {
    void spikes.audio.prepare();
    void spikes.tts.loadVoices();
    return () => {
      spikes.dispose();
    };
  });
</script>

<main class="mx-auto flex max-w-5xl flex-col gap-6 p-6 text-body text-ink">
  <header class="flex flex-wrap items-center justify-between gap-3">
    <h1 class="text-3xl font-bold">{m.spike_title()}</h1>
    <div class="flex items-center gap-3">
      <span aria-live="polite">
        {#if spikes.copyStatus === 'copied'}{m.spike_copied()}{/if}
        {#if spikes.copyStatus === 'manual'}{m.spike_copy_manual()}{/if}
      </span>
      <button type="button" class={BUTTON} onclick={() => spikes.copy()}>
        {m.spike_copy_json()}
      </button>
    </div>
  </header>
  {#if spikes.manualJson !== null}
    <label class="flex flex-col gap-1">
      {m.spike_json_label()}
      <textarea
        readonly
        class="h-64 rounded-xl border-2 border-ink/30 p-3 font-mono text-sm"
        value={spikes.manualJson}></textarea>
    </label>
  {/if}
  <AudioSection />
  <JitterSection />
  <TtsSection />
  <PointerSection />
  <KatexSection />
  <CspSection />
</main>
