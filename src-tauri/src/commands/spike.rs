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
//! первом вызове, хранится в [`SpikeTts`] под `Mutex` и никогда не клонируется. Там же кеш
//! списка голосов: его обновляет только `spike_tts_voices` (на Fedora speech-dispatcher
//! отдаёт ~14 600 записей), `spike_tts_speak` берёт голоса из кеша. Вызовы
//! быстрые: `speak` ставит текст в очередь синтезатора и не ждёт окончания речи. Первый вызов
//! на Linux может ждать автозапуска speech-dispatcher (до ~1 с) — для спайка приемлемо.

use std::sync::Mutex;

use serde::Serialize;
use tauri::Manager;

use crate::error::AppError;
use crate::spikes::{
    self, MAX_SPEAK_CHARS, RateRange, SPIKE_MEDIA, VoiceInfo, backend_rate_or_normal, find_media,
    is_variant_voice, select_voice,
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

/// Ленивый экземпляр системного TTS и кеш его голосов (см. описание модуля).
#[derive(Default)]
pub struct SpikeTts(Mutex<Option<TtsState>>);

/// Содержимое [`SpikeTts`] после первой инициализации.
struct TtsState {
    tts: tts::Tts,
    /// Последний список голосов бэкенда; `None` — ещё не запрашивался.
    voices: Option<Vec<tts::Voice>>,
}

impl TtsState {
    /// Запрашивает голоса у бэкенда и кладёт их в кеш.
    fn refresh_voices(&mut self) -> Result<&[tts::Voice], AppError> {
        let voices = self
            .tts
            .voices()
            .map_err(|err| tts_error("list voices", &err))?;
        Ok(self.voices.insert(voices))
    }

    /// Голоса из кеша; при пустом кеше — один запрос к бэкенду.
    fn cached_voices(&mut self) -> Result<&[tts::Voice], AppError> {
        if self.voices.is_none() {
            self.refresh_voices()?;
        }
        Ok(self.voices.as_deref().unwrap_or_default())
    }
}

impl SpikeTts {
    /// Выполняет `f` с инициализированным TTS.
    fn with<R>(&self, f: impl FnOnce(&mut TtsState) -> Result<R, AppError>) -> Result<R, AppError> {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| AppError::internal("spike TTS state is poisoned"))?;
        if guard.is_none() {
            let created = tts::Tts::default().map_err(|err| {
                AppError::internal(format!("system TTS is unavailable ({}): {err}", tts_hint()))
            })?;
            *guard = Some(TtsState {
                tts: created,
                voices: None,
            });
        }
        match guard.as_mut() {
            Some(state) => f(state),
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

/// Сырые байты встроенного тестового файла: в TS — `ArrayBuffer`.
///
/// Внутри — [`tauri::ipc::Response`]: Tauri отдаёт тело как `application/octet-stream`, и
/// `invoke` резолвится `ArrayBuffer` без JSON-массива чисел. Своя обёртка нужна потому, что
/// `Response` не реализует `specta::Type`; тип в TS задан через `specta_typescript::define`.
pub struct SpikeMediaBytes(tauri::ipc::Response);

impl specta::Type for SpikeMediaBytes {
    fn definition(_: &mut specta::Types) -> specta::datatype::DataType {
        specta::datatype::DataType::Reference(specta_typescript::define("ArrayBuffer"))
    }
}

impl tauri::ipc::IpcResponse for SpikeMediaBytes {
    fn body(self) -> tauri::Result<tauri::ipc::InvokeResponseBody> {
        self.0.body()
    }
}

/// Байты встроенного тестового аудио `name` (`speech.m4a` или `speech.ogg`) — чтобы стенд
/// строил `Blob` URL без `fetch` к asset-URL (его блокирует CSP `connect-src`). MIME —
/// `audio/mp4` / `audio/ogg` (см. `spike_prepare_media`). Данные встроены в бинарник, ФС не
/// читается.
///
/// # Errors
///
/// `app.invalid_argument`: имя не из фиксированного списка (сравнение точное, без путей).
#[tauri::command]
#[specta::specta]
pub fn spike_media_bytes(name: String) -> Result<SpikeMediaBytes, AppError> {
    let media = find_media(&SPIKE_MEDIA, &name)
        .ok_or_else(|| AppError::invalid_argument(format!("unknown spike media file {name:?}")))?;
    Ok(SpikeMediaBytes(tauri::ipc::Response::new(
        media.bytes.to_vec(),
    )))
}

/// Голоса системного TTS (крейт `tts`) и шкала скорости бэкенда. Всегда заново запрашивает
/// голоса у бэкенда и обновляет кеш, которым пользуется `spike_tts_speak`.
///
/// Не делать `async`: WinRT/AVFoundation требуют главного потока, см. описание модуля.
///
/// # Errors
///
/// `app.internal`: синтезатор недоступен (на Linux — нет speech-dispatcher) или не отдал голоса.
#[tauri::command]
#[specta::specta]
pub fn spike_tts_voices(state: tauri::State<'_, SpikeTts>) -> Result<SpikeTtsVoicesDto, AppError> {
    state.with(|st| {
        let (rate_min, rate_normal, rate_max) =
            (st.tts.min_rate(), st.tts.normal_rate(), st.tts.max_rate());
        let voices = st.refresh_voices()?;
        Ok(SpikeTtsVoicesDto {
            backend: backend_name(),
            voices: voices
                .iter()
                .map(voice_info)
                .filter(|v| !is_variant_voice(v))
                .map(Into::into)
                .collect(),
            total_voices: u32::try_from(voices.len()).unwrap_or(u32::MAX),
            rate_min,
            rate_normal,
            rate_max,
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
/// окончания речи; прерывает текущую фразу. Голоса — из кеша `spike_tts_voices` (если его
/// ещё нет — один запрос к бэкенду).
///
/// Не делать `async`: WinRT/AVFoundation требуют главного потока, см. описание модуля.
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
    state.with(|st| {
        let range = RateRange {
            min: st.tts.min_rate(),
            normal: st.tts.normal_rate(),
            max: st.tts.max_rate(),
        };
        let backend_rate = backend_rate_or_normal(rate, range)
            .ok_or_else(|| AppError::invalid_argument("rate must be a finite number"))?;
        let voices = st.cached_voices()?;
        let infos: Vec<VoiceInfo> = voices.iter().map(voice_info).collect();
        let (voice, info) = select_voice(&infos, &lang)
            .and_then(|i| Some((voices.get(i)?.clone(), infos.get(i)?.clone())))
            .ok_or_else(|| {
                AppError::invalid_argument(format!("no system voice for language {lang:?}"))
            })?;
        let tts = &mut st.tts;
        tts.set_voice(&voice)
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

    #[test]
    fn spike_media_bytes_returns_embedded_file_and_rejects_other_names() {
        use tauri::ipc::{InvokeResponseBody, IpcResponse};
        for media in SPIKE_MEDIA {
            let body = spike_media_bytes(media.name.to_owned())
                .unwrap()
                .body()
                .unwrap();
            assert!(
                matches!(&body, InvokeResponseBody::Raw(bytes) if bytes.as_slice() == media.bytes),
                "{}",
                media.name
            );
        }
        for bad in ["", "speech.mp3", "../spikes/speech.m4a", "SPEECH.OGG"] {
            let err = spike_media_bytes(bad.to_owned()).err().unwrap();
            assert_eq!(err.code, AppErrorCode::InvalidArgument, "{bad:?}");
        }
    }

    /// Ручная проверка на машине разработчика (молча, без речи): `cargo test -p mpt-app
    /// --features spikes -- --ignored --nocapture system_tts_lists`. В CI синтезатора нет.
    #[test]
    #[ignore = "needs a system speech synthesizer"]
    fn system_tts_lists_voices() {
        let state = SpikeTts::default();
        let voices = state
            .with(|st| st.refresh_voices().map(<[_]>::to_vec))
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
            .with(|st| {
                let voices = st.cached_voices()?;
                let infos: Vec<_> = voices.iter().map(voice_info).collect();
                let voice = select_voice(&infos, "en")
                    .and_then(|i| voices.get(i).cloned())
                    .ok_or_else(|| AppError::internal("no en voice"))?;
                let tts = &mut st.tts;
                tts.set_voice(&voice)
                    .map_err(|e| tts_error("set voice", &e))?;
                tts.speak("Hello from the spike test.", true)
                    .map_err(|e| tts_error("speak", &e))?;
                Ok(())
            })
            .unwrap();
        std::thread::sleep(std::time::Duration::from_secs(3));
    }
}
