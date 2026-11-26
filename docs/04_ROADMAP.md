# 04. Роадмап и задачи для агентов

Каждая задача рассчитана на одну сессию Claude Code и один PR. Формат задачи:

- **ID / название** — `[ ]` не начата, `[~]` в работе, `[x]` готова (обновляет оркестратор).
- **Агент** — исполнитель; `qa-tester` и `code-reviewer` участвуют во всех задачах по процессу `/task`.
- **Зависит от** — задачи, которые должны быть `[x]`.
- **Размер** — S (до ~300 строк), M (~300–900), L (> 900: перед стартом разбить через `/phase-plan`).
- **Приёмка** — проверяемые условия. Задача не закрывается, пока они не проверены.

Параллельно можно вести задачи без взаимных зависимостей, каждую в своём git worktree.

---

## Фаза 0. Фундамент и снятие рисков

Цель: пустое, но правильно устроенное приложение собирается на трёх ОС; критичные
платформенные риски проверены до написания фич.

План пересмотрен `architect` 2026-11-26 (`/phase-plan Фаза 0`): добавлены T-000, T-006, T-007;
T-001, T-004, T-005 разбиты на подзадачи; команды из T-003 вынесены в T-006, потому что им нужен
`AppError` из T-002. Версии и механизм `just gen` — ADR-23, безопасность WebView — `01_ARCHITECTURE.md §4a`.
Задача с подзадачами закрывается, когда закрыты все её подзадачи и выполнена общая приёмка.
Задачи, где есть человек (T-004.3, Q-вопросы), помечены явно.

### [x] T-000 Инициализация репозитория — оркестратор · S
Зависит от: —
- `git init -b main`; `.gitignore` (`target/`, `node_modules/`, `build/`, `.svelte-kit/`, `dist/`,
  `.mptc-cache/`, `.claude/settings.local.json`, `.claude/.headroom*`), `.editorconfig`,
  `CHANGELOG.md` (Keep a Changelog, раздел `Unreleased`), `LICENSE` (полный текст GPL-3.0, ADR-24).
- Первый коммит: `docs/`, `CLAUDE.md`, `README.md`, `.claude/agents/`, `.claude/commands/`.
- Репозиторий публичный (ADR-24, Q-1). Remote создаёт человек; агент только добавляет его URL
  (`git remote add origin …`) и не пушит без подтверждения.

Приёмка: `git log --oneline main` — ровно 1 коммит; `git status --porcelain` пуст;
`git check-ignore .claude/settings.local.json` печатает путь; `LICENSE` — GPL-3.0.

### [ ] T-001 Каркас монорепозитория — `architect` → `rust-core`, `svelte-ui` · L (разбита на T-001.1–T-001.4)
Зависит от: T-000

Общая приёмка: `just dev` открывает окно; `just check` зелёный локально (Linux) и в CI на
ubuntu/windows/macos. Сборка артефактов на теге перенесена в T-408: до релиза её нечем проверить.

#### [x] T-001.1 Cargo workspace и toolchain — `rust-core` · S
Зависит от: T-000
- `rust-toolchain.toml`, корневой `Cargo.toml` (edition 2024, resolver 3, `[workspace.package]`,
  `[workspace.dependencies]`, `[workspace.lints]`), `rustfmt.toml`, `clippy.toml` — всё по ADR-23;
  `license = "GPL-3.0-or-later"` в `[workspace.package]` (ADR-24).
- Крейты `mpt-core`, `mpt-storage`, `mpt-importer`, `mpt-services` (lib, один тест в каждом) и
  `mptc` (bin, `--version`). Зависимости между крейтами — строго по `01_ARCHITECTURE.md §2`.

Приёмка: `cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings &&
cargo test --workspace` зелёные; `cargo tree -p mpt-core -e normal` не содержит крейтов проекта
и `tauri`; `unwrap()` в не-тестовом коде даёт ошибку clippy с `-D warnings` (проверено один раз
вручную, отражено в PR).

#### [x] T-001.2 Tauri 2 + SvelteKit SPA — `svelte-ui` (+ `rust-core` для `src-tauri`) · M
Зависит от: T-001.1
- Скаффолд `create-tauri-app` (SvelteKit + TS) во временный каталог с переносом в корень;
  версии подняты до ADR-23 (Kit 3, Vite 8, TS 6). `src-tauri` — пакет `mpt-app` в workspace,
  lib + bin (`run()`, `specta_builder()` — заглушка до T-002).
- Добавить `mpt-storage`, `mpt-importer`, `mpt-services` в `[workspace.dependencies]` и в
  `[dependencies]` `mpt-app` (в T-001.1 их нет: cargo 1.100 предупреждает о неиспользуемых
  workspace-зависимостях). Временную dev-зависимость этих крейтов на `mpt-core` перевести в
  `[dependencies]` в первой задаче, где крейт начинает использовать `mpt-core`.
- `adapter-static` с `fallback: 'index.html'`, `src/routes/+layout.ts`: `export const ssr = false`.
  `tsconfig`: `strict`, `noUncheckedIndexedAccess`.
