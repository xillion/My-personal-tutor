import { describe, expect, it } from 'vitest';
import { analyzeJitter, percentile, summarize, type FrameSample } from './stats.js';

describe('percentile', () => {
  it('returns null for an empty series', () => {
    expect(percentile([], 50)).toBeNull();
  });

  it('uses the nearest-rank method', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(95);
    expect(percentile(sorted, 100)).toBe(100);
    expect(percentile([7], 95)).toBe(7);
  });
});

describe('summarize', () => {
  it('sorts the input and reports p50/p95/max', () => {
    expect(summarize([5, 1, 4, 2, 3])).toEqual({ count: 5, p50: 3, p95: 5, max: 5 });
  });

  it('reports nulls for no data', () => {
    expect(summarize([])).toEqual({ count: 0, p50: null, p95: null, max: null });
  });
});

function frames(count: number, frameMs: number, ct: (i: number) => number): FrameSample[] {
  return Array.from({ length: count }, (_, i) => ({ now: i * frameMs, currentTime: ct(i) }));
}

describe('analyzeJitter', () => {
  it('reports zero error for a perfectly smooth clock', () => {
    const stats = analyzeJitter(frames(61, 16, (i) => (i * 16) / 1000));
    expect(stats.frames).toBe(61);
    expect(stats.frameError).toEqual({ count: 60, p50: 0, p95: 0, max: 0 });
    expect(stats.updateInterval.p50).toBe(16);
    expect(stats.staleRatio).toBe(0);
    expect(stats.drift).toBe(0);
  });

  it('detects coarse currentTime updates', () => {
    // Позиция обновляется каждые 4 кадра (64 мс): 3 кадра из 4 «застывшие».
    const stats = analyzeJitter(frames(81, 16, (i) => (Math.floor(i / 4) * 64) / 1000));
    expect(stats.updateInterval.p50).toBe(64);
    expect(stats.staleRatio).toBe(0.75);
    expect(stats.frameError.max).toBe(48);
    expect(stats.frameError.p50).toBe(16);
  });

  it('scales currentTime by the playback rate', () => {
    const stats = analyzeJitter(
      frames(11, 20, (i) => (i * 20 * 0.75) / 1000),
      0.75,
    );
    expect(stats.frameError.max).toBeCloseTo(0, 5);
  });

  it('skips frames where the position jumps back', () => {
    const stats = analyzeJitter([
      { now: 0, currentTime: 1 },
      { now: 16, currentTime: 1.016 },
      { now: 32, currentTime: 0 },
      { now: 48, currentTime: 0.016 },
    ]);
    expect(stats.frameError.count).toBe(2);
    expect(stats.frameError.max).toBeCloseTo(0, 5);
  });

  it('handles fewer than two samples', () => {
    expect(analyzeJitter([]).drift).toBeNull();
    expect(analyzeJitter([{ now: 0, currentTime: 0 }]).frameError.count).toBe(0);
  });
});
