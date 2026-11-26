//! Единая ошибка IPC-команд (`docs/01_ARCHITECTURE.md` §4, ADR-10).
//!
//! Каждая команда возвращает `Result<T, AppError>`. В TS `AppError` — объект
//! `{ code, message, details? }`, а `AppErrorCode` — union строковых литералов: UI выбирает
//! текст для пользователя из i18n по `code`, `message` — технический текст для логов и `/dev`.

use serde::Serialize;

/// Машиночитаемый код ошибки с точечной иерархией `domain.reason`.
///
/// Новые коды добавляются вместе с командой, которой они нужны; на фронтенде каждый код
/// обязан иметь перевод (исчерпывающий `switch` в `client.ts`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, specta::Type)]
pub enum AppErrorCode {
    /// Непредвиденная внутренняя ошибка (баг или сбой окружения).
    #[serde(rename = "app.internal")]
    Internal,
    /// Аргумент команды не прошёл проверку.
    #[serde(rename = "app.invalid_argument")]
    InvalidArgument,
}

impl AppErrorCode {
    /// Строковый код в том виде, в каком он уходит в IPC (`app.internal`, …).
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Internal => "app.internal",
            Self::InvalidArgument => "app.invalid_argument",
        }
    }
}

impl std::fmt::Display for AppErrorCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Ошибка команды Tauri: код, технический текст и необязательные структурированные детали.
///
/// Сериализуется в `{"code":"app.internal","message":"…"}`; поле `details` появляется,
/// только если детали заданы.
#[derive(Debug, Clone, PartialEq, Serialize, specta::Type, thiserror::Error)]
#[error("{code}: {message}")]
pub struct AppError {
    /// Код для выбора i18n-сообщения.
    pub code: AppErrorCode,
    /// Технический текст (английский, для логов); пользователю не показывается.
    pub message: String,
    /// Структурированные детали (например, путь или имя поля).
    ///
    /// В TS — `unknown`: `serde_json::Value` содержит `i64`/`u64`, которые specta-typescript
    /// отказывается экспортировать (ADR-23, правило чисел), а форма деталей зависит от кода.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[specta(type = Option<specta_typescript::Unknown>)]
    pub details: Option<serde_json::Value>,
}

impl AppError {
    /// Создаёт ошибку без деталей.
    #[must_use]
    pub fn new(code: AppErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details: None,
        }
    }

    /// Ошибка `app.internal`.
    #[must_use]
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(AppErrorCode::Internal, message)
    }

    /// Ошибка `app.invalid_argument`.
    #[must_use]
    pub fn invalid_argument(message: impl Into<String>) -> Self {
        Self::new(AppErrorCode::InvalidArgument, message)
    }

    /// Добавляет структурированные детали.
    #[must_use]
    pub fn with_details(mut self, details: serde_json::Value) -> Self {
        self.details = Some(details);
        self
    }
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        Self::internal(err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn serializes_without_details_when_absent() {
        let err = AppError::internal("boom");
        let value = serde_json::to_value(&err).unwrap();
        assert_eq!(value, json!({ "code": "app.internal", "message": "boom" }));
        assert_eq!(
            serde_json::to_string(&err).unwrap(),
            r#"{"code":"app.internal","message":"boom"}"#
        );
    }

    #[test]
    fn serializes_details_when_present() {
        let err = AppError::invalid_argument("bad").with_details(json!({ "field": "message" }));
        let value = serde_json::to_value(&err).unwrap();
        assert_eq!(
            value,
            json!({
                "code": "app.invalid_argument",
                "message": "bad",
                "details": { "field": "message" }
            })
        );
    }

    #[test]
    fn code_serialization_matches_as_str() {
        for code in [AppErrorCode::Internal, AppErrorCode::InvalidArgument] {
            assert_eq!(serde_json::to_value(code).unwrap(), json!(code.as_str()));
        }
    }

    #[test]
    fn display_includes_code_and_message() {
        assert_eq!(AppError::internal("boom").to_string(), "app.internal: boom");
    }
}