- `tauri.conf.json`: identifier `dev.rnd-center.mpt` (ADR-24; после первого релиза не меняется),
  CSP и asset scope по `01_ARCHITECTURE.md §4a`, capabilities только `core:default`.

Приёмка: `just dev` (или `pnpm tauri dev`, пока нет `justfile`) открывает окно со стартовой
страницей; `pnpm build` создаёт `build/index.html`; `cargo test -p mpt-app` компилируется и
проходит; `capabilities/*.json` не содержат `fs:`/`shell:`; `identifier` = `dev.rnd-center.mpt`;
`package.json` содержит `"license": "GPL-3.0-or-later"`.

#### [ ] T-001.3 Фронтенд-инструменты — `svelte-ui` · M
Зависит от: T-001.2
- Tailwind v4 (`@theme` в `src/lib/ui/tokens.css`), Bits UI, Paraglide 3 (ru — по умолчанию, en),
  одно сообщение `app_title` на стартовой странице.
- Andika (woff2: regular, bold, italic, bold italic) локально в `static/fonts/andika/` вместе с
  `OFL.txt`; подключение через `@font-face`.
- OpenDyslexic (woff2: regular, bold, italic, bold italic) локально в `static/fonts/opendyslexic/`
  с файлом лицензии из официального дистрибутива (ожидается OFL-1.1 — сверить по файлу, не по
  памяти). В PR записать покрытие кириллицы и IPA; стек `font-family: "OpenDyslexic", "Andika"`.
- ESLint flat config + `eslint-plugin-svelte` + Prettier; `no-restricted-imports` для
  `@tauri-apps/api/core` вне `src/lib/ipc/**`; игнор `src/lib/ipc/bindings.ts` и `schemas/`.
- Vitest + jsdom + `@testing-library/svelte`; скрипты `lint`, `check` (svelte-check), `test`.
- Известная проблема из T-001.2: в `tauri dev` при первой загрузке scoped `<style>` компонента не
  применяется (vite-plugin-svelte 7.3 + Vite 8 отдаёт исходник `.svelte` вместо CSS для
  `?svelte&type=style&lang.css`; после первого HMR и в production всё корректно). Разобраться
  (обновление плагина / issue upstream) и проверить на стартовой странице после подключения Tailwind.

Приёмка: `pnpm lint && pnpm check && pnpm test` зелёные; тест Vitest через ESLint Node API:
файл-фикстура с импортом `@tauri-apps/api/core` в `src/lib/features/x/` даёт ошибку, тот же
импорт в `src/lib/ipc/` — нет; тест переключения локали ru/en для `app_title`; в `build/` нет
ссылок на внешние хосты (`rg -n "https?://" build/ --glob '*.{html,css}'` пуст, проверка
встроена в `just check`).

#### [ ] T-001.4 `justfile` и CI — `rust-core` · S
Зависит от: T-001.3
- Рецепты: `dev`, `build`, `test`, `check`, `gen`, `gen-check`, `fmt`, `lint`, `e2e`,
  `course-sample`. До T-002 `gen` — заглушка, которая печатает «нечего генерировать» и возвращает 0;
  `e2e` и `course-sample` — заглушки с указанием задачи (T-007, T-107).
- `just check` = `cargo fmt --check` + clippy `-D warnings` + `cargo test --workspace` +
  `pnpm lint` + `pnpm check` + `pnpm test` + `gen-check` + проверка внешних ссылок (T-001.3).
- Рецепты работают на Windows (`set windows-shell` или кроссплатформенные команды).
- `.github/workflows/ci.yml`: матрица ubuntu-24.04 / windows-latest / macos-latest, системные
  зависимости Tauri по официальному списку prerequisites, кэш cargo и pnpm,
  `pnpm install --frozen-lockfile`, `just check`. Actions — с зафиксированными версиями.
  Репозиторий публичный (ADR-24): матрица из трёх ОС гоняется на каждом PR.
- Проверка лицензий зависимостей (ADR-24): `deny.toml` + `cargo deny check licenses` (инструмент
  `cargo-deny` в CI ставится как бинарь, в бандл не попадает) и проверка лицензий npm-пакетов
  (`pnpm licenses list --prod` + скрипт со списком разрешённых SPDX); обе входят в `just check`.

Приёмка: `just --list` показывает все рецепты; `just check` зелёный на Linux локально;
`actionlint` без ошибок; `cargo deny check licenses` зелёный; после появления remote CI зелёный на трёх ОС. Если remote ещё
нет, задача закрывается с пометкой «CI не прогонялся» в CHANGELOG, а прогон CI становится первым
пунктом следующей задачи.

### [ ] T-002 Типизированный IPC и ошибки — `rust-core` (+ `svelte-ui` для `client.ts`) · M
Зависит от: T-001
- `tauri-specta`, `specta`, `specta-typescript` — точные версии из ADR-23; `specta_builder()`
  в `mpt-app`, бинарь `gen_bindings`; `just gen` пишет `src/lib/ipc/bindings.ts`.
- `AppError`/`AppErrorCode` по `01_ARCHITECTURE.md §4` (коды `app.internal`, `app.invalid_argument`).
- Способ экспорта `i64` как TS `number` (ADR-23) выбран, проверен на поле `AppInfoDto.built_at_ms`
  и описан в `01_ARCHITECTURE.md §4`.
