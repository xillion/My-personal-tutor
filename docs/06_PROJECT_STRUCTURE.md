# 06. Структура проекта

Карта репозитория: где что лежит, что уже сделано, что появится и в какой задаче.
Архитектурные правила (слои, IPC, безопасность) — в `01_ARCHITECTURE.md`, решения — в
`00_DECISIONS.md`, задачи — в `04_ROADMAP.md`.

Статус: **есть** — код в `main` или в текущей ветке; **план T-xxx** — появится в указанной задаче.
Документ обновляется в той же задаче, которая добавляет, переносит или удаляет модуль.

## Обзор

```
/
├─ crates/            Rust: доменное ядро, хранилище, импорт, сервисы, CLI-компилятор курсов
├─ src-tauri/         Rust: приложение Tauri — команды IPC, состояние, конфигурация окна
├─ src/               Svelte 5: SPA — IPC-клиент, дизайн-система, фичи, маршруты
├─ messages/          Строки UI (Paraglide): ru.json, en.json
├─ static/fonts/      Шрифты Andika и OpenDyslexic (OFL-1.1) с источниками
├─ scripts/           Node-скрипты проверок и подготовки (часть `just check`)
├─ courses/           Исходники эталонных курсов                    (план T-107)
├─ schemas/           JSON Schema формата курса, генерируется        (план T-101)
├─ games/             Исходники мини-игр                             (план T-703)
├─ tests/e2e/         E2E: WebdriverIO + tauri-driver                (план T-007)
├─ docs/              Документация: ADR, архитектура, формат, данные, роадмап, тесты
└─ .github/workflows/ CI: `just check` на Linux, Windows, macOS
```

Поток данных: **Svelte** (рендер и события) → `src/lib/ipc/client.ts` → **IPC Tauri** →
`src-tauri/src/commands/*` (тонкие команды) → крейты `mpt-*` (логика) → DTO обратно в UI.
Правильные ответы и проверка остаются в Rust (CLAUDE.md, правило 6).

## Rust: `crates/`

Cargo workspace (`Cargo.toml`, edition 2024, Rust 1.100 — ADR-23). Зависимости только к
`mpt-core`; `mpt-core` не зависит ни от одного крейта проекта и не делает IO.

| Путь | Статус | Назначение |
|------|--------|------------|
| `crates/mpt-core/` | есть (каркас) | Доменное ядро: детерминированная логика без IO и без Tauri |
| `mpt-core/src/model/` | план T-101 | Типы курса, урока, словаря, упражнений (`serde` + `specta` + `schemars`) |
| `mpt-core/src/markup/`, `tokenize/` | план T-102 | Парсер разметки урока → AST; токенизатор со стабильными ID токенов (ADR-04, ADR-05) |
| `mpt-core/src/validate/` | план T-103 | Валидация курса: ссылки, ID, медиа, коды ошибок |
| `mpt-core/src/quiz/` | план T-401, T-403 | Проверка ответов, сессии квизов и экзаменов (ADR-14) |
| `mpt-core/src/srs/` | план T-402 | Интервальное повторение FSRS, оценка из результата упражнения (ADR-08) |
| `mpt-core/src/cards/` | план T-301 | Карточки слов и терминов для Popover |
| `mpt-core/src/recognize/` | план T-502 | Распознавание рисунков `$Q` (ADR-19) |
| `mpt-core/src/clock.rs` | план T-003 | Трейт `Clock` и фиктивные часы для тестов |
| `crates/mpt-storage/` | есть (каркас) | SQLite (`rusqlite`): `Db::open`, прагмы, миграции, репозитории; `SystemClock` (план T-003) |
| `crates/mpt-importer/` | есть (каркас) | Безопасный импорт `.mpt`: лимиты, zip-slip, sha256, атомарная установка и обновление (план T-201, ADR-18) |
| `crates/mpt-services/` | есть (каркас) | Внешние сервисы: TTS-каскад (T-305), LLM (T-602), SecretStore (T-601), кэши |
| `crates/mptc/` | есть: `--version`, `--help` | CLI-компилятор курсов: `check` (T-103), `build` (T-106), `align` (T-105), `schema` (T-101) |
| `mptc/tests/cli.rs` | есть | Интеграционные тесты бинаря: коды выхода, не-UTF-8 аргументы |

## Rust: `src-tauri/` (пакет `mpt-app`)

Приложение Tauri 2. Lib `mpt_app` + бинарь `my-personal-tutor`. Команды — 5–30 строк:
состояние → сервис → DTO.

