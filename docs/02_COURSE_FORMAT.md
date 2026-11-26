# 02. Формат курса v1

Две стадии (ADR-03): **исходники** пишет человек, **пакет `.mpt`** собирает `mptc build`.
Приложение принимает только пакеты. Источник истины для структур — типы в `mpt-core::model`;
JSON Schema в `schemas/` генерируется из них (`just gen`). При расхождении документа и кода
приоритет у кода, а документ исправляется в том же PR.

---

## 1. Исходники курса

```
courses/sample-en/
├─ course.yaml
├─ lexicon/
│  ├─ words.yaml
│  ├─ phrases.yaml
│  └─ rules.yaml               # правила чтения / грамматики, переиспользуемые
├─ lessons/
│  └─ 01-knight/
│     ├─ lesson.md
│     ├─ quiz.yaml
│     ├─ timings.override.yaml # необязательно, ручные правки таймкодов
│     ├─ audio/story.wav       # любой формат, компилятор перекодирует
│     └─ images/castle.png
├─ exams/unit-1.yaml
├─ templates/                  # шаблоны распознавателя (Фаза 5)
└─ games/robot/                # собранный бандл мини-игры (Фаза 7)
```

### 1.1 `course.yaml`

```yaml
format_version: 1
id: org.example.english-a1        # reverse-DNS, глобально уникален, не меняется никогда
version: 1.0.0                    # semver; обновление = тот же id, большая версия
title: { ru: "Английский A1: первые истории" }
subject: english                  # english | math | physics | ...
content_lang: en                  # основной язык контента (BCP-47)
ui_lang: ru                       # язык пояснений
age: [8, 11]
authors: ["Имя Автора"]
license: CC-BY-4.0
lessons:
  - lessons/01-knight
  - lessons/02-castle
exams:
  - exams/unit-1.yaml
```

### 1.2 `lesson.md`

YAML frontmatter + CommonMark/GFM + атрибуты + блоки-контейнеры.

```markdown
---
id: knight
title: { ru: "Храбрый рыцарь" }
objectives: [silent-kn, future-simple]
---

## Правило: немая K

Буквы [kn]{rule=silent-kn} в начале слова читаются как /n/.

::: reading {audio=audio/story.wav lang=en}
The [knight]{w=knight hl=blue} drew his [sword]{w=sword} and said:
"[I will never give up]{p=never-give-up style=i}!"
:::

| Слово | Перевод |
|-------|---------|
| [knife]{w=knife} | нож |

::: practice {quiz=quiz.yaml}
:::
```

Математика:

```markdown
::: theory
Кинетическая энергия: $E_k = \frac{\htmlData{t=mass}{m}\,\htmlData{t=velocity}{v}^2}{2}$,
где [масса]{t=mass} измеряется в килограммах.
:::

$$
E_k = \frac{m v^2}{2}
$$ {f=kinetic-energy}
```

#### Инлайн-атрибуты `[текст]{...}`

| Ключ | Значение | Пример |
|------|----------|--------|
| `w` | ID слова из lexicon | `{w=knight}` |
| `p` | ID фразы/идиомы (многословная единица) | `{p=give-up}` |
| `t` | ID термина / константы / закона | `{t=mass}` |
| `f` | ID формулы (у блочной формулы — после `$$`) | `{f=kinetic-energy}` |
| `rule` | ID правила (подсветка буквосочетания) | `{rule=silent-kn}` |
| `hl` | цвет палитры: `blue` `green` `orange` `purple` `red` `yellow` | `{hl=blue}` |
| `style` | набор из `b` `i` `u` `s` через запятую | `{style=b,u}` |
| `lang` | язык фрагмента (BCP-47) | `{lang=de}` |
| `say` | текст для TTS, если отличается от написанного | `{say="Mister"}` |
| `note` | всплывающая заметка автора | `{note="ударение на 1-й слог"}` |

Правила: ключ `w|p|t|f` — не больше одного на спан; вложенные спаны допустимы (фраза внутри
предложения, слово внутри фразы); неразмеченные слова в блоке `reading` всё равно становятся
кликабельными токенами. Поиск по lexicon идёт по нормализованной форме, затем — «нет в словаре».

#### Блоки-контейнеры `::: kind {attrs}`

