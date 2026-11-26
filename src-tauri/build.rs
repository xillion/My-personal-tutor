use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    emit_built_at_ms();
    tauri_build::build();
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
