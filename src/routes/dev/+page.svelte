<script lang="ts">
  import { DevState, formatBuiltAt } from '#lib/features/dev/dev-state.svelte.js';
  import { errorMessage } from '#lib/ipc/client.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  const dev = new DevState();
  void dev.loadInfo();

  const button =
    'min-h-touch rounded-xl bg-accent px-5 text-body font-bold text-white focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60';

  function onsubmit(event: SubmitEvent): void {
    event.preventDefault();
    void dev.sendPing();
  }
</script>

{#if import.meta.env.DEV}
  <main class="mx-auto flex max-w-3xl flex-col gap-8 p-6 text-body text-ink">
    <h1 class="text-3xl font-bold">{m.dev_title()}</h1>

    <section aria-labelledby="dev-ping-title" class="flex flex-col gap-3">
      <h2 id="dev-ping-title" class="text-2xl font-bold">{m.dev_ping_title()}</h2>
      <form class="flex flex-wrap items-end gap-3" {onsubmit}>
        <label class="flex flex-col gap-1">
          {m.dev_ping_label()}
          <input
            class="min-h-touch rounded-xl border-2 border-ink/30 bg-white px-3 focus-visible:outline-4 focus-visible:outline-accent"
            bind:value={dev.message}
          />
        </label>
        <button type="submit" class={button} disabled={dev.pinging}>{m.dev_ping_button()}</button>
      </form>
      <p aria-live="polite" data-testid="ping-output">
        {#if dev.ping?.ok === true}
          {m.dev_ping_reply({ reply: dev.ping.data })}
        {:else if dev.ping?.ok === false}
          {errorMessage(dev.ping.error.code)}
          <code class="text-base opacity-70">
            {m.dev_error_code({ code: dev.ping.error.code })}
          </code>
        {/if}
      </p>
    </section>

    <section aria-labelledby="dev-info-title" class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <h2 id="dev-info-title" class="text-2xl font-bold">{m.dev_info_title()}</h2>
        <button
          type="button"
          class={button}
          disabled={dev.loadingInfo}
          onclick={() => dev.loadInfo()}
        >
          {m.dev_info_reload()}
        </button>
      </div>
      {#if dev.info === null}
        <p>{m.dev_loading()}</p>
      {:else if dev.info.ok}
        {@const info = dev.info.data}
        <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
          <dt class="font-bold">{m.dev_info_version()}</dt>
          <dd>{info.version}</dd>
          <dt class="font-bold">{m.dev_info_platform()}</dt>
          <dd>{info.os} / {info.arch}</dd>
          <dt class="font-bold">{m.dev_info_data_dir()}</dt>
          <dd class="break-all"><code>{info.dataDir}</code></dd>
          <dt class="font-bold">{m.dev_info_courses_dir()}</dt>
          <dd class="break-all"><code>{info.coursesDir}</code></dd>
          <dt class="font-bold">{m.dev_info_built_at()}</dt>
          <dd>
            <time datetime={new Date(info.builtAtMs).toISOString()}>
              {formatBuiltAt(info.builtAtMs, getLocale())}
            </time>
          </dd>
        </dl>
      {:else}
        <p role="alert">
          {errorMessage(dev.info.error.code)}
          <code class="text-base opacity-70">
            {m.dev_error_code({ code: dev.info.error.code })}
          </code>
        </p>
      {/if}
    </section>
  </main>
{/if}
