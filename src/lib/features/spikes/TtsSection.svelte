<script lang="ts">
  import { errorMessage } from '#lib/ipc/client.js';
  import { m } from '#lib/paraglide/messages.js';
  import SpikeSection from './SpikeSection.svelte';
  import { getSpikes } from './spikes.svelte.js';
  import { PHRASES, VOICES_SHOWN } from './tts.svelte.js';
  import { BUTTON, BUTTON_SECONDARY } from './ui.js';

  const { tts } = getSpikes();
  const last = $derived(tts.attempts.at(-1));
</script>

<SpikeSection id="spike-tts" title={m.spike_tts_title()} result={() => tts.report()}>
  <div class="flex flex-wrap items-center gap-3">
    <button
      type="button"
      class={BUTTON_SECONDARY}
      disabled={tts.loading}
      onclick={() => tts.loadVoices()}
    >
      {m.spike_tts_load_voices()}
    </button>
    {#if tts.voices !== null}
      <span>
        {m.spike_tts_backend({ backend: tts.voices.backend, total: tts.voices.totalVoices })}
      </span>
    {/if}
  </div>
  {#if tts.error !== null}
    <p role="alert">
      {errorMessage(tts.error.code)} <code class="text-base opacity-70">{tts.error.code}</code>
    </p>
  {/if}
  {#if tts.voices !== null}
    <div class="grid gap-3 md:grid-cols-2">
      {#each [{ title: m.spike_tts_voices_en( { count: tts.en.length } ), list: tts.en }, { title: m.spike_tts_voices_ru( { count: tts.ru.length } ), list: tts.ru }] as group (group.title)}
        <div>
          <p class="font-bold">{group.title}</p>
          <ul class="text-base">
            {#each group.list.slice(0, VOICES_SHOWN) as voice (voice.id)}
              <li>{voice.name} <span class="opacity-70">({voice.language})</span></li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  {/if}
  <label class="flex flex-wrap items-center gap-3">
    {m.spike_tts_rate({ rate: tts.rate })}
    <input
      type="range"
      class="min-h-touch w-64 accent-accent"
      min="0.5"
      max="2"
      step="0.25"
      bind:value={tts.rate}
    />
  </label>
  <div class="flex flex-wrap gap-2">
    <button type="button" class={BUTTON} disabled={tts.speaking} onclick={() => tts.speak('en')}>
      {m.spike_tts_say_en()}
    </button>
    <button type="button" class={BUTTON} disabled={tts.speaking} onclick={() => tts.speak('ru')}>
      {m.spike_tts_say_ru()}
    </button>
  </div>
  <p class="text-base opacity-80">
    <span lang="en">{PHRASES.en.text}</span> · <span lang="ru">{PHRASES.ru.text}</span>
  </p>
  {#if last !== undefined}
    <p aria-live="polite">
      {#if last.result !== null}
        {m.spike_tts_spoken({
          voice: last.result.voice.name,
          language: last.result.voice.language,
          rate: last.result.backendRate,
        })}
      {:else if last.error !== null}
        {errorMessage(last.error.code)} <code class="text-base opacity-70">{last.error.code}</code>
      {/if}
    </p>
  {/if}
</SpikeSection>
