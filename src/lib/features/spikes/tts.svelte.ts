// Раздел (3): системный TTS через Rust (крейт `tts`): голоса en/ru, скорость, произнесение.
import type { AppError } from '#lib/ipc/client.js';
import {
  spikeTtsSpeak,
  spikeTtsVoices,
  type SpikeTtsSpeakDto,
  type SpikeTtsVoicesDto,
  type SpikeVoiceDto,
} from '#lib/ipc/spikes.js';

export type SpikeLang = 'en' | 'ru';

/** Тестовые фразы — данные спайка, не строки интерфейса: язык фразы не зависит от языка UI. */
export const PHRASES: Record<SpikeLang, { lang: string; text: string }> = {
  en: { lang: 'en-US', text: 'Hello! The little cat is sitting on the mat.' },
  ru: { lang: 'ru-RU', text: 'Привет! Маленький котёнок сидит на коврике.' },
};

export const VOICES_SHOWN = 8;

export interface SpeakAttempt {
  lang: string;
  rate: number;
  result: SpikeTtsSpeakDto | null;
  error: AppError | null;
  /** Время ответа команды, мс (команда не ждёт окончания речи). */
  latencyMs: number;
}

/** Голоса для языка: `language` начинается с `lang` (`en`, `en-US`, `en-GB`...). */
export function voicesFor(voices: readonly SpikeVoiceDto[], lang: SpikeLang): SpikeVoiceDto[] {
  return voices.filter((voice) => voice.language.toLowerCase().startsWith(lang));
}

export class TtsSpike {
  loading = $state(false);
  voices = $state<SpikeTtsVoicesDto | null>(null);
  error = $state<AppError | null>(null);
  /** Множитель скорости UI: 0.5…2 (Rust переводит в шкалу бэкенда). */
  rate = $state(1);
  speaking = $state(false);
  attempts = $state<SpeakAttempt[]>([]);

  readonly en = $derived(voicesFor(this.voices?.voices ?? [], 'en'));
  readonly ru = $derived(voicesFor(this.voices?.voices ?? [], 'ru'));

  async loadVoices(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const result = await spikeTtsVoices();
      this.voices = result.ok ? result.data : null;
      this.error = result.ok ? null : result.error;
    } finally {
      this.loading = false;
    }
  }

  async speak(lang: SpikeLang): Promise<void> {
    if (this.speaking) return;
    this.speaking = true;
    const phrase = PHRASES[lang];
    const rate = this.rate;
    const started = performance.now();
    try {
      const result = await spikeTtsSpeak(phrase.text, phrase.lang, rate);
      const attempt: SpeakAttempt = {
        lang: phrase.lang,
        rate,
        result: result.ok ? result.data : null,
        error: result.ok ? null : result.error,
        latencyMs: Math.round(performance.now() - started),
      };
      this.attempts = [...this.attempts.slice(-9), attempt];
    } finally {
      this.speaking = false;
    }
  }

  report(): object {
    const voices = this.voices;
    return {
      error: this.error,
      backend: voices?.backend ?? null,
      totalVoices: voices?.totalVoices ?? null,
      shownVoices: voices?.voices.length ?? null,
      rateScale:
        voices === null
          ? null
          : { min: voices.rateMin, normal: voices.rateNormal, max: voices.rateMax },
      en: { count: this.en.length, first: $state.snapshot(this.en.slice(0, VOICES_SHOWN)) },
      ru: { count: this.ru.length, first: $state.snapshot(this.ru.slice(0, VOICES_SHOWN)) },
      attempts: $state.snapshot(this.attempts),
    };
  }
}
