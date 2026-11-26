// Состояние dev-страницы `/dev` (T-002): проверка связи `app_ping` и сведения `app_info`.
import { call, commands, type AppInfoDto, type Result } from '#lib/ipc/client.js';

export class DevState {
  message = $state('ping');
  pinging = $state(false);
  /** Последний ответ `app_ping`; `null` — ещё не отправляли. */
  ping = $state<Result<string> | null>(null);
  loadingInfo = $state(false);
  /** Ответ `app_info`; `null` — ещё не загружен. */
  info = $state<Result<AppInfoDto> | null>(null);

  async sendPing(): Promise<void> {
    if (this.pinging) return;
    this.pinging = true;
    try {
      this.ping = await call(() => commands.appPing(this.message));
    } finally {
      this.pinging = false;
    }
  }

  async loadInfo(): Promise<void> {
    if (this.loadingInfo) return;
    this.loadingInfo = true;
    try {
      this.info = await call(() => commands.appInfo());
    } finally {
      this.loadingInfo = false;
    }
  }
}

/** Время сборки (unix ms) как дата и время в формате локали UI. */
export function formatBuiltAt(builtAtMs: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'medium' }).format(
    builtAtMs,
  );
}