- Команды `app_ping(message: String) -> Result<String, AppError>` (эхо; пустая строка —
  `app.invalid_argument`) и `app_info() -> Result<AppInfoDto, AppError>`
  (`version`, `os`, `arch`, `data_dir`, `courses_dir`, `built_at_ms`).
- `src/lib/ipc/client.ts`: `call()` → `{ ok: true, data } | { ok: false, error }`;
  `errorMessage(code)` — исчерпывающий `switch` по `AppErrorCode` с Paraglide-сообщениями.
- Dev-страница `/dev` (только `import.meta.env.DEV`) с кнопкой `app_ping` и выводом `app_info`.

Приёмка: два подряд `just gen` дают нулевой `git diff`; `just gen-check` входит в `just check`
и падает, если `bindings.ts` устарел (проверено один раз вручную); Rust-тест: `AppError`
сериализуется в `{"code":"app.internal","message":"…"}` без `details`, если их нет;
Vitest + `mockIPC`: `call()` возвращает `ok` для `app_ping` и `error` с типизированным кодом;
добавление варианта в `AppErrorCode` без перевода ломает `pnpm check` (проверено вручную, описано
в PR); под `just dev` кнопка на `/dev` показывает ответ `app_ping`.

### [ ] T-003 Хранилище и миграции — `rust-core` · M
Зависит от: T-001
- `mpt-core::clock` (`Clock`, `FixedClock` для тестов) и `mpt-storage::SystemClock`
  (`01_ARCHITECTURE.md §4`).
- `mpt-storage::Db::open(path)` / `Db::open_in_memory()`: прагмы до миграций, встроенная миграция
  `001_init.sql` из `03_DATA_MODEL.md` (без `PRAGMA` внутри файла).
- Репозитории `profiles` (list без архивных, get, create с uuid v7, update, archive) и `settings`
  (get/set/delete по `(scope, key)`, значение — JSON). Модели профиля — `mpt-core::model::profile`
  (`Profile`, `UiLevel`, `NewProfile`, `ProfilePatch`); правило имени: после trim 1–40 символов,
  без управляющих символов (проверка в `mpt-core`).

Приёмка: `cargo test -p mpt-storage` зелёный и включает тесты: миграции на пустой БД;
повторный `open` той же файловой БД идемпотентен (`user_version` = 1); `Migrations::validate()`;
`foreign_keys` = 1 и `journal_mode` = `wal` на файловой БД; CRUD профилей; архивный профиль не
попадает в list; невалидное имя отвергается; настройки двух профилей изолированы.
`cargo tree -p mpt-storage` не содержит `tauri`.

### [ ] T-004 Платформенные спайки — `svelte-ui` + `rust-core` + `qa-tester` + человек · L (разбита на T-004.1–T-004.4)
Зависит от: T-002

Общая приёмка: отчёт `docs/spikes/2026-12-platforms.md` заполнен для Windows 10 и 11 и Linux
(Ubuntu 24.04 и Fedora); macOS — только автоматические проверки в CI, ручные строки помечены
«не проверено: нет устройства» и перенесены в чек-лист T-408 (ADR-24); по каждому провалу
записано решение (fallback или изменение ADR через `architect`).

#### [ ] T-004.1 Стенд `/dev/spikes` — `svelte-ui` + `rust-core` · M
Зависит от: T-002
- Тестовое аудио: скрипт `scripts/make-spike-audio.sh` (локальный TTS `espeak-ng`/`say` +
  `ffmpeg`) создаёт ~30 с речи в `.m4a` (AAC-LC, моно, 64 kbps) и тот же звук в `.ogg` (Opus) для
  сравнения; файлы коммитятся в `src-tauri/spikes/` (источник — собственный синтез).
- Команды за feature `spikes`: `spike_prepare_media()` копирует файлы в
  `$APPDATA/courses/_spike/` и возвращает пути (проверяется настоящий asset scope из §4a);
  `spike_tts_voices()`, `spike_tts_speak(text, lang, rate)` через крейт `tts`.
- Страница с разделами: (1) аудио через `convertFileSrc` и через Blob URL: play, seek на 50 %,
  событие `ended`, `playbackRate = 0.75` с `preservesPitch`; (2) джиттер `currentTime` в rAF за
  10 с (p50/p95/max, мс); (3) TTS en/ru: список голосов, скорость; (4) `PointerEvent`:
  `pointerType`, диапазон `pressure`, число coalesced-событий; (5) KaTeX с `trust`, разрешающим
  только `\htmlData`, клик по части формулы показывает `data-t`; (6) счётчик нарушений CSP
  (`securitypolicyviolation`). Кнопка «Скопировать результат в JSON».
- Функция `trust` для KaTeX — постоянный код в `src/lib/features/reader/katex-trust.ts`
  (переиспользуется в T-302).

Приёмка: на Linux под `just dev` (с feature `spikes`) все шесть разделов выдают результат;
Vitest: `katex-trust` разрешает `\htmlData` и запрещает `\href`, `\url`, `\includegraphics`,
`\htmlStyle`, `\htmlClass`, `\htmlId`; в релизной сборке без feature `spikes` команды
`spike_*` отсутствуют в `bindings.ts`.

