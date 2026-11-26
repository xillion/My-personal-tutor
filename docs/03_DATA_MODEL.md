# 03. Модель данных (SQLite)

`rusqlite` + `rusqlite_migration` (ADR-09). Время — `INTEGER` unix ms (UTC). JSON — `TEXT`.
Миграции: `crates/mpt-storage/migrations/NNN_name.sql`, только вперёд.

## 001_init.sql (стартовая схема)

```sql
-- PRAGMA здесь не пишутся: rusqlite_migration выполняет миграцию в транзакции, где
-- `PRAGMA foreign_keys` не действует. Прагмы ставит Db::open (см. «Правила»).

CREATE TABLE profiles (
  id            TEXT PRIMARY KEY,                 -- uuid v7
  display_name  TEXT NOT NULL,
  avatar        TEXT NOT NULL DEFAULT 'fox',
  ui_level      TEXT NOT NULL DEFAULT 'middle' CHECK (ui_level IN ('junior','middle','senior')),
  created_at    INTEGER NOT NULL,
  archived_at   INTEGER
);

CREATE TABLE settings (
  scope       TEXT NOT NULL,                      -- 'global' | profile_id
  key         TEXT NOT NULL,
  value_json  TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE TABLE courses (
  id              TEXT PRIMARY KEY,               -- manifest.id
  version         TEXT NOT NULL,
  format_version  INTEGER NOT NULL,
  title_json      TEXT NOT NULL,
  subject         TEXT NOT NULL,
  content_lang    TEXT,
  content_hash    TEXT NOT NULL,
  install_path    TEXT NOT NULL,
  manifest_json   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'installed' CHECK (status IN ('installed','removed')),
  installed_at    INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE lessons (
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  ord         INTEGER NOT NULL,
  title_json  TEXT NOT NULL,
  file        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  PRIMARY KEY (course_id, id)
);

CREATE TABLE content_items (
  uid         TEXT PRIMARY KEY,                   -- course_id/entry_id
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  entry_id    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('word','phrase','term','formula','constant','law','definition')),
  lang        TEXT,
  headword    TEXT NOT NULL,                      -- для поиска
  data_json   TEXT NOT NULL,                      -- полная запись lexicon
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired'))
);
CREATE INDEX idx_items_course ON content_items(course_id);
CREATE INDEX idx_items_headword ON content_items(headword);

CREATE TABLE item_aliases (                       -- миграция переименованных ID
  old_uid  TEXT PRIMARY KEY,
  new_uid  TEXT NOT NULL REFERENCES content_items(uid) ON DELETE CASCADE
);

CREATE TABLE vocab (                              -- «активный словарь» профиля
  profile_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_uid       TEXT NOT NULL REFERENCES content_items(uid) ON DELETE CASCADE,
  added_at       INTEGER NOT NULL,
  source_lesson  TEXT,
  PRIMARY KEY (profile_id, item_uid)
);

CREATE TABLE cards (
  id            INTEGER PRIMARY KEY,
  profile_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_uid      TEXT NOT NULL REFERENCES content_items(uid) ON DELETE CASCADE,
  template      TEXT NOT NULL,                    -- recognize | recall | listen | formula_meaning | ...
  stability     REAL,                             -- FSRS MemoryState; NULL = новая
  difficulty    REAL,
  due           INTEGER NOT NULL,
  reps          INTEGER NOT NULL DEFAULT 0,
  lapses        INTEGER NOT NULL DEFAULT 0,
  last_review   INTEGER,
  suspended     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (profile_id, item_uid, template)
);
CREATE INDEX idx_cards_due ON cards(profile_id, suspended, due);

CREATE TABLE review_log (
  id            INTEGER PRIMARY KEY,
  card_id       INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  ts            INTEGER NOT NULL,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  elapsed_days  REAL NOT NULL,
  duration_ms   INTEGER,
  outcome_json  TEXT NOT NULL                     -- {correct, attempts, hints, answer}
);

CREATE TABLE quiz_attempts (
  id           INTEGER PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id   TEXT NOT NULL,
  source       TEXT NOT NULL CHECK (source IN ('course','exam','review','ai')),
  quiz_uid     TEXT NOT NULL,                     -- course_id/lesson_id/q1 | ai/<hash>
  correct      INTEGER NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 1,
  hints_used   INTEGER NOT NULL DEFAULT 0,
  duration_ms  INTEGER,
  answer_json  TEXT,
  ts           INTEGER NOT NULL
);

CREATE TABLE lesson_progress (
  profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id    TEXT NOT NULL,
  lesson_id    TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('new','started','completed')),
  read_ratio   REAL NOT NULL DEFAULT 0,
  best_score   REAL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (profile_id, course_id, lesson_id)
);

CREATE TABLE exam_results (
  id          INTEGER PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   TEXT NOT NULL,
  exam_id     TEXT NOT NULL,
  seed        INTEGER NOT NULL,
  score       REAL NOT NULL,
  passed      INTEGER NOT NULL,
  ts          INTEGER NOT NULL
);

CREATE TABLE tts_cache (
  key           TEXT PRIMARY KEY,                 -- sha256(provider|voice|rate|text)
  provider      TEXT NOT NULL,
  path          TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER NOT NULL
);
```

Таблицы следующих фаз (отдельными миграциями): `ai_items` (сгенерированные вопросы, жалобы),
`game_sessions`, `stroke_samples` (по согласию — для улучшения шаблонов).

## Правила

- Соединение открывает `mpt_storage::Db::open`, который **до миграций** выполняет
  `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;` (для in-memory БД в тестах — без WAL). Миграции встраиваются в
  бинарь (`include_str!`), версия — `PRAGMA user_version` (механизм `rusqlite_migration`).
- Миграции только вперёд (ADR-09): применённый файл миграции не редактируется даже до релиза 0.1 —
  иначе БД разработчиков молча разойдутся со схемой. Исправление = новая миграция.
- Удаление курса **не удаляет** `vocab`/`cards`: сервис удаляет файлы курса, ставит
  `courses.status = 'removed'`, элементы — `retired`, карточки — `suspended = 1`.
  Повторная установка курса восстанавливает прогресс. `DELETE FROM courses` (с каскадом на
  прогресс) выполняется только явным действием родителя «Удалить курс вместе с прогрессом».
- Все запросы к прогрессу фильтруются по `profile_id` — тест на изоляцию профилей обязателен.
- Экспорт профиля: JSON `{ format: "mpt-progress", version: 1, profile, vocab, cards, review_log,
  quiz_attempts, lesson_progress, exam_results }` с ссылками по UID. Импорт идемпотентен.
