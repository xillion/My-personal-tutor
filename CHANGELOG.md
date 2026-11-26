# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Added
- Инициализация репозитория: `.gitignore`, `.editorconfig`, `CHANGELOG.md`, `LICENSE`
  (GPL-3.0-or-later, ADR-24). (T-000)
- Cargo workspace (edition 2024, resolver 3, Rust 1.100.0): крейты `mpt-core`, `mpt-storage`,
  `mpt-importer`, `mpt-services`, `mptc` (`--version`); линты `unsafe_code = forbid`,
  clippy `unwrap_used`/`expect_used`/`panic`/`dbg_macro`/`todo`. (T-001.1)
- Оболочка Tauri 2 (`src-tauri`, пакет `mpt-app`) + SvelteKit 3 SPA (adapter-static, `ssr = false`,
  TS strict + `noUncheckedIndexedAccess`); identifier `dev.rnd-center.mpt`, CSP и asset scope по
  `01_ARCHITECTURE.md §4a`, capabilities только `core:default`; Node 24 (`.nvmrc`, `.node-version`),
  pnpm 12. (T-001.2)

### Known issues
- `tauri dev`: scoped-стили компонента не применяются до первого HMR (разбор — T-001.3).
- Временные иконки с логотипом Tauri (замена — T-408).
- План Фазы 0 пересмотрен: задачи T-000, T-006, T-007; T-001, T-004, T-005 разбиты на подзадачи;
  ADR-23 (toolchain и версии), ADR-24 (публикация, identifier, лицензия, GStreamer);
  OpenDyslexic как опциональный шрифт (ADR-15).
