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
- `justfile` (`just check` = fmt + clippy + lint + svelte-check + тесты + gen-check + офлайн-сборка +
  лицензии), `deny.toml` и `pnpm check:licenses` (ADR-24), CI GitHub Actions на ubuntu-24.04 /
  windows-latest / macos-latest + actionlint; actions закреплены по SHA. CI зелёный на трёх ОС. (T-001.4)

- Типизированный IPC (T-002): `tauri-specta`/`specta` (ADR-23), `AppError`/`AppErrorCode`
  (`app.internal`, `app.invalid_argument`), команды `app_ping`, `app_info`; `just gen` →
  `src/lib/ipc/bindings.ts`, `gen-check` ловит и неотслеживаемые файлы; `src/lib/ipc/client.ts`
  (`call()`, `errorMessage()` с исчерпывающим switch); страница `/dev` (только DEV); проверка
  полноты переводов в `pnpm check` (KI-005); ESLint запрещает импорт `bindings` вне `src/lib/ipc`.

- Стенд платформенных спайков `/dev/spikes` (T-004.1): тестовое аудио AAC/Opus, spike-команды за
  feature `spikes` (медиа, байты медиа по IPC, TTS через крейт `tts`) в отдельном
  `bindings.spikes.ts`; разделы аудио, джиттер, TTS, перо, KaTeX, CSP; отчёт JSON с обезличенными
  путями; `katex-trust.ts` (только `\htmlData`, fallback без исключений); Windows-артефакт CI со
  спайками; `docs/BUILDING.md` (сборка на Windows/Linux/macOS); `docs/06_PROJECT_STRUCTURE.md`.
  Первые результаты на Fedora 44 — `docs/spikes/raw/`.

### Fixed
- Windows: тестовые бинари `mpt-app` падали с STATUS_ENTRYPOINT_NOT_FOUND — манифест приложения
  (Common-Controls v6) теперь встраивается во все цели, а не только в bin. (T-002)
- `prepare` больше не глотает ошибки `svelte-kit sync`/Paraglide (KI-008). (T-001.4)
- `tauri dev`: scoped-стили не применялись до первого HMR — обход в `vite.config.ts` (KI-001). (T-001.3)

### Known issues
- См. `docs/KNOWN_ISSUES.md`.
