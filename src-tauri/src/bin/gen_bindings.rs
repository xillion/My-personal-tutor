//! Генерация `src/lib/ipc/bindings.ts` из `mpt_app::specta_builder()` (`just gen`, ADR-23).
//!
//! Окно и event loop не создаются: бинарь работает без дисплея (CI).

use std::path::Path;
use std::process::ExitCode;

fn main() -> ExitCode {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(mpt_app::BINDINGS_PATH);
    match mpt_app::export_bindings(&path) {
        Ok(()) => {
            println!("gen_bindings: wrote {}", mpt_app::BINDINGS_PATH);
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("gen_bindings: failed to export {}: {err}", path.display());
            ExitCode::FAILURE
        }
    }
}
