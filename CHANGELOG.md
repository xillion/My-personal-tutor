# Changelog

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Added
- Инициализация репозитория: `.gitignore`, `.editorconfig`, `CHANGELOG.md`, `LICENSE`
  (GPL-3.0-or-later, ADR-24). (T-000)
- План Фазы 0 пересмотрен: задачи T-000, T-006, T-007; T-001, T-004, T-005 разбиты на подзадачи;
  ADR-23 (toolchain и версии), ADR-24 (публикация, identifier, лицензия, GStreamer);
  OpenDyslexic как опциональный шрифт (ADR-15).
- Cargo workspace (edition 2024, resolver 3, Rust 1.100.0): крейты `mpt-core`, `mpt-storage`,
  `mpt-importer`, `mpt-services`, `mptc` (`--version`); линты `unsafe_code = forbid`,
  clippy `unwrap_used`/`expect_used`/`panic`/`dbg_macro`/`todo`. (T-001.1)
- Оболочка Tauri 2 (`src-tauri`, пакет `mpt-app`) + SvelteKit 3 SPA (adapter-static, `ssr = false`,
  TS strict + `noUncheckedIndexedAccess`); identifier `dev.rnd-center.mpt`, CSP и asset scope по
  `01_ARCHITECTURE.md §4a`, capabilities только `core:default`; Node 24 (`.nvmrc`, `.node-version`),
  pnpm 12. (T-001.2)
- Фронтенд-инструменты: Tailwind v4 (`@theme`), Bits UI, Paraglide 3 (ru/en), шрифты Andika 7.000
  и OpenDyslexic 0.990 локально (OFL-1.1, `static/fonts/SOURCE.md`), ESLint (граница IPC:
  `@tauri-apps/*` только в `src/lib/ipc/`) + Prettier, Vitest + Testing Library, проверка
  офлайн-сборки `pnpm check:offline` (в `just check` — с T-001.4). (T-001.3)
- Журнал известных проблем `docs/KNOWN_ISSUES.md` (уровни S1–S4).

### Fixed
- `tauri dev`: scoped-стили не применялись до первого HMR — обход в `vite.config.ts` (KI-001). (T-001.3)

### Known issues
- См. `docs/KNOWN_ISSUES.md`.
