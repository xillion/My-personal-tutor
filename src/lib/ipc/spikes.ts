// Спайк-команды T-004 (cargo-feature `spikes`, docs/01_ARCHITECTURE.md §4a).
//
// Единственный модуль, импортирующий `bindings.spikes.ts`. В релизной сборке без feature
// `spikes` этих команд нет в Rust: вызов вернёт ошибку фреймворка, которую `call()` сводит к
// `app.internal`. Страница `/dev/spikes`, единственный потребитель, в релизе отвечает 404.
import {
  commands,
  type SpikeMediaDto,
  type SpikeMediaFileDto,
  type SpikeTtsSpeakDto,
  type SpikeTtsVoicesDto,
  type SpikeVoiceDto,
} from './bindings.spikes.js';
import { call, type Result } from './client.js';

export type {
  SpikeMediaDto,
  SpikeMediaFileDto,
  SpikeTtsSpeakDto,
  SpikeTtsVoicesDto,
  SpikeVoiceDto,
};

/** Копирует тестовое аудио в `$APPDATA/courses/_spike/` и возвращает пути (сначала `.m4a`). */
export function spikePrepareMedia(): Promise<Result<SpikeMediaDto>> {
  return call(() => commands.spikePrepareMedia());
}

/**
 * Сырые байты встроенного тестового аудио (`speech.m4a` / `speech.ogg`) — для Blob URL без
 * `fetch` к asset-URL. Приходят как `ArrayBuffer` (raw-ответ IPC).
 */
export function spikeMediaBytes(name: string): Promise<Result<ArrayBuffer>> {
  return call(() => commands.spikeMediaBytes(name));
}

/** Голоса системного TTS и шкала скорости бэкенда. */
export function spikeTtsVoices(): Promise<Result<SpikeTtsVoicesDto>> {
  return call(() => commands.spikeTtsVoices());
}

/**
 * Произносит `text` голосом для `lang` (BCP 47). `rate` — множитель (1 — обычная, 0.5…2),
 * `null` — обычная скорость.
 */
export function spikeTtsSpeak(
  text: string,
  lang: string,
  rate: number | null,
): Promise<Result<SpikeTtsSpeakDto>> {
  return call(() => commands.spikeTtsSpeak(text, lang, rate));
}
