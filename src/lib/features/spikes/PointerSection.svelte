<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import SpikeSection from './SpikeSection.svelte';
  import { getSpikes } from './spikes.svelte.js';
  import { BUTTON_SECONDARY } from './ui.js';

  const { pointer } = getSpikes();
  let canvas: HTMLCanvasElement | undefined = $state();
  let lastPoint: { x: number; y: number } | null = null;

  // Отрисовка — только обратная связь для человека; цифры собирает PointerSpike.
  function draw(points: PointerEvent[]): void {
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = '#2b5fb8';
    ctx.lineCap = 'round';
    for (const point of points) {
      const x = ((point.clientX - rect.left) * canvas.width) / rect.width;
      const y = ((point.clientY - rect.top) * canvas.height) / rect.height;
      if (lastPoint !== null) {
        ctx.lineWidth = 1 + 8 * (point.pressure || 0.5);
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      lastPoint = { x, y };
    }
  }

  function onpointerdown(event: PointerEvent): void {
    canvas?.setPointerCapture(event.pointerId);
    lastPoint = null;
    draw(pointer.record(event));
  }

  function onpointermove(event: PointerEvent): void {
    const points = pointer.record(event);
    if (event.buttons !== 0) draw(points);
    else lastPoint = null;
  }

  function reset(): void {
    pointer.reset();
    lastPoint = null;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }
</script>

<SpikeSection id="spike-pointer" title={m.spike_pointer_title()} result={() => pointer.report()}>
  <p>{m.spike_pointer_hint()}</p>
  <canvas
    bind:this={canvas}
    width="800"
    height="300"
    class="h-64 w-full touch-none rounded-xl border-2 border-dashed border-ink/30 bg-surface"
    aria-label={m.spike_pointer_area()}
    {onpointerdown}
    {onpointermove}
    onpointerup={() => (lastPoint = null)}
  ></canvas>
  <ul class="text-base" aria-live="polite">
    {#each Object.values(pointer.byType) as stats (stats.pointerType)}
      <li>
        {m.spike_pointer_summary({
          type: stats.pointerType,
          moves: stats.moves,
          coalesced: stats.coalescedTotal,
          min: stats.pressure.min ?? '-',
          max: stats.pressure.max ?? '-',
        })}
      </li>
    {/each}
  </ul>
  <div>
    <button type="button" class={BUTTON_SECONDARY} onclick={reset}>{m.spike_reset()}</button>
  </div>
</SpikeSection>
