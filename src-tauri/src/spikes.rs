//! Логика спайк-команд T-004 (стенд `/dev/spikes`): тестовое медиа и системный TTS.
//!
//! Модуль существует только с cargo-feature `spikes` (`docs/01_ARCHITECTURE.md` §4a) и в
//! релиз не попадает. Здесь — чистые функции (выбор голоса, отображение скорости) и запись
//! медиа в каталог; IPC-обёртки — в [`crate::commands::spike`].

use std::path::{Path, PathBuf};

/// Подкаталог `courses/` для медиа спайка: внутри asset scope `$APPDATA/courses/**` (§4a).
pub const SPIKE_MEDIA_DIR: &str = "_spike";

/// Встроенный тестовый файл (`scripts/make-spike-audio.sh`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmbeddedMedia {
    /// Имя файла в [`SPIKE_MEDIA_DIR`].
    pub name: &'static str,
    /// MIME-тип для `<audio>`/`Blob`.
    pub mime: &'static str,
    /// Содержимое.
    pub bytes: &'static [u8],
}

/// Тестовое аудио: одна и та же речь в AAC-LC (`.m4a`, формат пакета, ADR-12) и Opus (`.ogg`).
pub const SPIKE_MEDIA: [EmbeddedMedia; 2] = [
    EmbeddedMedia {
        name: "speech.m4a",
        mime: "audio/mp4",
        bytes: include_bytes!("../spikes/speech.m4a"),
    },
    EmbeddedMedia {
        name: "speech.ogg",
        mime: "audio/ogg",
        bytes: include_bytes!("../spikes/speech.ogg"),
    },
];

/// Файл, записанный [`write_media`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WrittenMedia {
    /// Имя файла.
    pub name: &'static str,
    /// MIME-тип.
    pub mime: &'static str,
    /// Абсолютный путь (если `courses_dir` абсолютный).
    pub path: PathBuf,
    /// Размер в байтах.
    pub size: usize,
}

/// Записывает `media` в `courses_dir/_spike/`, создавая каталоги; существующие файлы
/// перезаписываются. Возвращает каталог и записанные файлы в порядке `media`.
///
/// Пишется во временный файл рядом и переименовывается, чтобы `<audio>`, уже открывший старый
/// файл, не прочитал наполовину записанный.
///
/// # Errors
///
/// Ошибка ФС при создании каталога, записи или переименовании.
pub fn write_media(
    courses_dir: &Path,
    media: &[EmbeddedMedia],
) -> std::io::Result<(PathBuf, Vec<WrittenMedia>)> {
    let dir = courses_dir.join(SPIKE_MEDIA_DIR);
    std::fs::create_dir_all(&dir)?;
    let mut written = Vec::with_capacity(media.len());
    for item in media {
        let path = dir.join(item.name);
        let tmp = dir.join(format!(".{}.tmp", item.name));
        std::fs::write(&tmp, item.bytes)?;
        std::fs::rename(&tmp, &path)?;
        written.push(WrittenMedia {
            name: item.name,
            mime: item.mime,
            path,
            size: item.bytes.len(),
        });
    }
    Ok((dir, written))
}

/// Голос системного TTS в независимом от бэкенда виде.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VoiceInfo {
    /// Идентификатор бэкенда (для speech-dispatcher совпадает с именем).
    pub id: String,
    /// Отображаемое имя.
    pub name: String,
    /// Языковой тег BCP 47 (`en-US`, `ru`).
    pub language: String,
}

/// Основной подтег языка в нижнем регистре: `en-US` → `en`, `ru_RU` → `ru`.
fn primary_language(tag: &str) -> String {
    tag.split(['-', '_'])
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase()
}

/// Вариант голоса espeak-ng (`English (America)+Alex`): speech-dispatcher перечисляет каждый
/// голос × ~70 вариантов (на Fedora — ~14 600 записей). Такие голоса скрываются из списка и не
/// выбираются автоматически. У WinRT/AVFoundation `+` в именах не встречается.
#[must_use]
pub fn is_variant_voice(voice: &VoiceInfo) -> bool {
    voice.name.contains('+')
}

