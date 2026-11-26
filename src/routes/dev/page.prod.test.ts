// QA T-002: в production-сборке маршрут `/dev` недоступен (docs/01_ARCHITECTURE.md §4a).
import { isHttpError } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('/dev page in production', () => {
  it('responds with 404 when import.meta.env.DEV is false', () => {
    vi.stubEnv('DEV', false);
    let thrown: unknown;
    try {
      load();
    } catch (err: unknown) {
      thrown = err;
    }
    expect(isHttpError(thrown, 404)).toBe(true);
  });
});