#### [ ] T-004.2 Прогон на Linux и шаблон отчёта — `qa-tester` · S
Зависит от: T-004.1
- Отчёт `docs/spikes/2026-12-platforms.md`: таблица «ОС/дистрибутив × проверка → результат,
  цифры, JSON», версии WebKitGTK/GStreamer.
- Linux: Ubuntu 24.04 (VM или CI-раннер с xvfb — только для проверок без звука) и Fedora
  (машина разработчика). Для AAC записать, какие пакеты GStreamer нужны
  (`gst-plugins-good`, `gst-libav` или аналоги) и есть ли декодер «из коробки».
- Linux: собрать AppImage со встроенным GStreamer (ADR-24) и прогнуть раздел (1) в нём на системе
  **без** установленного декодера AAC (чистая VM или контейнер с удалёнными плагинами).

Приёмка: строки Linux заполнены; для каждого провала описано воспроизведение.

#### [ ] T-004.3 Прогон на Windows — человек (+ `qa-tester` вносит результаты) · S
Зависит от: T-004.2
- Человек запускает debug-артефакт CI с feature `spikes` на Windows 10 и Windows 11 и присылает
  JSON со страницы. Раздел (4) — с планшетом **Ugee M808** (перьевой планшет без экрана): записать
  `pointerType`, диапазон `pressure` и coalesced-события с включённым и выключенным Windows Ink в
  драйвере Ugee. Если повезёт — то же на Linux (Fedora), отдельной строкой.
- macOS: устройства нет (ADR-24) — ручные строки «не проверено», перенос в чек-лист T-408.
- `qa-tester` переносит результаты в отчёт.

Приёмка: строки Windows 10 и 11 заполнены, включая раздел (4) с Ugee M808; строки macOS помечены
«не проверено: нет устройства» с переносом в T-408.

#### [ ] T-004.4 Решения по итогам спайков — `architect` · S
Зависит от: T-004.3
- Каждому провалу — решение: fallback (Blob URL и т. п.) или новый ADR (ADR-12 аудио, ADR-13 TTS,
  ADR-19 перо).
- Подтвердить или пересмотреть бандлинг GStreamer (ADR-24): точная опция конфигурации Tauri
  (по документации), состав плагинов и их лицензии, прирост размера AppImage; зависимости
  пакетов для `.deb`/`.rpm`. Затронутые задачи (T-104, T-304, T-305, T-501)
  получают уточнённую приёмку.
- Если AAC не работает даже в AppImage со встроенным GStreamer или `tts` неработоспособен на одной
  из ОС, задача **останавливается с вопросом человеку** (CLAUDE.md: спайк показал, что подход не
  работает). AAC без системных плагинов — ожидаемо и решается бандлингом, остановки не требует.

Приёмка: в отчёте нет провалов без решения; изменения ADR и роадмапа внесены в том же PR.

### [ ] T-005 Оболочка UI и дизайн-система — `svelte-ui` · L (разбита на T-005.1–T-005.4)
Зависит от: T-001.3

Общая приёмка: навигация работает с клавиатуры; зоны нажатия ≥ 48 px подтверждены E2E-тестом
в реальном WebView (jsdom размеры не считает); выбранный профиль сохраняется между запусками.

#### [ ] T-005.1 Токены и базовые компоненты — `svelte-ui` · M
Зависит от: T-001.3
- `tokens.css`: цвета, типографика (Andika, 18–22 px; токен `--font-reading`, вариант OpenDyslexic
  через `data-font="dyslexic"` на `<html>`, ADR-15), радиусы, отступы; палитра подсветки
  (`--hl-blue`, `--hl-green`, `--hl-orange`, `--hl-purple`, `--hl-red`) в обычном варианте и для
  дальтоников; повышенный контраст; `prefers-reduced-motion` и настройка «без анимаций»
  (атрибут на `<html>`).
- Компоненты в `src/lib/ui`: Button, IconButton, Card, ProgressBar, EmptyState, Toast, Dialog,
  Sheet, Popover (Dialog/Sheet/Popover — на Bits UI). Витрина `/dev/ui` (только DEV).

Приёмка: компонентный тест на каждый компонент (рендер, активация Enter/Space для кнопок,
закрытие Dialog/Sheet/Popover по Esc с возвратом фокуса); тест: при включённом «без анимаций»
у анимируемых компонентов нет transition-классов; тест: `data-font="dyslexic"` меняет
вычисленный `--font-reading`, а у `.katex` шрифт не меняется; строки — только через Paraglide.

#### [ ] T-005.2 Layout и навигация — `svelte-ui` · S
Зависит от: T-005.1
- Маршруты `/courses`, `/vocab`, `/review`, `/settings` с EmptyState; боковая панель при ширине
  ≥ 900 px, нижняя — уже; активный пункт отмечен `aria-current="page"`.

Приёмка: компонентный тест: обход пунктов навигации `Tab`, активация `Enter` меняет маршрут;
тест переключения раскладки по ширине (через `matchMedia`-мок).