/// Выбирает голос для языка `lang` (BCP 47), пропуская варианты ([`is_variant_voice`]):
/// сначала точное совпадение тега (без учёта регистра и `_`/`-`), затем совпадение основного
/// подтега (`en` → `en-GB`), предпочитая самый короткий тег (`en-GB` раньше `en-029`). При
/// равенстве — первый в списке бэкенда. Возвращает индекс в `voices`.
#[must_use]
pub fn select_voice(voices: &[VoiceInfo], lang: &str) -> Option<usize> {
    let normalize = |tag: &str| tag.replace('_', "-").to_ascii_lowercase();
    let wanted = normalize(lang.trim());
    let wanted_primary = primary_language(&wanted);
    if wanted_primary.is_empty() {
        return None;
    }
    let candidates = || {
        voices
            .iter()
            .enumerate()
            .filter(|(_, v)| !is_variant_voice(v))
    };
    candidates()
        .find(|(_, v)| normalize(&v.language) == wanted)
        .or_else(|| {
            candidates()
                .filter(|(_, v)| primary_language(&v.language) == wanted_primary)
                // `min_by_key` при равенстве оставляет первый элемент.
                .min_by_key(|(_, v)| v.language.len())
        })
        .map(|(i, _)| i)
}

/// Допустимый множитель скорости речи: 0.5× … 2×.
pub const RATE_MULTIPLIER_RANGE: (f32, f32) = (0.5, 2.0);

/// Диапазон скорости бэкенда `tts` (`min_rate`/`normal_rate`/`max_rate`).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RateRange {
    /// Минимум.
    pub min: f32,
    /// Обычная скорость.
    pub normal: f32,
    /// Максимум.
    pub max: f32,
}

/// Переводит множитель скорости (`1.0` — обычная) в значение бэкенда `tts`.
///
/// Шкалы бэкендов `tts` 0.26 разные: speech-dispatcher — `-100..100`, обычная `0`
/// (аддитивная); WinRT — `0.5..6`, обычная `1`; AVFoundation — `0.1..2`, обычная `0.5`
/// (мультипликативные). Для шкал с `normal > 0` результат — `normal × multiplier`; для
/// аддитивной — линейная интерполяция: `0.5×` → `min`, `1×` → `normal`, `2×` → середина
/// между `normal` и `max` (у speech-dispatcher `+100` заметно быстрее 2×). Множитель
/// предварительно ограничивается [`RATE_MULTIPLIER_RANGE`], результат — `[min, max]`.
/// Нечисловой множитель (`NaN`, `±∞`) — `None`.
#[must_use]
pub fn backend_rate(multiplier: f32, range: RateRange) -> Option<f32> {
    if !multiplier.is_finite() {
        return None;
    }
    let (low, high) = RATE_MULTIPLIER_RANGE;
    let m = multiplier.clamp(low, high);
    let value = if range.normal > 0.0 {
        range.normal * m
    } else if m <= 1.0 {
        range.normal + (1.0 - m) / (1.0 - low) * (range.min - range.normal)
    } else {
        range.normal + (m - 1.0) / (high - 1.0) * (range.max - range.normal) / 2.0
    };
    Some(value.clamp(range.min, range.max))
}

/// Максимальная длина текста для `spike_tts_speak`, символов.
pub const MAX_SPEAK_CHARS: usize = 1000;

#[cfg(test)]
mod tests {
    use super::*;

    fn voice(name: &str, language: &str) -> VoiceInfo {
        VoiceInfo {
            id: name.to_owned(),
            name: name.to_owned(),
            language: language.to_owned(),
        }
    }

    const SPEECHD: RateRange = RateRange {
        min: -100.0,
        normal: 0.0,
        max: 100.0,
    };
    const WINRT: RateRange = RateRange {
        min: 0.5,
        normal: 1.0,
        max: 6.0,
    };
    const AVFOUNDATION: RateRange = RateRange {
        min: 0.1,
        normal: 0.5,
        max: 2.0,
    };

    #[test]
    fn select_voice_prefers_exact_tag_then_primary_language() {
        let voices = [
            voice("gb", "en-GB"),
            voice("us", "en-US"),
            voice("ru", "ru"),
        ];
        assert_eq!(select_voice(&voices, "en-US"), Some(1));
        assert_eq!(select_voice(&voices, "en_us"), Some(1));
        assert_eq!(select_voice(&voices, "en"), Some(0));
        assert_eq!(select_voice(&voices, "en-AU"), Some(0));
        assert_eq!(select_voice(&voices, "ru-RU"), Some(2));
        assert_eq!(select_voice(&voices, " RU "), Some(2));
    }

