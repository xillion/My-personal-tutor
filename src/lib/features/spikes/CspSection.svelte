<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import SpikeSection from './SpikeSection.svelte';
  import { getSpikes } from './spikes.svelte.js';
  import { BUTTON, BUTTON_SECONDARY } from './ui.js';

  const { csp } = getSpikes();

  $effect(() => csp.listen());
</script>

<SpikeSection id="spike-csp" title={m.spike_csp_title()} result={() => csp.report()}>
  <p>{m.spike_csp_hint()}</p>
  <p aria-live="polite" class="text-2xl font-bold" data-testid="csp-count">
    {m.spike_csp_count({ count: csp.count })}
  </p>
  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      class={BUTTON}
      onclick={() => {
        csp.runProbe();
      }}
    >
      {m.spike_csp_probe()}
    </button>
    <button
      type="button"
      class={BUTTON_SECONDARY}
      onclick={() => {
        csp.reset();
      }}
    >
      {m.spike_reset()}
    </button>
  </div>
  {#if csp.probe !== null}
    <p>
      {m.spike_csp_probe_result({
        inline: csp.probe.inlineScriptBlocked ? m.spike_blocked() : m.spike_allowed(),
        eval: csp.probe.evalBlocked ? m.spike_blocked() : m.spike_allowed(),
      })}
    </p>
  {/if}
  <ul class="text-base">
    {#each csp.last as violation, i (i)}
      <li>
        <code>{violation.directive}</code> — <code class="break-all">{violation.blockedURI}</code>
      </li>
    {/each}
  </ul>
</SpikeSection>
