use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    emit_built_at_ms();
    let windows = tauri_build::WindowsAttributes::new_without_app_manifest();
    embed_windows_manifest();
    let attributes = tauri_build::Attributes::new().windows_attributes(windows);
    if let Err(error) = tauri_build::try_build(attributes) {
        // Ненулевой код выхода build-скрипта — ошибка сборки; stderr cargo покажет.
        eprintln!("tauri-build failed: {error:#}");
        std::process::exit(1);
    }
}

/// Встраивает манифест Windows (зависимость на Common-Controls v6) во все исполняемые
/// цели пакета: bin, `gen_bindings`, unit- и интеграционные тесты.
///
/// tauri-build по умолчанию кладёт манифест в ресурс, который линкуется только в bin-цели.
/// Tauri импортирует `TaskDialogIndirect` из comctl32, а эта функция есть лишь в comctl32 v6;
/// без манифеста загрузчик подставляет v5.82 и тестовый бинарь падает при старте с
/// `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139). Поэтому манифест из ресурса tauri-build
/// отключён (`new_without_app_manifest`, иначе дубликат ресурса CVT1100), а встраивает его
/// линкер MSVC для всех целей. Цель проверяется по `CARGO_CFG_*` (не `cfg!`: это хост).
fn embed_windows_manifest() {
    const MANIFEST: &str = "windows-app-manifest.xml";
    println!("cargo:rerun-if-changed={MANIFEST}");
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    if target_os != "windows" || target_env != "msvc" {
        return;
    }
    let dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".into());
    let manifest = std::path::Path::new(&dir).join(MANIFEST);
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
    // Предупреждения линкера (в т.ч. о манифесте) — ошибки.
    println!("cargo:rustc-link-arg=/WX");
}

/// Выставляет `MPT_BUILT_AT_MS` — время сборки в unix ms для `app_info` (T-002).
///
/// Для воспроизводимых сборок учитывается `SOURCE_DATE_EPOCH` (секунды). Значение
/// обновляется, когда cargo перезапускает build-скрипт (изменились отслеживаемые им файлы,
/// `SOURCE_DATE_EPOCH` или чистая сборка), а не при каждой компиляции. На `bindings.ts`
/// не влияет: в TS попадает только тип поля.
fn emit_built_at_ms() {
    println!("cargo:rerun-if-env-changed=SOURCE_DATE_EPOCH");
    let from_epoch = std::env::var("SOURCE_DATE_EPOCH")
        .ok()
        .and_then(|s| s.trim().parse::<i64>().ok())
        .and_then(|secs| secs.checked_mul(1000));
    let ms = from_epoch.unwrap_or_else(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .ok()
            .and_then(|d| i64::try_from(d.as_millis()).ok())
            .unwrap_or(0)
    });
    println!("cargo:rustc-env=MPT_BUILT_AT_MS={ms}");
}
