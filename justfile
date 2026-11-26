# Рецепты проекта (T-001.4). Список: `just` или `just --list`.
#
# Кроссплатформенность: каждая строка рецепта — одна команда без bash-специфики (без `&&`,
# `$(...)`, `export`, перенаправлений), поэтому одинаково работает в `sh` (Linux/macOS) и в
# PowerShell 7 (Windows). Логика сложнее одной команды — в `scripts/*.mjs` (Node).
# На Windows нужен PowerShell 7+ (`pwsh`); Windows PowerShell 5.1 не поддерживается.
# Аргумент `--` записан как `'--'` для страховки: в кавычках он передаётся как есть во всех оболочках.

set windows-shell := ["pwsh", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]

# Показать список рецептов
default:
    @just --list --unsorted

# Запустить приложение в режиме разработки (tauri dev)
dev:
    pnpm tauri dev

# Собрать приложение и установщики (tauri build)
build:
    pnpm tauri build

# Все проверки, как в CI; останавливается на первой ошибке
check: lint typecheck test gen-check offline licenses

# Отформатировать Rust и фронтенд
fmt:
    cargo fmt --all
    pnpm format

# Проверить форматирование Rust
fmt-check:
    cargo fmt --all --check

# Clippy по всему workspace, предупреждения — ошибки
clippy:
    cargo clippy --workspace --all-targets --locked '--' -D warnings

# Линтеры: rustfmt --check, clippy, Prettier --check, ESLint
lint: fmt-check clippy
    pnpm lint

# Проверка типов фронтенда (svelte-check)
typecheck:
    pnpm check

# Все тесты: cargo test и Vitest
test: test-rust test-js

# Тесты Rust
test-rust:
    cargo test --workspace --locked

# Тесты фронтенда и скриптов (Vitest)
test-js:
    pnpm test

# Сгенерировать src/lib/ipc/bindings.ts (tauri-specta); JSON-схемы — с T-101 (`mptc schema`)
gen:
    cargo run --locked -p mpt-app --bin gen_bindings

# Проверить, что сгенерированные файлы актуальны: после `just gen` в bindings.ts и schemas/
# нет изменений и новых неотслеживаемых файлов (`git status --porcelain`)
gen-check: gen
    node scripts/check-generated.mjs

# Собрать фронтенд и проверить, что в build/ нет внешних URL (ADR-21)
offline:
    pnpm build
    pnpm check:offline

# Проверить лицензии зависимостей Rust и npm (ADR-24)
licenses:
    cargo deny --locked check licenses
    pnpm check:licenses

# E2E-тесты WebdriverIO + tauri-driver (заглушка до T-007)
e2e:
    @echo 'e2e: появится в T-007'

# Собрать эталонные курсы в dist/courses (заглушка до T-107)
course-sample:
    @echo 'course-sample: появится в T-107'
