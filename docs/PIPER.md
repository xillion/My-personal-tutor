# Piper TTS: установка и сборка

Piper (`OHF-Voice/piper1-gpl`) — локальный нейросетевой TTS, выбранный владельцем на замену
системным голосам (KI-021). Окончательное решение и способ встраивания — ADR в T-004.4
(`architect`). Направление, одобренное владельцем:

1. **Озвучка курсов при сборке** (`mptc`, машина автора): Python-пакет `piper-tts`, аудио кладётся
   в пакет курса, тайминги для караоке — выравниванием (T-105) или фонемными длительностями Piper.
2. **Живой голос в приложении** (ступень каскада T-305): библиотека `libpiper` (C API) +
   onnxruntime + `espeak-ng-data`, голоса скачиваются по запросу.

Команды ниже взяты из документации upstream (ветка `main`, релиз **v1.8.0** от 2026-09-04) и
локально ещё не прогонялись — первый прогон входит в спайк Piper. Upstream ищет мейнтейнеров:
версию фиксировать тегом, не `main`.

## 1. Лицензии

- Движок — **GPL-3.0-or-later** (совместим с проектом, ADR-24). espeak-ng встроен.
- Голоса лицензируются **отдельно**, по датасету и по цепочке «Finetuned from …» в `MODEL_CARD`.
  Голоса, производные от `lessac`/`ryan`, а также `amy`, `hfc_*`, `bryce` — **не брать**.
- Многие голоса переобучены в конце 2026 года под теми же именами. Подходит только копия, у
  которой в `MODEL_CARD` (раздел Training) **нет** «Finetuned from U.S. English lessac voice».
  Старую копию — скачать заново.

Голоса-кандидаты (по `docs/COMMERCIAL_USE.md` upstream; все 22,05 кГц, medium ≈ 63 МБ):

| Голос | Лицензия | Примечание |
|-------|----------|------------|
| `ru_RU-denis-medium` | CC0 | от rdh (CC0) |
| `ru_RU-dmitri-medium` | CC0 | от hifi_tts_92 — нужна атрибуция Hi-Fi TTS (CC BY 4.0) |
| `en_US-joe-medium`, `en_US-mike-medium` | CC0 | от rdh |
| `en_US-john-medium`, `en_US-kristin-medium`, `en_US-norman-medium`, `en_US-ljspeech-medium/high` | Public domain | обучены с нуля |
| `en_GB-cori-high` | Public domain | британский вариант |
| `en_GB-alba-medium`, `en_GB-vctk-medium` | CC BY 4.0 | атрибуция Hi-Fi TTS |

`ru_RU-irina` (лицензия неизвестна, от lessac) и `ru_RU-ruslan` (CC BY-NC-SA) — не подходят.
Выбор конкретных голосов — на слух владельцем, затем фиксация в ADR вместе с текстом атрибуции.

## 2. Быстрая проба голосов (Python, без сборки)

Готовые колёса `piper-tts` 1.8.0 есть для Windows x64, Linux x86_64/aarch64, macOS x64/arm64
(Python ≥ 3.9, abi3). Работает в отдельном venv:

```bash
python3 -m venv ~/piper-venv
source ~/piper-venv/bin/activate
pip install "piper-tts[alignment]==1.8.0"

mkdir -p ~/piper-voices
python3 -m piper.download_voices --data-dir ~/piper-voices ru_RU-denis-medium ru_RU-dmitri-medium en_US-joe-medium
python3 -m piper --data-dir ~/piper-voices -m ru_RU-denis-medium -f denis.wav -- 'Мама мыла раму. Сегодня мы читаем сказку.'
python3 -m piper --help                   # остальные флаги (скорость, паузы, громкость)
```

Windows (PowerShell, Python с python.org):

```powershell
py -m venv $HOME\piper-venv
& $HOME\piper-venv\Scripts\Activate.ps1
pip install "piper-tts[alignment]==1.8.0"
New-Item -ItemType Directory -Force $HOME\piper-voices | Out-Null
python -m piper.download_voices --data-dir $HOME\piper-voices ru_RU-denis-medium
python -m piper --data-dir $HOME\piper-voices -m ru_RU-denis-medium -f denis.wav -- 'Мама мыла раму.'
```

- `python3 -m piper.download_voices` без аргументов печатает список голосов.
- Без `-f` звук играется через `ffplay`.
- Скорость в Python API: `SynthesisConfig(length_scale=…)` (2.0 — вдвое медленнее). Флаг CLI
  для скорости в документации не указан — смотреть `--help`.
