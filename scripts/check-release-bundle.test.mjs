// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findMarkers } from './check-release-bundle.mjs';

describe('findMarkers', () => {
  it('reports spike command names and the stand component', () => {
    expect(findMarkers('invoke("spike_tts_speak")')).toEqual(['spike_']);
    expect(findMarkers('import("./SpikesStand.js")')).toEqual(['SpikesStand']);
  });

  it('accepts release code without stand markers', () => {
    expect(findMarkers('invoke("app_ping"); const spikesPageEnabled = !1;')).toEqual([]);
  });
});
