//! Хранилище SQLite и миграции My Personal Tutor.
//!
//! Зависит только от `mpt-core` (`docs/01_ARCHITECTURE.md` §2).

/// Версия крейта `mpt-storage` (совпадает с версией workspace).
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shares_workspace_version_with_core() {
        assert_eq!(VERSION, mpt_core::VERSION);
    }
}
