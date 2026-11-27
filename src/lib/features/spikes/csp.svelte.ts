// Раздел (6): нарушения CSP (`securitypolicyviolation`). В `tauri dev` CSP не применяется
// (§4a) — счётчик осмыслен в сборке `just build-spikes`. Нарушения до открытия страницы не видны.
import { redactReport } from './redact.js';

export interface CspViolation {
  directive: string;
  blockedURI: string;
  sourceFile: string;
  disposition: string;
}

export interface CspProbeResult {
  /** Вставленный inline `<script>` не выполнился. */
  inlineScriptBlocked: boolean;
  /** `new Function` бросил `EvalError` (нет `'unsafe-eval'`). */
  evalBlocked: boolean;
}

const KEEP_LAST = 5;

export class CspSpike {
  count = $state(0);
  last = $state<CspViolation[]>([]);
  probe = $state<CspProbeResult | null>(null);

  /** Подписывается на нарушения; возвращает отписку (для `$effect`). */
  listen(target: Document = document): () => void {
    const onViolation = (event: SecurityPolicyViolationEvent): void => {
      this.count++;
      const violation: CspViolation = {
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
        sourceFile: event.sourceFile,
        disposition: event.disposition,
      };
      this.last = [...this.last, violation].slice(-KEEP_LAST);
    };
    target.addEventListener('securitypolicyviolation', onViolation);
    return () => {
      target.removeEventListener('securitypolicyviolation', onViolation);
    };
  }

  /**
   * Пробует то, что CSP обязана запретить: inline-скрипт и `eval`. Без сети. Без CSP (dev)
   * оба выполнятся безвредно — это и будет результатом «не заблокировано».
   */
  runProbe(): void {
    const root = document.documentElement;
    delete root.dataset['mptCspProbe'];
    const script = document.createElement('script');
    script.textContent = "document.documentElement.dataset.mptCspProbe = 'ran';";
    document.head.append(script);
    script.remove();
    const inlineScriptBlocked = root.dataset['mptCspProbe'] !== 'ran';
    delete root.dataset['mptCspProbe'];

    let evalBlocked = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval -- проверяем, что CSP запрещает eval
      const probe = new Function('return 1') as () => unknown;
      probe();
    } catch {
      evalBlocked = true;
    }
    this.probe = { inlineScriptBlocked, evalBlocked };
  }

  reset(): void {
    this.count = 0;
    this.last = [];
  }

  /** `blockedURI`/`sourceFile` обезличены (`redact.ts`). */
  report(): object {
    return redactReport({
      count: this.count,
      last: $state.snapshot(this.last),
      probe: $state.snapshot(this.probe),
    }) as object;
  }
}
