# 01. Архитектура

Модульный монолит: Rust владеет данными, правилами и проверками, Svelte рисует готовые модели и
отправляет события. Решения и их обоснования — в `00_DECISIONS.md`.

## 1. Структура репозитория

Целевая структура. Подробная карта модулей с текущим статусом и задачами — `06_PROJECT_STRUCTURE.md`.

```
/
├─ CLAUDE.md
├─ justfile                      # единая точка входа для команд
├─ Cargo.toml                    # workspace
├─ package.json / vite.config.ts   # SvelteKit 3: конфиг Kit в vite.config.ts
├─ crates/
│  ├─ mpt-core/                  # домен, без IO и без Tauri
│  │  └─ src/{model,markup,tokenize,validate,quiz,srs,recognize,cards}/
│  ├─ mpt-storage/               # rusqlite, migrations/, repo/
│  ├─ mpt-importer/              # unzip, verify, install, update
│  ├─ mpt-services/              # tts/, llm/, secrets/, cache/ (feature-gated)
│  └─ mptc/                      # CLI: check | build | align | watch
├─ src-tauri/
│  ├─ src/commands/{app,library,reader,vocab,quiz,review,profile,settings,tts,games}.rs
│  ├─ src/state.rs               # AppState: db, paths, providers
│  ├─ src/error.rs               # AppError -> serde
│  ├─ src/protocols/mptgame.rs   # протокол для мини-игр (Фаза 7)
│  └─ capabilities/*.json
├─ src/                          # SvelteKit SPA
│  ├─ lib/ipc/                   # bindings.ts (generated) + client.ts (обёртки, обработка AppError)
│  ├─ lib/ui/                    # дизайн-система: Button, Card, Sheet, Popover, tokens.css
│  ├─ lib/features/
│  │  ├─ library/  reader/  player/  vocab/  quiz/  review/
│  │  ├─ profile/  settings/  parent-gate/
│  │  ├─ canvas/   (Фаза 5)     games/ (Фаза 7)
│  ├─ lib/i18n/                  # Paraglide messages
│  └─ routes/                    # +layout.ts: export const ssr = false
├─ courses/                      # исходники эталонных курсов
│  ├─ sample-en/  sample-math/
├─ games/                        # исходники мини-игр (отдельные Vite-проекты)
├─ schemas/                      # JSON Schema (генерируется из mpt-core)
├─ tests/e2e/                    # WebdriverIO + tauri-driver
└─ docs/
```

## 2. Слои и зависимости

```
Svelte features ──> lib/ipc (generated) ──IPC──> src-tauri commands
                                                   │
                         ┌─────────────────────────┼───────────────────────┐
                         ▼                         ▼                       ▼
                   mpt-storage               mpt-importer             mpt-services
                         │                         │                       │
                         └──────────────> mpt-core <───────────────────────┘
                                             ▲
                                           mptc (CLI)
```

Правила:
- `mpt-core` не зависит ни от одного другого крейта проекта и не делает IO (кроме чтения байтов,
  переданных вызывающим). Всё в нём детерминировано и покрыто unit-тестами.
- Команда Tauri — 5–30 строк: достать состояние → вызвать сервис → вернуть DTO. Логики в командах нет.
- Фичи фронтенда не импортируют друг друга напрямую; общее — через `lib/ui` и `lib/ipc`.

## 3. Ключевые потоки данных

### 3.1 Импорт курса
```
UI: диалог выбора файла (tauri-plugin-dialog) → path
 → cmd import_course(path)
   → importer::open(path) → limits + zip-slip checks
   → verify manifest (format_version, min_app_version, sha256)
   → extract to tmp → validate compiled JSON against mpt-core types
   → atomic rename → storage: upsert course, lessons, content_items (retire missing)
 ← CourseSummary | AppError{code: "import.*"}
```

### 3.2 Открытие урока
```
cmd get_lesson(course_id, lesson_id) → CompiledLesson (AST + абсолютные пути медиа)
UI: LessonRenderer рендерит блоки; токены — <span data-tid="s0.w1">
cmd get_entry(uid) по клику → EntryCard (перевод, IPA, правила, примеры, статус в словаре)
```

### 3.3 Караоке
```
AudioPlayer (Svelte 5 class, .svelte.ts):
  src = convertFileSrc(lesson.audio.path)  (fallback: Blob URL)
  rAF loop: t = audio.currentTime → binarySearch(timeline, t) → activeTid
  при смене activeTid: снять класс с предыдущего span, поставить на новый (без ре-рендера дерева)
  click(span) → audio.currentTime = token.t[0]
  shadowing: пауза на sentence.end, продолжение по кнопке или пробелу
```
`timeline` — плоский отсортированный массив `{start, end, tid}`, строится один раз при загрузке урока.

