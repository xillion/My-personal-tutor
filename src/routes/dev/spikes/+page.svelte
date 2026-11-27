<script lang="ts">
  import { SPIKES_STAND_BUILD } from '#lib/features/dev/gate.js';

  // Стенд загружается динамически и только в dev / `just build-spikes` (§4a). В обычном
  // `pnpm build` ветка мертва, а модуль стенда подменён пустым (`vite.config.ts`,
  // `stubSpikesStandInRelease`): UI стенда и `spike_*` в build/ не попадают.
  const stand = SPIKES_STAND_BUILD ? import('#lib/features/spikes/SpikesStand.svelte') : null;
</script>

{#if stand !== null}
  {#await stand then { default: SpikesStand }}
    <SpikesStand />
  {/await}
{/if}
