//! Спайк-команды T-004 (стенд `/dev/spikes`), только с cargo-feature `spikes`.
//!
//! В релизной сборке модуля нет, а команды не попадают ни в `invoke_handler`, ни в
//! `bindings.ts` (`docs/01_ARCHITECTURE.md` §4a). Типы для фронтенда — в
//! `src/lib/ipc/bindings.spikes.ts`. Новых `AppErrorCode` спайк не вводит: ошибки —
//! `app.internal` (сбой ФС/TTS) и `app.invalid_argument` (аргументы), детали в `message`.
//!
//! **Поток выполнения TTS.** Команды `spike_tts_*` синхронные, поэтому Tauri выполняет их в
//! главном (UI) потоке. Это сознательно: WinRT (`MediaPlayer`) требует инициализированного
//! COM-апартамента, AVFoundation рассчитан на главный поток, а `tts::Tts` внутри — `Rc`
//! (крейт объявляет `Send`/`Sync` через `unsafe impl`). Экземпляр один, создаётся лениво при
//! первом вызове, хранится в [`SpikeTts`] под `Mutex` и никогда не клонируется. Вызовы
//! быстрые: `speak` ставит текст в очередь синтезатора и не ждёт окончания речи. Первый вызов
//! на Linux может ждать автозапуска speech-dispatcher (до ~1 с) — для спайка приемлемо.

use std::sync::Mutex;

use serde::Serialize;
use tauri::Manager;

use crate::error::AppError;
use crate::spikes::{
    self, MAX_SPEAK_CHARS, RateRange, SPIKE_MEDIA, VoiceInfo, backend_rate, is_variant_voice,
    select_voice,
};

/// Записанный тестовый медиафайл.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SpikeMediaFileDto {
    /// Имя файла (`speech.m4a`, `speech.ogg`).
    pub name: String,
    /// MIME-тип (`audio/mp4`, `audio/ogg`).
    pub mime: String,
    /// Абсолютный путь внутри `$APPDATA/courses/_spike/` — для `convertFileSrc`.
    pub path: String,
    /// Размер, байт.
    pub size_bytes: u32,
}

/// Результат `spike_prepare_media`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SpikeMediaDto {
    /// Каталог `$APPDATA/courses/_spike`.
    pub dir: String,
    /// Файлы: сначала `.m4a` (AAC-LC), затем `.ogg` (Opus).
    pub files: Vec<SpikeMediaFileDto>,
}

/// Голос системного TTS.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SpikeVoiceDto {
    /// Идентификатор голоса в бэкенде.
    pub id: String,
    /// Имя голоса.
    pub name: String,
    /// Язык, BCP 47.
    pub language: String,
}

/// Результат `spike_tts_voices`.
///
/// Числа скорости — константы бэкенда (всегда конечные), поэтому в TS — `number`, а не
/// `number | null`, который specta выводит для `f32` (NaN сериализуется в `null`).
#[derive(Debug, Clone, PartialEq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SpikeTtsVoicesDto {
    /// Бэкенд, который `tts::Tts::default()` выбирает на этой ОС: `SpeechDispatcher`, `WinRT`,
    /// `AVFoundation` (macOS 10.14+; на старых — `AppKit`, здесь не различается).
    pub backend: String,
    /// Голоса бэкенда без вариантов espeak-ng (`Voice+Variant`, см. `spikes::is_variant_voice`).
    pub voices: Vec<SpikeVoiceDto>,
    /// Сколько голосов сообщил бэкенд всего, включая скрытые варианты.
    pub total_voices: u32,
    /// Шкала скорости бэкенда: минимум.
    #[specta(type = specta_typescript::Number)]
    pub rate_min: f32,
    /// Шкала скорости бэкенда: обычная скорость.
    #[specta(type = specta_typescript::Number)]
    pub rate_normal: f32,
    /// Шкала скорости бэкенда: максимум.
    #[specta(type = specta_typescript::Number)]
    pub rate_max: f32,
}

/// Результат `spike_tts_speak`: какой голос выбран и какая скорость применена.
#[derive(Debug, Clone, PartialEq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct SpikeTtsSpeakDto {
    /// Выбранный голос.
    pub voice: SpikeVoiceDto,
    /// Значение скорости в шкале бэкенда (после нормализации множителя).
    #[specta(type = specta_typescript::Number)]
    pub backend_rate: f32,
}

/// Ленивый экземпляр системного TTS (см. описание модуля).
#[derive(Default)]
pub struct SpikeTts(Mutex<Option<tts::Tts>>);

