// Глобальные типы приложения. Файл без import/export — объявления сливаются с типами Vite.

interface ImportMetaEnv {
  /**
   * `'1'` — сборка для ручных прогонов спайков (`just build-spikes`, T-004.1): страница
   * `/dev/spikes` доступна и вне `vite dev`. В релизной сборке не задаётся.
   */
  readonly VITE_MPT_SPIKES?: string;
}
