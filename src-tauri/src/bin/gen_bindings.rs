//! Генерация TS-привязок из `mpt_app::specta_builder()` (`just gen`, ADR-23).
//!
//! Без feature `spikes` пишет `src/lib/ipc/bindings.ts`; с `--features spikes` — только
//! `src/lib/ipc/bindings.spikes.ts` (спайк-команды T-004), не трогая `bindings.ts`: так в
//! основных привязках `spike_*` не появляется ни при каком порядке запусков.
//! Окно и event loop не создаются: бинарь работает без дисплея (CI).

use std::path::Path;
use std::process::ExitCode;

/// Экспорт привязок в файл.
type Export = fn(&Path) -> Result<(), specta_typescript::Error>;

#[cfg(not(feature = "spikes"))]
const TARGET: (&str, Export) = (mpt_app::BINDINGS_PATH, mpt_app::export_bindings);

#[cfg(feature = "spikes")]
const TARGET: (&str, Export) = (mpt_app::SPIKE_BINDINGS_PATH, mpt_app::export_spike_bindings);

fn main() -> ExitCode {
    let (relative, export) = TARGET;
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(relative);
    match export(&path) {
        Ok(()) => {
            println!("gen_bindings: wrote {relative}");
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("gen_bindings: failed to export {}: {err}", path.display());
            ExitCode::FAILURE
        }
    }
}