| Путь | Статус | Назначение |
|------|--------|------------|
| `src/lib.rs` | есть | `run()` — запуск приложения; `specta_builder()` — единый реестр команд для `run()` и генерации; `export_bindings()` |
| `src/main.rs` | есть | Точка входа: вызывает `run()`, возвращает `ExitCode` |
| `src/error.rs` | есть | `AppError { code, message, details? }`, `AppErrorCode` (`app.internal`, `app.invalid_argument`; новые коды добавляются вместе с командой) |
| `src/commands/mod.rs` | есть | Сбор команд (`collect_commands!`); spike-команды — только с feature `spikes` |
| `src/commands/app.rs` | есть | `app_ping` (эхо), `app_info` (версия, ОС, архитектура, пути данных, время сборки) |
| `src/commands/spike.rs`, `src/spikes.rs` | есть, feature `spikes` | Спайки T-004: копирование тестового аудио, байты медиа, TTS (голоса, речь, скорость). В релиз не попадает |
| `src/commands/{library,reader,vocab,quiz,review,profile,settings,tts,games}.rs` | план T-006, T-201…T-702 | Команды фич |
| `src/state.rs` | план T-006 | `AppState { db, clock, paths }` |
| `src/protocols/mptgame.rs` | план T-701 | Протокол `mptgame://` для песочницы мини-игр (ADR-17) |
| `src/bin/gen_bindings.rs` | есть | `just gen`: пишет `src/lib/ipc/bindings.ts` (без feature) и `bindings.spikes.ts` (с feature `spikes`), без окна |
| `build.rs` | есть | `tauri-build`; время сборки `MPT_BUILT_AT_MS`; манифест Windows для всех целей, включая тесты |
| `tauri.conf.json` | есть | Identifier `dev.rnd-center.mpt`, окно, CSP и asset scope (`01_ARCHITECTURE.md §4a`) |
| `capabilities/default.json` | есть | Права окна: только `core:default` |
| `windows-app-manifest.xml` | есть | Манифест Windows (Common-Controls v6) |
| `spikes/speech.{m4a,ogg}` | есть | Тестовое аудио спайков (собственный синтез, `scripts/make-spike-audio.sh`) |
| `tests/` | есть | Интеграционные тесты контракта ошибок и логики спайков |
| `icons/` | есть (временные) | Иконки шаблона Tauri — заменить до релиза (KI-004, T-408) |

## Фронтенд: `src/` (SvelteKit 3 SPA, Svelte 5 runes)

Конфигурация Kit — в `vite.config.ts` (Kit 3 не читает `svelte.config.js`), импорты — через `#lib/*`.

| Путь | Статус | Назначение |
|------|--------|------------|
| `app.html`, `app.css`, `app.d.ts` | есть | HTML-оболочка, подключение Tailwind и токенов, типы env (`VITE_MPT_SPIKES`) |
| `lib/ipc/bindings.ts` | есть, генерируется | Типизированные команды и DTO из Rust (`just gen`; руками не править) |
| `lib/ipc/bindings.spikes.ts` | есть, генерируется | То же для spike-команд |
| `lib/ipc/client.ts` | есть | `call()` → `{ ok, data } \| { ok, error }`, нормализация ошибок, `errorMessage(code)` с исчерпывающим `switch`, `mediaSrc()`. Единственная точка входа фич в IPC |
| `lib/ipc/spikes.ts` | есть | Обёртки spike-команд (единственный импорт `bindings.spikes.ts`) |
| `lib/ui/tokens.css` | есть | Дизайн-токены Tailwind v4 `@theme`: цвета, шрифт `--font-reading`, размеры, зона нажатия |
| `lib/ui/fonts.css` | есть | `@font-face` Andika и OpenDyslexic; переключение `data-font="dyslexic"` |
| `lib/ui/*` компоненты | план T-005.1 | Button, IconButton, Card, ProgressBar, EmptyState, Toast, Dialog, Sheet, Popover |
| `lib/i18n/locale.ts` | есть | Локаль ru/en: синхронизация `lang`/`dir` на `<html>`, смена языка |
| `lib/paraglide/` | генерируется, не в git | Скомпилированные сообщения Paraglide |
| `lib/features/dev/` | есть | Состояние страницы `/dev`; gate dev-маршрутов (`DEV` или `VITE_MPT_SPIKES`) |
| `lib/features/spikes/` | есть | Стенд T-004: разделы аудио, джиттер, TTS, перо, KaTeX, CSP; отчёт JSON |
| `lib/features/reader/katex-trust.ts` | есть | Безопасный рендер формул KaTeX: разрешён только `\htmlData`; постоянный код для T-302 |
| `lib/features/reader/` (остальное) | план T-302…T-304 | LessonRenderer, Popover карточки, AudioPlayer и караоке |
| `lib/features/{library,vocab,quiz,review,profile,settings,parent-gate}/` | план T-005.3…T-406 | Фичи MVP |
| `lib/features/{canvas,games}/` | план T-501, T-702 | Планшет и песочница игр |
| `routes/+layout.ts` | есть | `ssr = false` (SPA) |
| `routes/+layout.svelte` | есть | Корневой layout: стили, локаль, заголовок окна |
| `routes/+page.svelte` | есть | Стартовая страница (временная) |
| `routes/dev/` | есть, только DEV | Проверка IPC: `app_ping`, `app_info` |
| `routes/dev/spikes/` | есть, DEV или сборка спайков | Стенд платформенных спайков |
| `test/` | есть | Настройка Vitest и хелперы mockIPC |

