// Раздел (5): KaTeX с политикой `katexTrust` (только `\htmlData`) и клики по частям формулы.

/** Формула с частями, помеченными `data-t`, как в уроках (T-302). */
export const FORMULA =
  '\\htmlData{t=t1}{x^2} + \\htmlData{t=t2}{\\frac{1}{2}} = \\htmlData{t=t3}{\\sqrt{y}}';

/** Запрещённые команды: каждая должна отрисоваться как неподдерживаемая. */
export const FORBIDDEN = [
  '\\href{https://example.com}{a}',
  '\\url{https://example.com}',
  '\\includegraphics{x.png}',
  '\\htmlStyle{color: red}{b}',
  '\\htmlClass{evil}{c}',
  '\\htmlId{evil}{d}',
];

export class KatexSpike {
  clicked = $state<string | null>(null);
  clicks = $state(0);
  dataParts = $state(0);
  /** Сколько запрещённых формул дали ссылку, картинку, style/class/id (ожидается 0). */
  leaked = $state<string[]>([]);
  fontsLoaded = $state<boolean | null>(null);

  /** Клик/Enter по формуле: ближайший предок с `data-t`. */
  pick(target: EventTarget | null): void {
    if (!(target instanceof Element)) return;
    const part = target.closest('[data-t]');
    if (part === null) return;
    this.clicked = part.getAttribute('data-t');
    this.clicks++;
  }

  inspectFormula(host: HTMLElement): void {
    this.dataParts = host.querySelectorAll('[data-t]').length;
  }

  inspectForbidden(host: HTMLElement, tex: string): void {
    const leak = host.querySelector('a, img, [href], [src], .evil, #evil, [style*="color: red"]');
    if (leak !== null && !this.leaked.includes(tex)) this.leaked = [...this.leaked, tex];
  }

  /** Загружены ли шрифты KaTeX (локальные, CSP `font-src 'self' data:`). */
  async checkFonts(): Promise<void> {
    try {
      await document.fonts.load('1em KaTeX_Main');
      this.fontsLoaded = document.fonts.check('1em KaTeX_Main');
    } catch {
      this.fontsLoaded = false;
    }
  }

  report(): object {
    return {
      dataParts: this.dataParts,
      clicks: this.clicks,
      lastDataT: this.clicked,
      forbiddenChecked: FORBIDDEN.length,
      leaked: $state.snapshot(this.leaked),
      fontsLoaded: this.fontsLoaded,
    };
  }
}