| Блок | Атрибуты | Назначение |
|------|----------|-----------|
| `reading` | `audio`, `lang`, `shadowing=true\|false` | текст для чтения; токенизация по предложениям; караоке при наличии `audio` |
| `theory` | — | объяснение |
| `callout` | `tone=info\|tip\|warn` | выделенный блок |
| `practice` | `quiz`, `items=q1,q2` | встраивание упражнений урока |
| `game` | `id`, `params` (Фаза 7) | запуск мини-игры |

### 1.3 Lexicon

`lexicon/words.yaml`:
```yaml
- id: knight
  kind: word
  lang: en
  headword: knight
  pos: noun
  ipa: /naɪt/
  translations: { ru: [рыцарь] }
  rules: [silent-kn]
  audio: audio/words/knight.wav       # необязательно; иначе TTS
  image: images/knight.png            # необязательно
  examples:
    - { text: "The knight is brave.", tr: { ru: "Рыцарь храбрый." } }
  aliases: []                         # старые ID для миграции прогресса
  cards: [recognize, recall, listen]  # шаблоны карточек; по умолчанию — из kind
```

`lexicon/phrases.yaml`:
```yaml
- id: never-give-up
  kind: phrase
  lang: en
  headword: "I will never give up"
  translations: { ru: ["Я никогда не сдамся"] }
  grammar: { ru: "Future Simple + фразовый глагол give up (сдаваться)" }
```

`lexicon/rules.yaml`:
```yaml
- id: silent-kn
  title: { ru: "Немая K перед N" }
  pattern: "^kn"                      # regex для подсветки букв внутри слова
  explanation: { ru: "Буква k перед n в начале слова не читается." }
  examples: [knight, knife, know]
```

Термины и формулы (`sample-math/lexicon/terms.yaml`):
```yaml
- id: mass
  kind: term
  headword: { ru: масса }
  symbol: m
  unit: кг
  definition: { ru: "Мера инертности тела." }
- id: kinetic-energy
  kind: formula
  headword: { ru: "кинетическая энергия" }
  latex: 'E_k = \frac{m v^2}{2}'
  parts: { m: mass, v: velocity, E_k: kinetic-energy-symbol }
  cards: [formula_meaning, meaning_formula]
```

### 1.4 `quiz.yaml`

```yaml
- id: q1
  type: single_choice
  prompt: { ru: "Как читается слово?" }
  prompt_audio: knight                # озвучить элемент словаря
  options: ["/knaɪt/", "/naɪt/", "/kniːt/"]
  answer: 1
  targets: [knight]
  hint: { ru: "Вспомни правило про kn" }
  explain: { ru: "k перед n не читается" }

- id: q2
  type: type_answer
  prompt: { ru: "Переведи: меч" }
  accept: ["sword", "a sword"]
  normalize: [case, trim, apostrophes, yo]
  targets: [sword]

- id: q3
  type: assemble
  prompt: { ru: "Собери фразу: Я никогда не сдамся" }
  tokens: [I, will, never, give, up]
  distractors: [gave, not]
  targets: [never-give-up]

- id: q4
  type: match_pairs
  pairs: [[knight, рыцарь], [sword, меч], [knife, нож]]
  targets: [knight, sword, knife]

- id: m1
  type: numeric
  prompt: { ru: "Тело массой 2 кг движется со скоростью 5 м/с. Найди E_k." }
  answer: 25
  tolerance: 0.01
  unit: Дж
  targets: [kinetic-energy]
```

Типы MVP: `single_choice`, `multi_choice`, `type_answer`, `assemble`, `match_pairs`, `numeric`, `listen_choose`.
Фаза 5: `draw_shape`, `trace`, `color_region`.

### 1.5 `exams/*.yaml`

```yaml
id: unit-1
kind: minor                       # minor | major
title: { ru: "Проверка: раздел 1" }
pools:
  - { from: "lessons/01-knight/quiz.yaml", pick: 4 }
  - { from: "lessons/02-*/quiz.yaml", pick: 4, types: [type_answer, assemble] }
shuffle: true
pass_ratio: 0.7
time_limit_min: 15                # необязательно
```

### 1.6 `timings.override.yaml`

```yaml
block: 0                          # индекс reading-блока в уроке
overrides:
  - { tid: s0.w1, start: 0.29, end: 0.74 }
```

---

## 2. Компилятор `mptc`

| Команда | Что делает |
|---------|-----------|
| `mptc check <dir>` | парсинг + валидация, ошибки `file:line:col: code: message`, код выхода ≠ 0 при ошибках |
| `mptc align <dir> [--aligner whisperx]` | для каждого `reading` с `audio` вызывает внешний выравниватель, сопоставляет слова с токенами, пишет `.mptc-cache/timings/*.json`, печатает покрытие |
| `mptc build <dir> -o out.mpt` | check → перекодирование медиа (ffmpeg) → сборка AST → пакет |
| `mptc watch <dir>` | пересборка при изменениях (для dev-режима приложения) |