#### [ ] T-005.3 Профили и состояние сессии — `svelte-ui` · M
Зависит от: T-005.2, T-006
- Экран выбора профиля (аватарки: собственный набор SVG без внешних лицензий, id совпадают с
  `profiles.avatar`, по умолчанию `fox`) и создания профиля (имя, аватар, уровень UI).
- `session.svelte.ts`: класс `SessionState` (активный профиль, уровень UI), передаётся через
  context. Последний профиль — в настройке `global` / `session.last_profile_id`; при запуске он
  предвыбран, но экран выбора показывается.

Приёмка: Vitest + `mockIPC`: создание профиля вызывает `profile_create` и делает его активным;
ошибка `profile.invalid_name` показывается дружелюбным текстом; при старте вызывается
`settings_get` и предвыбирается последний профиль; ручная проверка: перезапуск `just dev` —
последний профиль предвыбран.

#### [ ] T-005.4 ParentGate и E2E-проверка размеров — `svelte-ui` (+ `qa-tester` для E2E) · S
Зависит от: T-005.1, T-007
- `ParentGate`: пример на умножение двузначного на однозначное, крупная цифровая клавиатура;
  разблокировка на 10 минут (часы инжектируются); после 3 неверных ответов — пауза 30 с.
  Шлюз — UX-барьер для ребёнка, а не защита от атакующего: команды Rust им не закрываются
  (зафиксировать в комментарии компонента).
- E2E-тест на `/dev/ui` и экране профилей: `getBoundingClientRect()` ≥ 48×48 для Button,
  IconButton, пунктов навигации, клавиш ParentGate, аватарок.

Приёмка: Vitest с фиктивными таймерами: верный ответ разблокирует, через 10 мин 1 с блокировка
возвращается; неверный ответ не разблокирует; 3 ошибки → кнопки неактивны 30 с; E2E-тест
размеров зелёный в `just e2e` на Linux.

### [ ] T-006 Команды профилей и настроек — `rust-core` · S
Зависит от: T-002, T-003
- `AppState { db: Mutex<Db>, clock, paths }`; БД `app_data_dir()/mpt.sqlite3` открывается в
  `setup`; ошибка миграции логируется (`tracing`) и даёт `db.migration_failed`.
- Команды (через `spawn_blocking`): `profile_list`, `profile_create`, `profile_update`,
  `profile_archive`, `settings_get(scope, key)`, `settings_set(scope, key, value)`; DTO
  `ProfileDto`; коды `db.failed`, `db.not_found`, `profile.invalid_name`. Затем `just gen`.

Приёмка: команды — тонкие (≤ 30 строк), логика покрыта тестами T-003; `bindings.ts` обновлён,
`just gen-check` зелёный; ручная проверка: после первого запуска файл БД существует по пути
из `app_info.data_dir`; профиль, созданный через `/dev`, виден после перезапуска.

### [ ] T-007 Каркас E2E — `qa-tester` · M
Зависит от: T-002
- WebdriverIO + `tauri-driver` в `tests/e2e/`; `just e2e` собирает debug-бинарь
  (`tauri build --debug --no-bundle`) и запускает тесты.
- Смоук-тест: окно открылось, на `/dev` кнопка `app_ping` показывает ответ.
- Отдельный CI-job `e2e` на ubuntu (xvfb + WebKitWebDriver) и windows (msedgedriver той же версии,
  что WebView2). macOS — только ручной чек-лист (`tauri-driver` не поддерживает macOS).

Приёмка: `just e2e` зелёный на Linux локально; CI-job `e2e` зелёный на ubuntu и windows после
появления remote; шаги установки драйверов описаны в `tests/e2e/README.md`.
Снимает риск E2E-01 (T-407) заранее.

---

## Фаза 1. Модель контента и компилятор курсов

Цель: из исходников эталонного курса собирается валидный `.mpt`.

### [ ] T-101 Доменные модели — `architect` · M
Зависит от: T-001, T-002 (версии `specta` и `just gen` из T-002)
- `mpt-core::model`: Manifest, CourseSource, LexiconEntry (по kind), Rule, CompiledLesson
  (Block/Inline), Timing, QuizItem (tagged union), ExamSpec, AnswerResult.
- `serde` (`deny_unknown_fields` для исходников), `schemars` → `schemas/*.json`, `specta` для DTO.
- Подкоманда `mptc schema --out schemas/`, подключённая к `just gen` (ADR-23).
- Документ `02_COURSE_FORMAT.md` сверен с кодом.

Приёмка: `just gen` генерирует схемы; тесты round-trip (serde) для примеров из `02_COURSE_FORMAT.md`.

### [ ] T-102 Парсер разметки и токенизатор — `rust-core` · L
Зависит от: T-101
- Markdown: `pulldown-cmark` (GFM-таблицы, math) + собственный разбор `[..]{..}` и `::: kind {..}`.
- Токенизатор: `unicode-segmentation` + правила апострофов/дефисов/чисел по языку; разбиение на предложения.
- Присвоение `tid` (`s{N}.w{M}`), инвариант «склейка = исходник».
- Ошибки с позицией `line:col`.