Граница IPC проверяется ESLint: `@tauri-apps/*` и `bindings*` разрешены только в `src/lib/ipc/`,
`@tauri-apps/api/mocks` — только в тестах.

## Локализация и ресурсы

| Путь | Назначение |
|------|------------|
| `messages/ru.json`, `en.json` | Строки UI; ключи во всех локалях обязаны совпадать (`scripts/check-messages.mjs`) |
| `project.inlang/` | Настройки Paraglide: локали, базовая `ru`, стратегия `localStorage` + `baseLocale` (ADR-20) |
| `static/fonts/andika/`, `opendyslexic/` | woff2 + `OFL.txt`; источники, версии и sha256 — `static/fonts/SOURCE.md` (ADR-15) |

## Сборка, проверки, CI

| Путь | Назначение |
|------|------------|
| `justfile` | Единая точка входа: `dev` (с feature `spikes`), `build`, `build-spikes`, `check`, `gen`, `gen-check`, `fmt`, `lint`, `typecheck`, `test`, `offline`, `licenses`, `e2e` (T-007), `course-sample` (T-107). Windows — PowerShell 7 |
| `scripts/check-generated.mjs` | `gen-check`: сгенерированные файлы не изменены и не появились новые |
| `scripts/check-messages.mjs` | Полнота переводов во всех локалях |
| `scripts/check-no-external-urls.mjs` | Офлайн-сборка: в `build/` нет внешних URL (ADR-21) |
| `scripts/check-release-bundle.mjs` | Релизная сборка: в `build/` нет стенда спайков (страховка Vite-плагина `stubSpikesStandInRelease`) |
| `scripts/check-npm-licenses.mjs` | Лицензии prod-зависимостей npm по allowlist ADR-24 |
| `scripts/prepare.mjs` | `pnpm install`: `svelte-kit sync` и компиляция Paraglide |
| `scripts/make-spike-audio.sh` | Генерация тестового аудио спайков (espeak-ng + ffmpeg) |
| `deny.toml` | `cargo deny check licenses`: allowlist лицензий Rust (ADR-24) |
| `.github/workflows/ci.yml` | `just check` на ubuntu-24.04 / windows-latest / macos-latest; actionlint; Windows-артефакт со спайками |
| `rust-toolchain.toml`, `.nvmrc`, `.node-version` | Версии toolchain: Rust 1.100.0, Node 24 (ADR-23) |
| `eslint.config.js`, `.prettierrc`, `rustfmt.toml`, `clippy.toml` | Линтеры и форматирование |

## Документация: `docs/`

| Файл | Содержание |
|------|------------|
| `00_DECISIONS.md` | ADR — обязательные решения |
| `01_ARCHITECTURE.md` | Слои, потоки данных, IPC-контракт, безопасность WebView |
| `02_COURSE_FORMAT.md` | Формат курса: исходники и скомпилированный пакет |
| `03_DATA_MODEL.md` | БД, миграции, прогресс |
| `04_ROADMAP.md` | Задачи, зависимости, приёмка |
| `05_TESTING.md` | Стратегия тестов, Definition of Done |
| `06_PROJECT_STRUCTURE.md` | Этот документ |
| `BUILDING.md` | Сборка и запуск на Windows, Linux, macOS; артефакты CI |
| `KNOWN_ISSUES.md` | Журнал известных проблем (S1–S4) |
| `spikes/raw/` | Сырые JSON со стенда спайков (Fedora 44 — T-004.1); сводный отчёт — план T-004.2 |

## Служебное

| Путь | Назначение |
|------|------------|
| `CLAUDE.md` | Инструкции для агентов Claude Code |
| `.claude/agents/`, `.claude/commands/` | Профили субагентов и команды `/task`, `/phase-plan`, `/review`, `/adr` |
| `CHANGELOG.md` | Изменения (Keep a Changelog) |
| `LICENSE` | GPL-3.0-or-later (ADR-24) |
