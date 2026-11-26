<script lang="ts">
  import 'katex/dist/katex.min.css';
  import { untrack } from 'svelte';
  import { renderMath } from '#lib/features/reader/katex-trust.js';
  import { m } from '#lib/paraglide/messages.js';
  import { FORBIDDEN, FORMULA } from './katex.svelte.js';
  import SpikeSection from './SpikeSection.svelte';
  import { getSpikes } from './spikes.svelte.js';

  const { katex } = getSpikes();

  function formula(host: HTMLElement): void {
    renderMath(host, FORMULA, true);
    // Части формулы доступны с клавиатуры: Tab + Enter/пробел.
    for (const part of host.querySelectorAll<HTMLElement>('[data-t]')) {
      part.tabIndex = 0;
      part.setAttribute('role', 'button');
      part.setAttribute('aria-label', m.spike_katex_part({ t: part.dataset['t'] ?? '' }));
    }
    // Attachment выполняется в эффекте: запись состояния — без подписки на него.
    untrack(() => {
      katex.inspectFormula(host);
      void katex.checkFonts();
    });
  }

  function forbidden(tex: string) {
    return (host: HTMLElement): void => {
      renderMath(host, tex);
      untrack(() => {
        katex.inspectForbidden(host, tex);
      });
    };
  }

  function onkeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      katex.pick(event.target);
    }
  }
</script>

<SpikeSection id="spike-katex" title={m.spike_katex_title()} result={() => katex.report()}>
  <p>{m.spike_katex_hint()}</p>
  <!-- Делегирование: интерактивны части формулы (role=button, tabindex, Enter), не контейнер. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="text-3xl [&_[data-t]]:cursor-pointer [&_[data-t]]:rounded [&_[data-t]:focus-visible]:outline-4 [&_[data-t]:focus-visible]:outline-accent [&_[data-t]:hover]:bg-accent/15"
    onclick={(event) => {
      katex.pick(event.target);
    }}
    {onkeydown}
    {@attach formula}
  ></div>
  <p aria-live="polite" data-testid="katex-clicked">
    {katex.clicked === null ? m.spike_katex_none() : m.spike_katex_clicked({ t: katex.clicked })}
  </p>
  <p class="font-bold">{m.spike_katex_forbidden()}</p>
  <ul class="flex flex-wrap gap-4">
    {#each FORBIDDEN as tex (tex)}
      <li {@attach forbidden(tex)}></li>
    {/each}
  </ul>
</SpikeSection>
