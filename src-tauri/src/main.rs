// Не открывать консольное окно на Windows в релизной сборке. Не удалять.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::ExitCode;

fn main() -> ExitCode {
    match mpt_app::run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            // До подключения `tracing` (вместе с AppState) ошибка запуска пишется в stderr.
            eprintln!("my-personal-tutor: failed to run the application: {err}");
            ExitCode::FAILURE
        }
    }
}
