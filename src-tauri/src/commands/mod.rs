//! Все IPC-команды приложения (`docs/01_ARCHITECTURE.md` §4).
//!
//! Новая команда: функция с `#[tauri::command] #[specta::specta]` в модуле домена, строка в
//! [`collect`] и `just gen`. Нейминг — `domain_verb`.

pub mod app;

/// Список всех команд для `tauri_specta::Builder::commands`.
pub fn collect() -> tauri_specta::Commands<tauri::Wry> {
    tauri_specta::collect_commands![app::app_ping, app::app_info]
}