Приёмка: golden-снапшоты для уроков эталонных курсов; тесты токенизатора из `05_TESTING.md`;
`proptest`: на произвольном вводе парсер не паникует.

### [ ] T-103 Валидатор и `mptc check` — `content-pipeline` · M
Зависит от: T-102
- Все правила из `02_COURSE_FORMAT.md §2`; ошибки и предупреждения с кодами.
- CLI `mptc check <dir>` с человекочитаемым выводом и `--json`.

Приёмка: набор «плохих» курсов в `crates/mptc/tests/fixtures/bad-*`, каждый даёт ожидаемый код ошибки.

### [ ] T-104 Медиа-конвейер — `content-pipeline` · M
Зависит от: T-103
- ffmpeg: аудио → AAC `.m4a` моно, нормализация громкости; изображения → webp/png с ограничением размера.
- Контент-адресуемые имена, кэш в `.mptc-cache/` (не перекодировать неизменённое).
- Понятная ошибка, если `ffmpeg` не найден.

Приёмка: повторная сборка без изменений не вызывает ffmpeg; результат проигрывается в спайке T-004.

### [ ] T-105 Выравнивание `mptc align` — `content-pipeline` · M
Зависит от: T-102
- Адаптер внешнего выравнивателя (команда из `mptc.toml`), парсинг его JSON.
- Сопоставление слов с токенами (выравнивание последовательностей), интерполяция, `timings.override.yaml`.
- Отчёт о покрытии; порог отказа.
- Тест с фиктивным выравнивателем (заранее записанный JSON с «чужой» токенизацией).

Приёмка: покрытие ≥ 95% на фикстуре с `don't`, числами и дефисами.

### [ ] T-106 Сборка пакета `mptc build` — `content-pipeline` · S
Зависит от: T-103, T-104, T-105
- Сборка `.mpt` по `02_COURSE_FORMAT.md §3`, sha256 файлов, `content_hash`, детерминированный zip
  (фиксированный порядок и время в записях).

Приёмка: две сборки одного источника побайтно совпадают.

### [ ] T-107 Эталонные курсы — `content-author` · M
Зависит от: T-103 (для проверки; писать можно с T-101)
- `courses/sample-en`: 2 урока (теория + reading с аудио + practice), ≥ 20 слов, 3 фразы,
  4 правила чтения, вопросы всех типов MVP, 1 minor-экзамен.
- `courses/sample-math`: 1 урок (дроби или кинетическая энергия): формулы с `\htmlData`,
  6 терминов, `numeric` и `single_choice`.
- Аудио: синтез TTS для разработки (лицензия зафиксирована в `courses/*/LICENSE.md`).
- `just course-sample` собирает оба пакета в `dist/courses/`.

Приёмка: `mptc check` без ошибок; содержание соответствует возрасту 8–11 лет (чек-лист в описании агента).

---

## Фаза 2. Импорт и библиотека

### [ ] T-201 Импортёр — `rust-core` · L
Зависит от: T-003, T-106
- `mpt-importer`: лимиты, zip-slip, проверка манифеста и хэшей, атомарная установка,
  обновление с сохранением прогресса (ADR-18), удаление (retire).
- Команды `library_import(path)` с событиями прогресса, `library_list`, `library_remove`.

Приёмка: все тесты импорта из `05_TESTING.md`; импорт эталонного курса < 2 с.

### [ ] T-202 Экран библиотеки — `svelte-ui` · M
Зависит от: T-005, T-201
- Импорт через `tauri-plugin-dialog` (за ParentGate), карточки курсов, список уроков с прогрессом,
  удаление, пустое состояние, ошибки импорта человеческим языком.

Приёмка: компонентные тесты с `mockIPC`; ручная проверка импорта обоих эталонных пакетов.

### [ ] T-203 Dev-режим авторов — `content-pipeline` + `svelte-ui` · M (можно отложить)
Зависит от: T-201, T-302
- Настройка «Режим автора»: открыть папку исходников; `mpt-core` компилирует на лету,
  file watcher перезагружает открытый урок; ошибки валидации — панелью поверх урока.

---

## Фаза 3. Умная читалка

### [ ] T-301 Команды чтения — `rust-core` · S
Зависит от: T-201
- `reader_get_lesson` (AST без ответов квизов, абсолютные пути медиа), `reader_get_entry(uid)`
  (EntryCard + статус в словаре профиля), `progress_update`.

### [ ] T-302 LessonRenderer — `svelte-ui` · L
Зависит от: T-301
- Рендер всех типов блоков и инлайнов; токены — `<span data-tid>`; подсветка палитрой;
  `lang` на спанах; KaTeX (math и math_block, `\htmlData` → кликабельно); таблицы, изображения.
- Клик/тап/Enter по токену → событие `tokenActivate(ref | tid)`.

Приёмка: снапшот-тесты рендера эталонных уроков; бюджет 2000 токенов < 200 мс (бенчмарк в Vitest).

### [ ] T-303 Карточка элемента (Popover) — `svelte-ui` · M
Зависит от: T-302
- Слово: перевод, IPA, правило с подсветкой букв (`pattern`), пример, кнопка «Послушать»,
  кнопка «Изучать / В словаре». Термин/формула: определение, символ, единицы, формула.