Внешние зависимости компилятора (не приложения): `ffmpeg`; для `align` — `whisperx` или
`stable-ts` (команда задаётся в `mptc.toml` или флагом). Тесты компилятора используют фиктивный
выравниватель (скрипт, отдающий заранее записанный JSON).

Валидация (минимум):
- уникальность ID в курсе (уроки, элементы, вопросы);
- все ссылки `w/p/t/f/rule`, `\htmlData{t=...}`, `targets`, `prompt_audio` разрешаются;
- файлы медиа существуют, форматы поддерживаются;
- `single_choice.answer` в диапазоне, `assemble` собирается из `tokens`, `numeric.tolerance ≥ 0`;
- у `reading` с `audio` покрытие таймкодами ≥ порога;
- `lang` — валидный BCP-47; переводы есть для `ui_lang`;
- предупреждения (не ошибки): слово в `reading` без записи в lexicon, элемент lexicon не используется.

---

## 3. Скомпилированный пакет `.mpt`

```
course.mpt (zip)
├─ manifest.json
├─ lexicon.json
├─ lessons/<lesson_id>.json
├─ exams/<exam_id>.json
├─ media/<sha256[0..16]>.<ext>     # контент-адресуемые: .m4a .webp .png .svg
├─ templates/*.json
└─ games/<game_id>/**
```

### 3.1 `manifest.json`

```json
{
  "format_version": 1,
  "id": "org.example.english-a1",
  "version": "1.0.0",
  "title": { "ru": "Английский A1: первые истории" },
  "subject": "english",
  "content_lang": "en",
  "ui_lang": "ru",
  "age": [8, 11],
  "license": "CC-BY-4.0",
  "lessons": [{ "id": "knight", "title": { "ru": "Храбрый рыцарь" }, "file": "lessons/knight.json" }],
  "exams": [{ "id": "unit-1", "kind": "minor", "file": "exams/unit-1.json" }],
  "compiler": { "name": "mptc", "version": "0.1.0" },
  "min_app_version": "0.1.0",
  "built_at": "2026-11-26T09:00:00Z",
  "files": { "lexicon.json": "sha256:…", "lessons/knight.json": "sha256:…" },
  "content_hash": "sha256:…",
  "signature": null
}
```

### 3.2 `lessons/<id>.json` — AST

```json
{
  "id": "knight",
  "title": { "ru": "Храбрый рыцарь" },
  "blocks": [
    { "type": "heading", "level": 2, "inlines": [{ "type": "text", "text": "Правило: немая K" }] },
    {
      "type": "reading",
      "lang": "en",
      "audio": { "src": "media/3f2a9c1d0b7e4a11.m4a", "duration": 12.4 },
      "sentences": [
        {
          "id": "s0", "t": [0.12, 4.80],
          "inlines": [
            { "type": "word", "tid": "s0.w0", "text": "The", "t": [0.12, 0.28] },
            { "type": "space" },
            {
              "type": "span",
              "ref": { "kind": "word", "uid": "org.example.english-a1/knight" },
              "hl": "blue",
              "children": [{ "type": "word", "tid": "s0.w1", "text": "knight", "t": [0.29, 0.74] }]
            },
            { "type": "punct", "text": "." }
          ]
        }
      ]
    },
    { "type": "math_block", "latex": "E_k = \\frac{m v^2}{2}", "ref": { "kind": "formula", "uid": "…/kinetic-energy" } },
    { "type": "practice", "items": ["q1", "q2", "q3"] }
  ],
  "quiz": [ /* QuizItem[] — с ответами; фронтенду отдаются без них */ ]
}
```

Типы инлайнов: `text`, `space`, `punct`, `word`, `span`, `math` (`latex`), `code`, `link`, `image`, `break`.
Типы блоков: `heading`, `paragraph`, `list`, `table`, `image`, `reading`, `theory`, `callout`,
`math_block`, `practice`, `game`.

---

## 4. Версионирование формата

- `format_version` — целое; приложение поддерживает диапазон `[min, max]`.
- Ломающее изменение = новый `format_version` + конвертер в `mptc` (`mptc upgrade`).
- Добавление необязательных полей не ломает формат (`#[serde(default)]`).