    #[test]
    fn select_voice_skips_variants_and_prefers_short_tags() {
        let voices = [
            voice("English (Caribbean)", "en-029"),
            voice("English (America)+Alex", "en-US"),
            voice("English (Great Britain)", "en-GB"),
            voice("English (America)", "en-US"),
        ];
        assert_eq!(select_voice(&voices, "en"), Some(2));
        assert_eq!(select_voice(&voices, "en-US"), Some(3));
        assert_eq!(select_voice(&voices, "en-029"), Some(0));
        assert!(is_variant_voice(&voices[1]));
        assert!(!is_variant_voice(&voices[0]));
        assert_eq!(select_voice(&voices[1..2], "en"), None);
    }

    #[test]
    fn select_voice_returns_none_without_match() {
        let voices = [voice("us", "en-US")];
        assert_eq!(select_voice(&voices, "de"), None);
        assert_eq!(select_voice(&voices, ""), None);
        assert_eq!(select_voice(&[], "en"), None);
    }

    #[test]
    fn backend_rate_keeps_normal_speed_on_every_backend() {
        for range in [SPEECHD, WINRT, AVFOUNDATION] {
            assert_eq!(backend_rate(1.0, range), Some(range.normal));
        }
    }

    #[test]
    fn backend_rate_maps_additive_speech_dispatcher_scale() {
        assert_eq!(backend_rate(0.5, SPEECHD), Some(-100.0));
        assert_eq!(backend_rate(0.75, SPEECHD), Some(-50.0));
        assert_eq!(backend_rate(2.0, SPEECHD), Some(50.0));
        assert_eq!(backend_rate(10.0, SPEECHD), Some(50.0));
        assert_eq!(backend_rate(0.0, SPEECHD), Some(-100.0));
    }

    #[test]
    fn backend_rate_multiplies_multiplicative_scales() {
        assert_eq!(backend_rate(0.75, WINRT), Some(0.75));
        assert_eq!(backend_rate(2.0, WINRT), Some(2.0));
        assert_eq!(backend_rate(0.5, AVFOUNDATION), Some(0.25));
        assert_eq!(backend_rate(2.0, AVFOUNDATION), Some(1.0));
        assert_eq!(backend_rate(-3.0, WINRT), Some(0.5));
    }

    #[test]
    fn backend_rate_rejects_non_finite_multiplier() {
        for bad in [f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            assert_eq!(backend_rate(bad, SPEECHD), None);
        }
    }

    #[test]
    fn write_media_copies_files_into_spike_dir_and_overwrites() {
        let root = std::env::temp_dir().join(format!("mpt-spike-media-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let courses = root.join("courses");
        let media = [EmbeddedMedia {
            name: "a.bin",
            mime: "application/octet-stream",
            bytes: b"abc",
        }];

        let (dir, written) = write_media(&courses, &media).unwrap();
        assert_eq!(dir, courses.join(SPIKE_MEDIA_DIR));
        assert_eq!(written.len(), 1);
        assert_eq!(written[0].path, dir.join("a.bin"));
        assert_eq!(written[0].size, 3);
        assert_eq!(std::fs::read(dir.join("a.bin")).unwrap(), b"abc");

        std::fs::write(dir.join("a.bin"), b"stale-and-longer").unwrap();
        write_media(&courses, &media).unwrap();
        assert_eq!(std::fs::read(dir.join("a.bin")).unwrap(), b"abc");
        let names: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name())
            .collect();
        assert_eq!(names, ["a.bin"], "no temp files left behind");

        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn embedded_media_is_real_aac_and_opus() {
        let [m4a, ogg] = SPIKE_MEDIA;
        // MP4: размер бокса (4 байта) + `ftyp`; Ogg: `OggS`, в первой странице — `OpusHead`.
        assert_eq!(m4a.bytes.get(4..8), Some(&b"ftyp"[..]));
        assert!(m4a.bytes.len() > 100_000, "{}", m4a.bytes.len());
        assert_eq!(ogg.bytes.get(..4), Some(&b"OggS"[..]));
        assert!(ogg.bytes.windows(8).any(|w| w == b"OpusHead"));
    }
}
