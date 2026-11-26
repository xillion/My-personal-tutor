//! Все IPC-команды приложения (`docs/01_ARCHITECTURE.md` §4).
//!
//! Новая команда: функция с `#[tauri::command] #[specta::specta]` в модуле домена, строка в
//! [`collect`] и `just gen`. Нейминг — `domain_verb`.
//!
//! Спайк-команды `spike_*` (T-004) — только с cargo-feature `spikes`: модуль [`spike`] и обе
//! ветки [`collect`] под `cfg`, их типы — в отдельном `bindings.spikes.ts` ([`collect_spikes`]).

pub mod app;
#[cfg(feature = "spikes")]
pub mod spike;

/// Список всех команд для `tauri_specta::Builder::commands` (регистрируются в `invoke_handler`).
#[cfg(not(feature = "spikes"))]
pub fn collect() -> tauri_specta::Commands<tauri::Wry> {
    tauri_specta::collect_commands![app::app_ping, app::app_info]
}

/// Список всех команд для `tauri_specta::Builder::commands`, включая спайк-команды.
///
/// Должен совпадать с веткой без `spikes` плюс [`collect_spikes`].
#[cfg(feature = "spikes")]
pub fn collect() -> tauri_specta::Commands<tauri::Wry> {
    tauri_specta::collect_commands![
        app::app_ping,
        app::app_info,
        spike::spike_prepare_media,
        spike::spike_tts_voices,
        spike::spike_tts_speak,
    ]
}

/// Только спайк-команды: для экспорта `bindings.spikes.ts`, не для `invoke_handler`.
#[cfg(feature = "spikes")]
pub fn collect_spikes() -> tauri_specta::Commands<tauri::Wry> {
    tauri_specta::collect_commands![
        spike::spike_prepare_media,
        spike::spike_tts_voices,
        spike::spike_tts_speak,
    ]
}
