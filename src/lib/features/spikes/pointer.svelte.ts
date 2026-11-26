// Раздел (4): характеристики PointerEvent (мышь, тач, перо/планшет).

/** Диапазон значений; `null` — значений не было. */
export interface Range {
  min: number | null;
  max: number | null;
}

/** Статистика по одному `pointerType`. */
export interface PointerTypeStats {
  pointerType: string;
  downs: number;
  moves: number;
  /** Сумма `getCoalescedEvents().length` по всем `pointermove`. */
  coalescedTotal: number;
  /** Максимум coalesced-событий в одном `pointermove`. */
  coalescedMax: number;
  pressure: Range;
  tiltX: Range;
  tiltY: Range;
  twist: Range;
  /** Были ли `buttons` с ластиком (5-я кнопка, бит 32) — признак обратного конца пера. */
  eraser: boolean;
}

export function widen(range: Range, value: number): Range {
  return {
    min: range.min === null ? value : Math.min(range.min, value),
    max: range.max === null ? value : Math.max(range.max, value),
  };
}

function emptyStats(pointerType: string): PointerTypeStats {
  const range = (): Range => ({ min: null, max: null });
  return {
    pointerType,
    downs: 0,
    moves: 0,
    coalescedTotal: 0,
    coalescedMax: 0,
    pressure: range(),
    tiltX: range(),
    tiltY: range(),
    twist: range(),
    eraser: false,
  };
}

const ERASER_BUTTON = 32;

export class PointerSpike {
  byType = $state<Record<string, PointerTypeStats>>({});
  readonly coalescedApi =
    typeof PointerEvent !== 'undefined' && 'getCoalescedEvents' in PointerEvent.prototype;
  readonly predictedApi =
    typeof PointerEvent !== 'undefined' && 'getPredictedEvents' in PointerEvent.prototype;

  /** Обрабатывает `pointerdown`/`pointermove`; возвращает точки (с coalesced) для отрисовки. */
  record(event: PointerEvent): PointerEvent[] {
    const stats = this.byType[event.pointerType] ?? emptyStats(event.pointerType);
    const points =
      event.type === 'pointermove' ? (this.coalescedApi ? event.getCoalescedEvents() : []) : [];
    const all = points.length > 0 ? points : [event];
    if (event.type === 'pointerdown') stats.downs++;
    else {
      stats.moves++;
      stats.coalescedTotal += points.length;
      stats.coalescedMax = Math.max(stats.coalescedMax, points.length);
    }
    for (const point of all) {
      stats.pressure = widen(stats.pressure, point.pressure);
      stats.tiltX = widen(stats.tiltX, point.tiltX);
      stats.tiltY = widen(stats.tiltY, point.tiltY);
      stats.twist = widen(stats.twist, point.twist);
    }
    if ((event.buttons & ERASER_BUTTON) !== 0) stats.eraser = true;
    this.byType[event.pointerType] = stats;
    return all;
  }

  reset(): void {
    this.byType = {};
  }

  report(): object {
    return {
      coalescedApi: this.coalescedApi,
      predictedApi: this.predictedApi,
      maxTouchPoints: navigator.maxTouchPoints,
      types: Object.values($state.snapshot(this.byType)),
    };
  }
}
