<script lang="ts">
  import { resolve } from '$app/paths';
  import { devPageEnabled, spikesPageEnabled } from '#lib/features/dev/gate.js';
  import { m } from '#lib/paraglide/messages.js';

  const link =
    'inline-flex min-h-touch items-center rounded-xl px-4 text-accent underline focus-visible:outline-4 focus-visible:outline-accent';
</script>

<main class="grid min-h-screen place-items-center p-6">
  <h1 class="text-center font-reading text-4xl font-bold text-ink">{m.app_title()}</h1>
  {#if spikesPageEnabled()}
    <!-- Только dev и `just build-spikes` (§4a): в релизе ссылок нет. -->
    <nav class="flex gap-3" aria-label={m.home_dev_link()}>
      {#if devPageEnabled()}<a class={link} href={resolve('/dev')}>{m.home_dev_link()}</a>{/if}
      <a class={link} href={resolve('/dev/spikes')}>{m.home_spikes_link()}</a>
    </nav>
  {/if}
</main>
