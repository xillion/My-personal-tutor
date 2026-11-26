<script lang="ts">
  import type { Snippet } from 'svelte';
  import '../app.css';
  import { syncDocumentLocale } from '#lib/i18n/locale.js';
  import { m } from '#lib/paraglide/messages.js';

  let { children }: { children: Snippet } = $props();

  // SPA (ssr = false): код выполняется только в WebView, <html> уже существует.
  syncDocumentLocale();
</script>

<svelte:head>
  <title>{m.app_title()}</title>
</svelte:head>

{@render children()}