### 3.4 Изучение и повторение
```
"Изучать" → cmd vocab_add(profile, uid) → создаются cards по шаблонам kind
Повторение: cmd review_next(profile) → ReviewItem { card_id, quiz: QuizItem }
            cmd review_answer(card_id, answer, meta{duration_ms, hints, attempt})
              → core::check_answer → core::srs::rating_from_outcome → fsrs → update card, log
            ← AnswerResult { correct, expected, explanation, next_due }
```

### 3.5 Квиз урока / экзамен
```
cmd quiz_start(lesson | exam_id, seed) → QuizSession { items: QuizItem[] (без правильных ответов!) }
cmd quiz_answer(session_id, item_id, answer, meta) → AnswerResult
cmd quiz_finish(session_id) → QuizSummary
```
**Правильные ответы не уходят во фронтенд до ответа** — проверка только в Rust.

## 4. IPC-контракт

- Все команды объявлены через `#[tauri::command] #[specta::specta]` и собираются в
  `src-tauri/src/commands/mod.rs`. Генерация — `just gen`.
- Нейминг: `domain_verb` (`library_import`, `vocab_add`, `review_next`).
- DTO — отдельные структуры (`*Dto`), а не внутренние модели хранилища.
- Ошибки: `AppError { code: AppErrorCode, message: String, details: Option<serde_json::Value> }`,
  где `AppErrorCode` — enum с точечной иерархией (`import.zip_slip`, `import.bad_manifest`,
  `db.not_found`, `quiz.session_expired`…). Тексты для пользователя UI берёт из i18n по `code`.
- События (Rust → UI): `import_progress`, `tts_state`, `course_installed`.
- Сериализация `AppErrorCode`: каждый вариант — `#[serde(rename = "domain.reason")]`, в TS это
  union строковых литералов. `client.ts` сопоставляет код с i18n-сообщением через исчерпывающий
  `switch` (проверка `never`), поэтому новый код без перевода ломает `pnpm check`.
- Стартовый набор кодов (Фаза 0): `app.internal`, `app.invalid_argument` (T-002);
  `db.failed`, `db.not_found`, `db.migration_failed`, `profile.invalid_name` (T-006).
  Новые коды добавляются вместе с командой, которой они нужны.
- Результат команды в TS — `{ status: "ok", data } | { status: "error", error: AppError }`
  (`tauri-specta`); `client.ts` превращает его в `{ ok: true, data } | { ok: false, error }`.
- Генерация, версии и правило чисел в DTO (≤ 2^53, время — unix ms как `number`) — ADR-23.
- **`i64` → TS `number` (T-002):** `specta-typescript` 0.0.15 запрещает экспорт `i64`/`u64`/
  `usize`/`i128` (ошибка `BigIntForbidden`). Каждое такое поле DTO аннотируется явно:
  `#[specta(type = specta_typescript::Number)] pub built_at_ms: i64` (для `Option<i64>` —
  `#[specta(type = Option<specta_typescript::Number>)]`). Глобальный
  `Builder::dangerously_cast_bigints_to_number()` **не используется**: неаннотированное поле
  должно ронять `just gen`, а аннотация отмечает место, где действует правило «≤ 2^53».
- **Поля DTO в IPC — `camelCase`** (`#[serde(rename_all = "camelCase")]` на каждом `*Dto`):
  так же Tauri именует аргументы команд, в TS — `builtAtMs`, `dataDir`. Имена команд в
  `bindings.ts` — camelCase (`commands.appPing`), IPC-имя — snake_case (`app_ping`).
- **`AppError.details`** в TS — `unknown` (`#[specta(type = Option<specta_typescript::Unknown>)]`):
  `serde_json::Value` содержит `i64`/`u64` и не экспортируется; форма деталей зависит от кода,
  `client.ts` сужает её сам. Поле отсутствует в JSON, если деталей нет (в TS `details?: unknown | null`).
- **Без serde-фаз:** builder вызывает `disable_serde_phases()`, иначе тип с
  `skip_serializing_if` раздваивается на `X_Serialize`/`X_Deserialize`, а `X` становится их union.
  Единый тип описывает обе стороны: поля, которые различаются по фазам, становятся `?:`/`| null`.
- **Пути в DTO** — строки (`to_string_lossy`), только для отображения и `convertFileSrc`.
- **`just gen`** = `cargo run --locked -p mpt-app --bin gen_bindings`: бинарь вызывает
  `mpt_app::export_bindings()` (тот же `specta_builder()`, что в `run()`), окно не создаёт.
  `just gen-check` = `just gen` + `node scripts/check-generated.mjs`: пустой
  `git status --porcelain -- src/lib/ipc/bindings.ts schemas/` (видит и неотслеживаемые файлы).
