//! Команды домена `app`: проверка связи и сведения о приложении.

use std::path::Path;

use serde::Serialize;
use tauri::Manager;

use crate::error::AppError;

/// Время сборки (unix ms), выставляет `build.rs`.
const BUILT_AT_MS: &str = env!("MPT_BUILT_AT_MS");

/// Сведения о приложении для экрана «О программе» и `/dev`.
///
/// Поля в IPC — `camelCase` (как и аргументы команд Tauri), пути — строки
/// (`to_string_lossy`): для отображения, а не для обратной передачи в Rust.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AppInfoDto {
    /// Версия приложения (`CARGO_PKG_VERSION`).
    pub version: String,
    /// ОС (`std::env::consts::OS`): `linux`, `windows`, `macos`, `android`, `ios`.
    pub os: String,
    /// Архитектура (`std::env::consts::ARCH`): `x86_64`, `aarch64`, …
    pub arch: String,
    /// Каталог данных приложения (`app_data_dir`).
    pub data_dir: String,
    /// Каталог установленных курсов (`data_dir/courses`, asset-scope ADR-11).
    pub courses_dir: String,
    /// Время сборки, unix ms. В TS — `number` (ADR-23: значения < 2^53).
    #[specta(type = specta_typescript::Number)]
    pub built_at_ms: i64,
}

/// Логика `app_ping`: эхо непустого сообщения.
///
/// # Errors
///
/// `app.invalid_argument`, если сообщение пустое.
pub fn ping(message: String) -> Result<String, AppError> {
    if message.is_empty() {
        return Err(AppError::invalid_argument("message must not be empty"));
    }
    Ok(message)
}

/// Собирает [`AppInfoDto`] для каталога данных `data_dir`.
#[must_use]
pub fn app_info_for(data_dir: &Path) -> AppInfoDto {
    AppInfoDto {
        version: env!("CARGO_PKG_VERSION").to_owned(),
        os: std::env::consts::OS.to_owned(),
        arch: std::env::consts::ARCH.to_owned(),
        data_dir: data_dir.to_string_lossy().into_owned(),
        courses_dir: data_dir.join("courses").to_string_lossy().into_owned(),
        built_at_ms: built_at_ms(),
    }
}

/// Время сборки; `0`, если `build.rs` записал нечисло (не должно случаться).
fn built_at_ms() -> i64 {
    BUILT_AT_MS.parse().unwrap_or(0)
}

/// Эхо: возвращает `message` без изменений. Проверка связи UI ↔ Rust.
///
/// # Errors
///
/// `app.invalid_argument`, если `message` пустая.
#[tauri::command]
#[specta::specta]
pub fn app_ping(message: String) -> Result<String, AppError> {
    ping(message)
}

/// Версия, платформа, каталоги данных и время сборки.
///
/// # Errors
///
/// `app.internal`, если ОС не сообщила каталог данных приложения.
#[tauri::command]
#[specta::specta]
pub fn app_info(app: tauri::AppHandle) -> Result<AppInfoDto, AppError> {
    let data_dir = app.path().app_data_dir()?;
    Ok(app_info_for(&data_dir))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::AppErrorCode;

    #[test]
    fn ping_echoes_message() {
        assert_eq!(ping("hello".to_owned()).unwrap(), "hello");
        assert_eq!(ping(" ".to_owned()).unwrap(), " ");
    }

    #[test]
    fn ping_rejects_empty_message() {
        let err = ping(String::new()).unwrap_err();
        assert_eq!(err.code, AppErrorCode::InvalidArgument);
        assert!(err.details.is_none());
    }

    #[test]
    fn app_info_derives_courses_dir_from_data_dir() {
        let data_dir = Path::new("/data/dev.rnd-center.mpt");
        let info = app_info_for(data_dir);
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(info.os, std::env::consts::OS);
        assert_eq!(info.arch, std::env::consts::ARCH);
        assert_eq!(info.data_dir, data_dir.to_string_lossy());
        assert_eq!(info.courses_dir, data_dir.join("courses").to_string_lossy());
    }

    #[test]
    fn built_at_ms_is_plausible_and_fits_js_number() {
        let ms = built_at_ms();
        // Не раньше SOURCE_DATE_EPOCH (если задан при сборке: Nix ставит 1980) или эпохи
        // и в пределах Number.MAX_SAFE_INTEGER (ADR-23).
        let lower = option_env!("SOURCE_DATE_EPOCH")
            .and_then(|s| s.trim().parse::<i64>().ok())
            .and_then(|secs| secs.checked_mul(1000))
            .unwrap_or(0);
        assert!(ms >= lower.max(0), "{ms} < {lower}");
        assert!(ms < (1_i64 << 53), "{ms}");
    }

    #[test]
    fn app_info_serializes_fields_in_camel_case() {
        let value = serde_json::to_value(app_info_for(Path::new("/d"))).unwrap();
        let mut keys: Vec<_> = value.as_object().unwrap().keys().cloned().collect();
        keys.sort();
        assert_eq!(
            keys,
            [
                "arch",
                "builtAtMs",
                "coursesDir",
                "dataDir",
                "os",
                "version"
            ]
        );
        assert!(value["builtAtMs"].is_i64());
    }
}