impl SpikeTts {
    /// Выполняет `f` с инициализированным TTS.
    fn with<R>(&self, f: impl FnOnce(&mut tts::Tts) -> Result<R, AppError>) -> Result<R, AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::internal("spike TTS state is poisoned"))?;
        if guard.is_none() {
            let created = tts::Tts::default().map_err(|err| {
                AppError::internal(format!("system TTS is unavailable ({}): {err}", tts_hint()))
            })?;
            *guard = Some(created);
        }
        match guard.as_mut() {
            Some(tts) => f(tts),
            None => Err(AppError::internal("spike TTS is not initialized")),
        }
    }
}

/// Подсказка о системной зависимости TTS для текста ошибки.
const fn tts_hint() -> &'static str {
    if cfg!(target_os = "linux") {
        "is speech-dispatcher installed and running?"
    } else {
        "no system speech synthesizer"
    }
}

fn tts_error(action: &str, err: &tts::Error) -> AppError {
    AppError::internal(format!("system TTS failed to {action}: {err}"))
}

fn voice_info(voice: &tts::Voice) -> VoiceInfo {
    VoiceInfo {
        id: voice.id(),
        name: voice.name(),
        language: voice.language().as_str().to_owned(),
    }
}

impl From<VoiceInfo> for SpikeVoiceDto {
    fn from(v: VoiceInfo) -> Self {
        Self {
            id: v.id,
            name: v.name,
            language: v.language,
        }
    }
}

/// Проверяет аргументы `spike_tts_speak`; возвращает текст без крайних пробелов.
fn validate_speak_text(text: &str) -> Result<&str, AppError> {
    let text = text.trim();
    if text.is_empty() {
        return Err(AppError::invalid_argument("text must not be empty"));
    }
    if text.chars().count() > MAX_SPEAK_CHARS {
        return Err(AppError::invalid_argument(format!(
            "text must be at most {MAX_SPEAK_CHARS} characters"
        )));
    }
    Ok(text)
}

/// Копирует тестовое аудио (`speech.m4a`, `speech.ogg`) в `$APPDATA/courses/_spike/` и
/// возвращает пути — проверка настоящего asset scope. Повторный вызов перезаписывает файлы.
///
/// # Errors
///
/// `app.internal`: ОС не сообщила каталог данных или запись не удалась.
#[tauri::command]
#[specta::specta]
pub async fn spike_prepare_media(app: tauri::AppHandle) -> Result<SpikeMediaDto, AppError> {
    let courses_dir = app.path().app_data_dir()?.join("courses");
    let (dir, written) = tauri::async_runtime::spawn_blocking(move || {
        spikes::write_media(&courses_dir, &SPIKE_MEDIA)
    })
    .await
    .map_err(|err| AppError::internal(format!("spike media task failed: {err}")))?
    .map_err(|err| AppError::internal(format!("failed to write spike media: {err}")))?;
    let files = written
        .into_iter()
        .map(|file| {
            Ok(SpikeMediaFileDto {
                name: file.name.to_owned(),
                mime: file.mime.to_owned(),
                path: file.path.to_string_lossy().into_owned(),
                size_bytes: u32::try_from(file.size)
                    .map_err(|_| AppError::internal("spike media file is too large"))?,
            })
        })
        .collect::<Result<_, AppError>>()?;
    Ok(SpikeMediaDto {
        dir: dir.to_string_lossy().into_owned(),
        files,
    })
}

/// Голоса системного TTS (крейт `tts`) и шкала скорости бэкенда.
///
/// # Errors
///
/// `app.internal`: синтезатор недоступен (на Linux — нет speech-dispatcher) или не отдал голоса.
#[tauri::command]
#[specta::specta]
pub fn spike_tts_voices(state: tauri::State<'_, SpikeTts>) -> Result<SpikeTtsVoicesDto, AppError> {
    state.with(|tts| {
        let voices = tts.voices().map_err(|err| tts_error("list voices", &err))?;
        Ok(SpikeTtsVoicesDto {
            backend: backend_name(),
            voices: voices
                .iter()
                .map(voice_info)
                .filter(|v| !is_variant_voice(v))
                .map(Into::into)
                .collect(),
            total_voices: u32::try_from(voices.len()).unwrap_or(u32::MAX),
            rate_min: tts.min_rate(),
            rate_normal: tts.normal_rate(),
            rate_max: tts.max_rate(),
        })
    })
}

