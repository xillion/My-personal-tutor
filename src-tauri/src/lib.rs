//! Оболочка Tauri приложения My Personal Tutor: команды, состояние, capabilities.
//!
//! Команды тонкие (5–30 строк): состояние → сервис → DTO. Логика — в `mpt-core` и сервисных
//! крейтах (`docs/01_ARCHITECTURE.md` §2).

/// Версии крейтов приложения: `(имя крейта, версия)`.
///
/// Пригодится экрану «О программе» и диагностике; заодно фиксирует связь `mpt-app` с сервисными
/// крейтами, которые начнут использоваться командами в следующих задачах.
pub const CRATE_VERSIONS: [(&str, &str); 4] = [
    ("mpt-app", env!("CARGO_PKG_VERSION")),
    ("mpt-storage", mpt_storage::VERSION),
    ("mpt-importer", mpt_importer::VERSION),
    ("mpt-services", mpt_services::VERSION),
];

/// Строитель IPC-контракта.
///
/// Заглушка до T-002: там функция вернёт `tauri_specta::Builder` со всеми командами, и его будут
/// использовать и `run()`, и бинарь `gen_bindings` (ADR-23). Сейчас команд нет.
pub fn specta_builder() {}

/// Контекст приложения: `tauri.conf.json`, встроенные ассеты фронтенда, capabilities.
fn context() -> tauri::Context<tauri::Wry> {
    tauri::generate_context!()
}

/// Запускает приложение и блокирует поток до его завершения.
///
/// Мобильная точка входа (`tauri::mobile_entry_point`) появится в Фазе 8.
///
/// # Errors
///
/// Возвращает ошибку Tauri, если не удалось создать окно или event loop.
pub fn run() -> tauri::Result<()> {
    specta_builder();
    tauri::Builder::default().run(context())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::utils::config::{Csp, FsScope};

    /// CSP из `docs/01_ARCHITECTURE.md` §4a, одной строкой.
    const EXPECTED_CSP: &str = "default-src 'self'; script-src 'self'; \
        style-src 'self' 'unsafe-inline'; \
        img-src 'self' asset: http://asset.localhost data: blob:; \
        media-src 'self' asset: http://asset.localhost blob:; font-src 'self' data:; \
        connect-src ipc: http://ipc.localhost; object-src 'none'; frame-src 'none'";

    #[test]
    fn identifier_matches_adr_24() {
        assert_eq!(context().config().identifier, "dev.rnd-center.mpt");
    }

    #[test]
    fn csp_matches_architecture_and_forbids_eval() {
        let context = context();
        let csp = context.config().app.security.csp.as_ref();
        assert!(
            matches!(csp, Some(Csp::Policy(_))),
            "CSP must be a single policy string"
        );
        let actual = csp.map(ToString::to_string).unwrap_or_default();
        assert_eq!(actual, EXPECTED_CSP);
        assert!(!actual.contains("unsafe-eval"));
    }

    /// `assetProtocol.enable` в `generate_context!` не попадает: протокол включает cargo-фича
    /// `protocol-asset`, а её соответствие конфигу проверяет `tauri_build::build()` при сборке.
    #[test]
    fn asset_protocol_is_limited_to_courses_dir() {
        let context = context();
        let asset = &context.config().app.security.asset_protocol;
        let FsScope::AllowedPaths(paths) = &asset.scope else {
            unreachable!("asset scope must be a plain list: {:?}", asset.scope);
        };
        let paths: Vec<_> = paths.iter().map(|p| p.to_string_lossy()).collect();
        assert_eq!(paths, ["$APPDATA/courses/**"]);
    }

    #[test]
    fn capabilities_grant_no_fs_or_shell_plugins() {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("capabilities");
        let mut checked = 0;
        for entry in std::fs::read_dir(&dir).unwrap() {
            let path = entry.unwrap().path();
            let text = std::fs::read_to_string(&path).unwrap();
            for forbidden in ["fs:", "shell:"] {
                assert!(
                    !text.contains(forbidden),
                    "{forbidden} in {path:?} (ADR-11)"
                );
            }
            checked += 1;
        }
        assert!(checked > 0, "no capability files in {dir:?}");
        // Capabilities можно объявить и inline в tauri.conf.json — там их быть не должно.
        assert!(
            context().config().app.security.capabilities.is_empty(),
            "inline capabilities in tauri.conf.json are not allowed"
        );
        let default = std::fs::read_to_string(dir.join("default.json")).unwrap();
        assert!(default.contains("\"core:default\""));
    }

    /// Лицензия фронтенда (`package.json`) и бандла совпадает с лицензией workspace (ADR-24).
    #[test]
    fn package_json_and_bundle_declare_gpl_license() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
        let package_json = std::fs::read_to_string(root.join("package.json")).unwrap();
        assert!(
            package_json.contains(r#""license": "GPL-3.0-or-later""#),
            "package.json must declare GPL-3.0-or-later"
        );
        assert_eq!(env!("CARGO_PKG_LICENSE"), "GPL-3.0-or-later");
        assert_eq!(
            context().config().bundle.license.as_deref(),
            Some("GPL-3.0-or-later")
        );
    }

    #[test]
    fn crate_versions_follow_the_workspace_version() {
        for (name, version) in CRATE_VERSIONS {
            assert_eq!(version, env!("CARGO_PKG_VERSION"), "{name}");
        }
    }
}
