import { error } from '@sveltejs/kit';
import { spikesPageEnabled } from '#lib/features/dev/gate.js';

// Стенд спайков T-004.1: `vite dev` или сборка `just build-spikes`; иначе 404 (§4a).
export function load(): void {
  if (!spikesPageEnabled()) error(404, 'Not Found');
}