- На узком экране — нижний Sheet вместо Popover.

### [ ] T-304 AudioPlayer и караоке — `svelte-ui` · M
Зависит от: T-302, T-004
- Класс `AudioPlayer` (play/pause/seek/rate, rAF, бинарный поиск), подсветка без ре-рендера,
  click-to-seek, режим shadowing, клавиши (пробел, ←/→ по предложениям).
- Fallback на Blob URL по результатам T-004.

Приёмка: unit-тесты поиска; тест с фейковыми часами: правильная последовательность активных
`tid`; ручная проверка — плавность на трёх ОС.

### [ ] T-305 TTS-каскад — `rust-core` · M
Зависит от: T-301, T-004
- `mpt-services::tts`: трейт, `CourseAudioProvider`, `SystemTtsProvider` (`tts`), выбор голоса по `lang`.
- Команды `tts_speak(text | uid, lang, rate)`, `tts_stop`, `tts_voices`; событие `tts_state`.

Приёмка: слово с аудио в курсе играет файл; без аудио — системный голос; нет голоса для языка —
`AppError tts.no_voice` и предупреждение в настройках.

---

## Фаза 4. Словарь, SRS, квизы — закрытие MVP

### [ ] T-401 Проверка ответов — `rust-core` · M
Зависит от: T-101
- `mpt-core::quiz::check_answer` для всех типов MVP, нормализация, `numeric` с допуском.
- Генерация `QuizItem` из карточки (`mpt-core::cards`) для шаблонов `recognize`, `recall`,
  `listen`, `formula_meaning`, `meaning_formula` (дистракторы — из того же курса и kind).

Приёмка: табличные тесты; детерминированность генерации при фиксированном seed.

### [ ] T-402 SRS-движок — `rust-core` · M
Зависит от: T-003, T-401
- Обёртка над `fsrs`, `rating_from_outcome` (ADR-08), дневные лимиты, очередь сессии с повтором ошибок.
- Репозитории `vocab`, `cards`, `review_log`; трейт `Clock`.
- Команды `vocab_add/remove/list`, `review_stats`, `review_next`, `review_answer`.

Приёмка: симуляция 30 дней (см. `05_TESTING.md`); изоляция профилей.

### [ ] T-403 Сессии квизов и экзамены — `rust-core` · M
Зависит от: T-401, T-201
- `quiz_start/answer/finish` для урока и экзамена (`ExamSpec`: пулы, seed, pass_ratio, таймер),
  запись `quiz_attempts`, `exam_results`, `lesson_progress.best_score`.
- Ответы клиенту до проверки не отдаются.

### [ ] T-404 QuizRunner — `svelte-ui` · L
Зависит от: T-403, T-005
- Реестр типов: `type → компонент`; компоненты: SingleChoice, MultiChoice, TypeAnswer,
  Assemble (тап по плиткам, не только drag), MatchPairs, Numeric (крупная цифровая клавиатура),
  ListenChoose.
- Подсказка, вторая попытка, обратная связь (звук + анимация), экран итогов.
- Добавление нового типа = новый компонент + строка в реестре (задокументировать в `src/lib/features/quiz/README.md`).

Приёмка: компонентный тест на каждый тип; полный квиз эталонного урока проходится мышью и клавиатурой.

### [ ] T-405 Словарь и повторение (UI) — `svelte-ui` · M
Зависит от: T-402, T-404, T-303
- Экран «Словарь»: фильтры по kind/курсу, поиск, уровни усвоения (визуальная метафора: росток → дерево).
- Экран «Тренировка»: сколько карточек на сегодня, сессия через QuizRunner, итоги.
- Кнопка «Изучать» из T-303 подключена к `vocab_add`.

### [ ] T-406 Профили: экспорт/импорт прогресса и настройки — `rust-core` + `svelte-ui` · M
Зависит от: T-402
- Экспорт/импорт JSON (`03_DATA_MODEL.md`), за ParentGate.
- Экран настроек: уровень UI, скорость речи, лимиты SRS, контраст, анимации, шрифт (Andika / OpenDyslexic, ADR-15), язык UI.

### [ ] T-407 E2E MVP — `qa-tester` · M
Зависит от: T-202, T-304, T-305, T-405, T-406
- WebdriverIO + `tauri-driver`, сценарий E2E-01 из `05_TESTING.md`, запуск в CI (Linux, Windows).
- `docs/qa/manual-checklist.md` для macOS и для аудио/TTS на всех ОС.

Приёмка: E2E-01 зелёный в CI. **→ Релиз 0.1 (MVP).**

### [ ] T-408 Релизная сборка 0.1 — `architect` · S
Зависит от: T-407
- Подписанные сборки (по возможности), `tauri-plugin-updater` (выключен по умолчанию),
  CI-сборка установщиков на теге (перенесено из T-001); собственные иконки приложения вместо
  временного логотипа Tauri из шаблона (`src-tauri/icons/`, T-001.2); Linux — AppImage со встроенным
  GStreamer (ADR-24), `.deb`/`.rpm` с зависимостями на декодер AAC,
