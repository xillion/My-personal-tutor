// Чистые расчёты для стенда спайков (T-004.1): перцентили и джиттер `currentTime`.

/** Сводка ряда, мс. Для пустого ряда все значения `null`. */
export interface Summary {
  count: number;
  p50: number | null;
  p95: number | null;
  max: number | null;
}

/**
 * Перцентиль методом ближайшего ранга: наименьшее значение, не меньше которого `p` % выборки
 * (`sorted[ceil(p/100 · n) − 1]`). Массив должен быть отсортирован по возрастанию.
 */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1] ?? null;
}

/** p50/p95/max ряда; значения округляются до 0,01. */
export function summarize(values: readonly number[]): Summary {
  const sorted = [...values].sort((a, b) => a - b);
  const round = (v: number | null): number | null =>
    v === null ? null : Math.round(v * 100) / 100;
  return {
    count: sorted.length,
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    max: round(sorted.at(-1) ?? null),
  };
}

/** Один кадр rAF во время воспроизведения. */
export interface FrameSample {
  /** `performance.now()` (или timestamp rAF), мс. */
  now: number;
  /** `audio.currentTime`, с. */
  currentTime: number;
}

/** Результат анализа джиттера. */
export interface JitterStats {
  frames: number;
  /** Ошибка шага по кадрам, мс: `|Δct·1000/rate − Δnow|`. */
  frameError: Summary;
  /** Интервал между изменениями `currentTime`, мс (как часто медиа обновляет позицию). */
  updateInterval: Summary;
  /** Доля кадров, в которых `currentTime` не изменился. */
  staleRatio: number | null;
  /** Итоговый дрейф позиции относительно часов страницы, мс: `(ctN−ct0)·1000/rate − (nowN−now0)`. */
  drift: number | null;
}

/**
 * Джиттер `currentTime` относительно часов страницы.
 *
 * Для соседних кадров i−1, i: ожидаемый шаг позиции — `Δnow = now_i − now_{i−1}` мс реального
 * времени; фактический — `Δct = (ct_i − ct_{i−1}) · 1000 / rate` мс (приведено к реальному
 * времени делением на скорость). Ошибка кадра `e_i = |Δct − Δnow|`. Если WebView обновляет
 * `currentTime` редко (например, раз в 250 мс), в большинстве кадров Δct = 0 и ошибка ≈ Δnow,
 * а в кадре обновления — скачок; для караоке важны p95 и max. Кадры, где позиция пошла назад
 * (seek, перезапуск), исключаются.
 */
export function analyzeJitter(samples: readonly FrameSample[], rate = 1): JitterStats {
  const errors: number[] = [];
  const intervals: number[] = [];
  let stale = 0;
  let lastChange: number | null = samples[0]?.now ?? null;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const cur = samples[i];
    if (prev === undefined || cur === undefined) continue;
    const dCt = cur.currentTime - prev.currentTime;
    if (dCt < 0) {
      lastChange = cur.now;
      continue;
    }
    const dNow = cur.now - prev.now;
    errors.push(Math.abs((dCt * 1000) / rate - dNow));
    if (dCt === 0) stale++;
    else {
      if (lastChange !== null) intervals.push(cur.now - lastChange);
      lastChange = cur.now;
    }
  }
  const first = samples[0];
  const last = samples.at(-1);
  const drift =
    first !== undefined && last !== undefined && samples.length > 1
      ? Math.round(
          (((last.currentTime - first.currentTime) * 1000) / rate - (last.now - first.now)) * 100,
        ) / 100
      : null;
  return {
    frames: samples.length,
    frameError: summarize(errors),
    updateInterval: summarize(intervals),
    staleRatio: errors.length === 0 ? null : Math.round((stale / errors.length) * 1000) / 1000,
    drift,
  };
}
