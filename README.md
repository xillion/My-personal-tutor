# My Personal Tutor — стартовый комплект для Claude Code

Этот комплект превращает пустой репозиторий в проект, который агенты Claude Code ведут по
задачам: с ADR, спецификациями, роадмапом и набором субагентов.

## Содержимое

```
CLAUDE.md                     # главные правила проекта (Claude Code читает автоматически)
docs/00_DECISIONS.md          # ревью исходной концепции + ADR (обязательные решения)
docs/01_ARCHITECTURE.md       # структура, слои, потоки данных, IPC
docs/02_COURSE_FORMAT.md      # формат курса v1: исходники, компилятор mptc, пакет .mpt
docs/03_DATA_MODEL.md         # схема SQLite
docs/04_ROADMAP.md            # фазы и задачи T-xxx с приёмкой и зависимостями
docs/05_TESTING.md            # тест-стратегия, E2E-сценарий MVP, Definition of Done
.claude/agents/               # architect, rust-core, svelte-ui, content-pipeline,
                              # content-author, qa-tester, code-reviewer
.claude/commands/             # /task, /phase-plan, /review, /adr
```

## Как начать

1. Скопируйте содержимое в корень нового репозитория, `git init`, первый коммит.
Подробная инструкция по сборке и запуску на Windows, Linux и macOS — `docs/BUILDING.md`.

2. Установите Rust (stable), Node 24 LTS (см. ADR-23), pnpm, `just`, `cargo-deny`, системные зависимости Tauri 2 для вашей ОС
   (на Windows — ещё PowerShell 7+, `pwsh`: его использует `justfile`). `just` — версии 1.59 и
   новее (рецепты используют атрибут `[env]`). На Linux, кроме зависимостей Tauri, нужны
   заголовки speech-dispatcher и libclang — их требует системный TTS спайков (cargo-feature
   `spikes`), с которой работают `just dev`, `just check` и `just gen`:
   Debian/Ubuntu — `sudo apt install libspeechd-dev libclang-dev`,
   Fedora — `sudo dnf install speech-dispatcher-devel clang`;
   для сборки курсов — `ffmpeg`.
3. Запустите `claude` в корне репозитория.
4. Первый шаг: `/phase-plan Фаза 0` — архитектор сверит план с актуальными версиями библиотек.
5. Затем по порядку: `/task T-000`, `/task T-001` (подзадачи T-001.1–T-001.4), потом параллельно
   `T-002`, `T-003`, `T-005.1`; после T-002 — `T-004.1`, `T-006`, `T-007`, `T-101`
   (каждую — в отдельной сессии и git worktree).
6. После T-004 (спайки) просмотрите отчёт `docs/spikes/…` сами: от него зависят решения по аудио и TTS.

## Ручные контрольные точки для человека

| После | Что проверить |
|-------|---------------|
| T-004 | отчёт спайков: аудио, TTS, перо на ваших устройствах |
| T-107 | качество эталонного контента (переводы, IPA, задачи) |
| T-304 | плавность караоке на реальном устройстве |
| T-407 | пройти сценарий MVP самому и с ребёнком |