- Ударение/произношение можно задать фонемами: `[[ bˈætmæn ]]` в тексте; фонемы получают через
  `espeak-ng -v en-us --ipa=3 -q batman`.

## 3. Сборка `libpiper` (C API) из исходников

Готовых бинарников `libpiper` upstream не публикует (в релизе v1.8.0 только колёса Python).
Архивный `rhasspy/piper` (2023.11.14-2) даёт готовый CLI, но без выравнивания — не использовать.

Нужно: CMake, Ninja (по желанию), компилятор C++ (Linux: `gcc`/`clang`; Windows: MSVC из
Visual Studio Build Tools, см. `BUILDING.md`), git, доступ в интернет при сборке (CMake сам
скачает и соберёт espeak-ng и скачает onnxruntime из NuGet Microsoft с проверкой SHA256).

```bash
git clone --branch v1.8.0 --depth 1 https://github.com/OHF-voice/piper1-gpl.git
cd piper1-gpl/libpiper
```

**Linux** (Fedora: `sudo dnf install cmake ninja-build gcc-c++`; Ubuntu: `sudo apt-get install build-essential cmake ninja-build`):

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=$PWD/install
cmake --build build --config Release
cmake --install build --config Release
```

**Windows** (`cmd` из «Developer Command Prompt for VS»):

```bat
cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=%CD%/install
cmake --build build --config Release
cmake --install build --config Release
install\bin\piper_exe.exe --version
```

`--config Release` обязателен для генератора Visual Studio. На целевой машине нужен MSVC
Redistributable.

Результат в `install/`:
- `include/piper.h` — заголовок C API;
- `lib/` — `libpiper` и `libonnxruntime` (на Windows DLL и `piper_exe.exe` — в `bin/`);
- `share/espeak-ng-data/` — данные фонемизатора; путь передаётся в
  `piper_create(model.onnx, model.onnx.json, espeak_data_path)`.

Свой onnxruntime: `-DONNXRUNTIME_DIR=<dir>` (с `include/` и `lib/`).

Использование C API: `piper_create` → `piper_default_synthesize_options` (`length_scale`,
`speaker_id`) → `piper_synthesize_start` → цикл `piper_synthesize_next` до `chunk.is_last`
(последний чанк тоже содержит звук) → `piper_free`. Звук — float32 моно, 22 050 Гц для medium.
Модель загружать один раз и держать в памяти.

## 4. Тайминги для караоке (экспериментально)

Piper отдаёт длительность каждой фонемы, если модель пропатчена:

```bash
pip install "piper-tts[alignment]"                         # нужен пакет onnx
python3 -m piper.patch_voice_with_alignment /path/to/ru_RU-denis-medium.onnx
```

или в памяти: `PiperVoice.load("/path/model.onnx", include_alignments=True)`.

- Python: у `AudioChunk` появляются `phonemes`, `phoneme_ids`, `phoneme_id_samples`,
  `phoneme_alignments`.
- C: в `piper_audio_chunk` — `phonemes`, `phoneme_ids`, `alignments` (длительности в сэмплах;
  делить на частоту дискретизации).
- Границы слов — суммой длительностей между фонемами-пробелами. Числа, даты, сокращения нужно
  заранее раскрыть в слова, иначе слова текста и речи не сопоставятся.

## 5. Потоковый синтез

```bash
python3 -m piper.split_voice_for_streaming /path/to/model.onnx   # → model.encoder.onnx + model.decoder.onnx
```

Если нужны и тайминги, сначала патч выравнивания, потом разбиение. `libpiper` подхватывает
разбитые файлы рядом с моделью сам и отдаёт чанки меньше предложения.

## 6. Что проверить в спайке Piper (до ADR)

- [ ] Сборка `libpiper` v1.8.0 на Fedora 44 и Windows 10 (MSVC), размер `install/`.
- [ ] Время синтеза и RAM для `ru_RU-denis-medium` на слабом ПК; время загрузки модели.
- [ ] Тайминги слов из выравнивания на русском и английском тексте урока.
- [ ] Выбор голосов на слух (ru: denis/dmitri; en: 1–2 из таблицы) и текст атрибуции.
- [ ] Связка с Rust: FFI к `piper.h` (bindgen) или процесс-сайдкар; поставка onnxruntime и
      `espeak-ng-data` в установщиках трёх ОС; влияние на размер бандла (ADR-13, правило 9).
