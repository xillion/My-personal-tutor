//! Доменное ядро My Personal Tutor: модель курса, разметка, токенизация, валидация,
//! проверка ответов, интервальное повторение.
//!
//! Крейт не делает IO, не зависит от Tauri и других крейтов проекта
//! (`docs/01_ARCHITECTURE.md` §2). Весь код детерминирован.

/// Версия крейта `mpt-core` (совпадает с версией workspace).
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_semver_triple() {
        let parts: Vec<&str> = VERSION.split('.').collect();
        assert_eq!(
            parts.len(),
            3,
            "version {VERSION} must be MAJOR.MINOR.PATCH"
        );
        assert!(parts.iter().all(|p| p.parse::<u64>().is_ok()));
    }
}