/// Имя бэкенда, который выбирает `Tts::default()` на этой платформе.
fn backend_name() -> String {
    let name = if cfg!(target_os = "linux") {
        "SpeechDispatcher"
    } else if cfg!(windows) {
        "WinRT"
    } else if cfg!(any(target_os = "macos", target_os = "ios")) {
        "AVFoundation"
    } else if cfg!(target_os = "android") {
        "Android"
    } else {
        "unknown"
    };
    name.to_owned()
}

/// Произносит `text` голосом для языка `lang` (BCP 47: `en`, `ru-RU`) со скоростью `rate`
/// (множитель, `1.0` — обычная, ограничивается `0.5…2`; `null` — обычная). Не ждёт
/// окончания речи; прерывает текущую фразу.
///
/// # Errors
///
/// `app.invalid_argument`: пустой или слишком длинный текст, нечисловая скорость, нет голоса
/// для языка. `app.internal`: синтезатор недоступен или отказал.
#[tauri::command]
#[specta::specta]
pub fn spike_tts_speak(
    state: tauri::State<'_, SpikeTts>,
    text: String,
    lang: String,
    rate: Option<f32>,
) -> Result<SpikeTtsSpeakDto, AppError> {
    let text = validate_speak_text(&text)?;
    state.with(|tts| {
        let voices = tts.voices().map_err(|err| tts_error("list voices", &err))?;
        let infos: Vec<VoiceInfo> = voices.iter().map(voice_info).collect();
        let (voice, info) = select_voice(&infos, &lang)
            .and_then(|i| Some((voices.get(i)?, infos.get(i)?.clone())))
            .ok_or_else(|| {
                AppError::invalid_argument(format!("no system voice for language {lang:?}"))
            })?;
        let range = RateRange {
            min: tts.min_rate(),
            normal: tts.normal_rate(),
            max: tts.max_rate(),
        };
        let backend_rate = backend_rate(rate.unwrap_or(1.0), range)
            .ok_or_else(|| AppError::invalid_argument("rate must be a finite number"))?;
        tts.set_voice(voice)
            .map_err(|err| tts_error("set voice", &err))?;
        tts.set_rate(backend_rate)
            .map_err(|err| tts_error("set rate", &err))?;
        tts.speak(text, true)
            .map_err(|err| tts_error("speak", &err))?;
        Ok(SpikeTtsSpeakDto {
            voice: info.into(),
            backend_rate,
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::AppErrorCode;

    #[test]
    fn validate_speak_text_trims_and_limits_length() {
        assert_eq!(validate_speak_text("  hi  ").unwrap(), "hi");
        assert_eq!(
            validate_speak_text(" \n ").unwrap_err().code,
            AppErrorCode::InvalidArgument
        );
        let long = "я".repeat(MAX_SPEAK_CHARS + 1);
        assert_eq!(
            validate_speak_text(&long).unwrap_err().code,
            AppErrorCode::InvalidArgument
        );
        assert!(validate_speak_text(&"я".repeat(MAX_SPEAK_CHARS)).is_ok());
    }

    /// Ручная проверка на машине разработчика (молча, без речи): `cargo test -p mpt-app
    /// --features spikes -- --ignored --nocapture system_tts_lists`. В CI синтезатора нет.
    #[test]
    #[ignore = "needs a system speech synthesizer"]
    fn system_tts_lists_voices() {
        let state = SpikeTts::default();
        let voices = state
            .with(|tts| tts.voices().map_err(|e| tts_error("list voices", &e)))
            .unwrap();
        let infos: Vec<_> = voices.iter().map(voice_info).collect();
        println!("{} voices; first: {:?}", infos.len(), infos.first());
        for lang in ["en", "ru"] {
            let selected = select_voice(&infos, lang).and_then(|i| infos.get(i));
            println!("{lang}: {selected:?}");
        }
        assert!(!infos.is_empty());
    }

    /// Произносит фразу вслух: `... -- --ignored --nocapture system_tts_speaks`.
    #[test]
    #[ignore = "needs a system speech synthesizer and speaks out loud"]
    fn system_tts_speaks() {
        let state = SpikeTts::default();
        state
            .with(|tts| {
                let voices = tts.voices().map_err(|e| tts_error("list voices", &e))?;
                let infos: Vec<_> = voices.iter().map(voice_info).collect();
                let voice = select_voice(&infos, "en")
                    .and_then(|i| voices.get(i))
                    .ok_or_else(|| AppError::internal("no en voice"))?;
                tts.set_voice(voice)
                    .map_err(|e| tts_error("set voice", &e))?;
                tts.speak("Hello from the spike test.", true)
                    .map_err(|e| tts_error("speak", &e))?;
                Ok(())
            })
            .unwrap();
        std::thread::sleep(std::time::Duration::from_secs(3));
    }
}