- ручной прогон спайков T-004 и смоук-чек-листа на macOS (ADR-24: до релиза нужно устройство
  или доступ к нему; без прогона macOS-сборка помечается «экспериментальная»),
  README для родителей, известные ограничения.

---

## Фаза 5. Планшет и распознавание

### [ ] T-501 StylusCanvas — `svelte-ui` · M
Зависит от: T-404
- PointerEvents (перо/мышь/палец), coalesced events, `pressure`, `perfect-freehand`,
  отмена штриха, очистка, `touch-action: none`, игнорирование ладони (`pointerType`).

### [ ] T-502 Распознаватель $Q — `rust-core` · M
Зависит от: T-101
- `mpt-core::recognize`: нормализация, $Q, `recognize(strokes, templates) → [(label, score)]`.
- Формат `templates/*.json` в курсе и в компиляторе; набор шаблонов фигур и цифр в эталонном курсе.

Приёмка: точность ≥ 90% на записанном наборе образцов (фикстуры от `qa-tester`).

### [ ] T-503 Новые типы заданий — `svelte-ui` + `rust-core` · M
Зависит от: T-501, T-502
- `draw_shape`, `trace` (прописи), `color_region` (Worker считает покрытие) — без изменений
  читалки и словаря, только регистрация в реестре QuizRunner и ветки в `check_answer`.

---

## Фаза 6. ИИ и облачный TTS (опционально, за ParentGate)

### [ ] T-601 SecretStore и настройки провайдеров — `rust-core` + `svelte-ui` · S
### [ ] T-602 LLM-клиенты — `rust-core` · M
OpenAI-совместимый (в том числе Ollama), Anthropic; таймауты, ретраи, лимиты, отмена.
### [ ] T-603 Генератор квизов — `rust-core` · M
Зависит от: T-602, T-402
Выбор слабых элементов, промпты по предмету и уровню, JSON Schema, валидация и пост-фильтры
(ADR-16), кэш, `ai_items`, жалоба родителя. Без ключа — только квизы курса.
Приёмка: тесты на записанных ответах модели (валидные, невалидные, частично валидные).
### [ ] T-604 Облачный TTS + кэш — `rust-core` · S

---

## Фаза 7. Мини-игры

### [ ] T-701 Протокол GameBridge v1 и `mptgame://` — `architect` + `rust-core` · M
### [ ] T-702 GameSandbox и запись результатов — `svelte-ui` + `rust-core` · M
### [ ] T-703 Первая игра «Робот» (английский) — `svelte-ui` · M
Отдельный Vite-проект в `games/robot`, PixiJS, собирается в пакет курса.
### [ ] T-704 Тест безопасности песочницы — `qa-tester` + `code-reviewer` · S
Приёмка: из iframe недоступны parent DOM, `__TAURI_INTERNALS__`, сеть; невалидные сообщения отбрасываются.

---

## Фаза 8. Мобильные платформы

### [ ] T-801 Android: сборка, импорт через share-intent, аудио, перо — `rust-core` + `svelte-ui` · L
### [ ] T-802 iPadOS: сборка, Apple Pencil, импорт из «Файлов» — `rust-core` + `svelte-ui` · L
### [ ] T-803 SecretStore для mobile — `rust-core` · S

---

## Бэклог (не планировать без решения владельца)

Подпись пакетов курсов · синхронизация между устройствами · оптимизация параметров FSRS по
`review_log` · пословная подсветка для облачного TTS с таймкодами · редактор курсов с GUI ·
каталог курсов онлайн · вторая мини-игра «Пушка» (Matter.js) · отчёты для родителей.

## Граф зависимостей (критический путь MVP)

```
T-000 ─ T-001 (.1 → .2 → .3 → .4)
          ├─ T-002 ─┬─ T-004 (.1 → .2 → .3 → .4) ───────────────────┐
          │         ├─ T-007 ───────────────────┐                   │
          │         └─ T-101 ─┬─ T-102 ─┬─ T-103 ─┬─ T-104 ─┐       │
          │                   │         │         └─ T-107  │       │
          │                   │         └─ T-105 ───────────┴─ T-106 ─ T-201 ─┬─ T-202
          │                   └─ T-401 ─┬─ T-402 ─┐                           ├─ T-301 ─ T-302 ─┬─ T-303
          │                             └─ T-403 ─┴─ T-404 ─ T-405 ─┐         │                 └─ T-304
          ├─ T-003 ─ T-006 (+T-002) ─┐                              │         └─ T-305
          └─ T-005.1 ─ T-005.2 ─ T-005.3 (+T-006) ; T-005.4 (+T-007)
                                     T-406 ─────────────────────────┴─ T-407 ─ T-408
```
T-304 и T-305 дополнительно зависят от T-004; T-202 и T-404 — от T-005.

Хорошие точки распараллеливания: после T-001 — {T-002, T-003, T-005.1}; после T-002 —
{T-004.1, T-006 (когда готов T-003), T-007, T-101}; {T-103…T-107} параллельно с {T-005, T-401, T-402};
{T-302…T-305} параллельно с {T-403, T-404}. T-004.3 ждёт человека — не блокируйте им Фазу 1.
