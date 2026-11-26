<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    id,
    title,
    result,
    children,
  }: { id: string; title: string; result: () => object; children: Snippet } = $props();
</script>

<section aria-labelledby="{id}-title" class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow">
  <h2 id="{id}-title" class="text-2xl font-bold">{title}</h2>
  {@render children()}
  <pre
    class="max-h-72 overflow-auto rounded-xl bg-surface p-3 text-sm"
    data-testid="{id}-result">{JSON.stringify(result(), null, 2)}</pre>
</section>