- **Спайк-команды (`spike_*`, T-004.1)** — за cargo-feature `spikes` (§4a). `bindings.ts`
  генерируется без неё и `spike_*` не содержит никогда; второй запуск `just gen`
  (`--features spikes`) пишет только `src/lib/ipc/bindings.spikes.ts` (спайк-команды и их типы,
  своя копия `AppError`; новых `AppErrorCode` спайк не вводит). Оба файла коммитятся и
  проверяются `gen-check`; `bindings.spikes.ts` импортирует только `src/lib/ipc/spikes.ts`.
- Пакет `src-tauri` называется `mpt-app` (lib + bin): `lib.rs` содержит `run()` и
  `specta_builder()`, `src/bin/gen_bindings.rs` экспортирует bindings без запуска окна.
- `Clock`: трейт `mpt_core::clock::Clock { fn now_ms(&self) -> i64 }` и фиктивные часы для тестов —
  в `mpt-core`; `SystemClock` — в `mpt-storage` (первый потребитель с IO). Вводится в T-003.

## 4a. Безопасность WebView (Фаза 0)

- Capabilities окна `main`: только `core:default` и плагины, которые явно нужны фиче
  (`dialog` — с T-202). `fs` и `shell` не выдаются (ADR-11).
- Asset protocol включён, `scope`: `["$APPDATA/courses/**"]`.
- Стартовая CSP (`app.security.csp`; T-004 подтверждает или уточняет):
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' asset: http://asset.localhost data: blob:;
  media-src 'self' asset: http://asset.localhost blob:; font-src 'self' data:;
  connect-src ipc: http://ipc.localhost; object-src 'none'; frame-src 'none'`.
  `'unsafe-inline'` в `style-src` нужен KaTeX (inline-стили); `unsafe-eval` запрещён.
  `frame-src` расширяется для `mptgame:` только в Фазе 7.
- В `tauri dev` на десктопе CSP не применяется (WebView грузит `devUrl` напрямую). Проверки CSP
  (спайки T-004, E2E T-007) выполняются на сборке `tauri build --debug`, а не только в dev.
- Dev-маршруты (`/dev`, `/dev/spikes`, `/dev/ui`) доступны только при `import.meta.env.DEV`;
  исключение — `/dev/spikes` открывается и в сборке `just build-spikes` (`VITE_MPT_SPIKES=1`,
  `src/lib/features/dev/gate.ts`), чтобы проверять спайки под настоящей CSP; в `pnpm build` — 404.
  Спайк-команды Rust — за cargo-feature `spikes`, выключенной по умолчанию и в релизе.

## 5. Состояние фронтенда

- Svelte 5 runes. Состояние фичи — класс в `*.svelte.ts` (`class ReaderState { lesson = $state(...) }`),
  инстанс создаётся в компоненте-странице и передаётся через context.
- Глобальное: `session` (активный профиль, уровень UI, parentUnlocked с таймаутом), `settings`.
- Сетевых и файловых вызовов в компонентах нет — только методы state-классов, которые вызывают `lib/ipc`.

## 6. Дизайн-система для детей

- Токены в `lib/ui/tokens.css` (Tailwind v4 `@theme`): цвета палитры подсветки (`--hl-blue`…)
  в двух вариантах — обычный и для дальтоников.
- Минимальная зона нажатия 48 px; основной шрифт 18–22 px; Andika, опционально OpenDyslexic
  (ADR-15): токен `--font-reading`, переключается атрибутом `data-font` на `<html>`.
- Компоненты на Bits UI (Popover, Dialog, Tabs, Tooltip), стилизованные под детский UI.
- Навигация: боковая панель при ширине ≥ 900 px, нижняя панель — уже.
- Обратная связь: звук + анимация на верный и неверный ответ; всё отключаемо.

## 7. Платформенные абстракции

| Трейт | Desktop MVP | Позже |
|-------|-------------|-------|
| `SecretStore` | `keyring` | mobile secure storage plugin |
| `TtsProvider` | course audio, `tts` (system) | cloud + cache |
| `LlmProvider` | — | OpenAI-compatible, Anthropic, Ollama |
| `Clock` | system | fake в тестах (SRS, сессии) |

## 8. Нефункциональные бюджеты

| Метрика | Бюджет |
|---------|--------|
| Холодный старт до экрана профилей | < 2 с |
| Рендер урока на 2000 токенов | < 200 мс |
| Кадр караоке (смена активного токена) | < 4 мс |
| Импорт курса 50 МБ | < 10 с, с прогрессом |
| Установщик desktop | < 25 МБ (без курсов) |
| JS-бандл (gzip) | < 400 КБ без KaTeX-шрифтов |
