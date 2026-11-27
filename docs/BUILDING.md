# Сборка и запуск для тестирования

Как подготовить машину на Windows, Linux или macOS, собрать приложение и запустить его для ручной
проверки. Версии инструментов закреплены в ADR-23 (`rust-toolchain.toml`, `.nvmrc`,
`package.json` → `packageManager`). Последний источник истины по системным пакетам —
`.github/workflows/ci.yml` и официальный список Tauri: <https://v2.tauri.app/start/prerequisites/>.

## 1. Что нужно на любой ОС

| Инструмент | Версия | Зачем |
|------------|--------|-------|
| Rust | 1.100.0 (`rust-toolchain.toml`; через rustup подхватится сам) | ядро и оболочка Tauri |
| Node.js | 24 LTS (`.nvmrc`, `.node-version`) | фронтенд |
| pnpm | 12.x (`packageManager` в `package.json`) | зависимости фронтенда |
| just | ≥ 1.59 | единая точка входа: `just dev`, `just check` и т. д. |
| cargo-deny | 0.22+ | проверка лицензий в `just check` (для простого запуска не нужен) |
| git | любая свежая | клонирование |

Установка общих инструментов (после установки Node):

```bash
npm i -g pnpm@12          # или corepack, если он есть в вашей версии Node
cargo install --locked just cargo-deny   # либо пакетом ОС / готовым бинарём
```

Если Node ставится через nvm, в корне проекта выполните `nvm use` (прочитает `.nvmrc`). pnpm
устанавливается отдельно для каждой версии Node.

## 2. Системные зависимости по ОС

### Windows 10/11

1. **Microsoft C++ Build Tools** (Visual Studio Build Tools) с нагрузкой «Desktop development with C++».
2. **WebView2 Runtime** — в Windows 10 (1803+) и 11 обычно уже установлен.
3. **Rust** через rustup (`rustup-init.exe`), toolchain `stable-msvc`.
4. **PowerShell 7+** (`pwsh`): `justfile` выполняет рецепты в нём. `winget install Microsoft.PowerShell`.
5. Node 24, pnpm, just: например, `winget install OpenJS.NodeJS.LTS`, затем `npm i -g pnpm@12`,
   `winget install Casey.Just`.

Системный TTS (WinRT) и декодер AAC встроены в Windows, дополнительных пакетов не нужно.

### Linux — Ubuntu 24.04 / Debian

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  libspeechd-dev libclang-dev \
  gstreamer1.0-plugins-good gstreamer1.0-libav
```

### Linux — Fedora

```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel \
  librsvg2-devel libxdo-devel \
  speech-dispatcher-devel clang \
  gstreamer1-plugins-good gstreamer1-plugin-libav
sudo dnf group install c-development
```

Пояснения для Linux:
- `libspeechd-dev`/`speech-dispatcher-devel` и `libclang-dev`/`clang` (libclang для bindgen) нужны для системного
  TTS стенда спайков (cargo-feature `spikes`). Её включают `just dev`, `just check`, `just gen`.
- Плагины GStreamer нужны WebKitGTK для воспроизведения аудио, в том числе AAC (`.m4a`).
  Состав для поставки приложения решается в T-004 (ADR-24: GStreamer в AppImage).
- Для голоса TTS должен работать speech-dispatcher с модулем синтеза (по умолчанию espeak-ng).

### macOS 13+

1. **Xcode Command Line Tools**: `xcode-select --install`.
2. Rust через rustup, Node 24, pnpm, just (например, `brew install node@24 just`, затем
   `npm i -g pnpm@12`).

Системный TTS (AVFoundation) и AAC встроены в macOS.

## 3. Получить код и зависимости

```bash
git clone https://github.com/xillion/My-personal-tutor.git
cd My-personal-tutor
pnpm install --frozen-lockfile
```

## 4. Варианты сборки

| Команда | Что получается | Когда использовать |
|---------|----------------|--------------------|
| `just dev` | Приложение в режиме разработки с горячей перезагрузкой, feature `spikes`. **CSP не действует** | разработка, быстрая проверка UI |
| `just build-spikes` | Debug-бинарь со стендом спайков без установщика: `target/debug/my-personal-tutor` (`.exe` на Windows). CSP действует, `/dev/spikes` открыт | ручные прогоны T-004, проверка CSP |
| `just build` | Релизная сборка и установщики (без спайков) в `target/release/bundle/` | проверка установки и релизного поведения |
| `just check` | Все проверки, как в CI | перед коммитом |

Что создаёт `just build` (`bundle.targets = "all"`):
- **Windows:** `bundle/msi/*.msi` и `bundle/nsis/*-setup.exe`.
- **Linux:** `bundle/deb/*.deb`, `bundle/rpm/*.rpm`, `bundle/appimage/*.AppImage`.
- **macOS:** `bundle/macos/*.app` и `bundle/dmg/*.dmg`.

Сборки пока не подписаны (подпись — T-408):
- Windows SmartScreen может предупредить: «Подробнее» → «Выполнить в любом случае».
- macOS Gatekeeper: открыть через контекстное меню «Открыть» или
  `xattr -dr com.apple.quarantine "My Personal Tutor.app"`.

## 5. Запуск для тестирования

- **Стенд спайков:** запустить `just dev` или собранный `target/debug/my-personal-tutor`, на главной
  нажать «Стенд спайков» (ссылка видна только в dev и спайк-сборке). Внизу страницы — «Скопировать
  результат в JSON».
- **Данные приложения** (`app_data_dir`, identifier `dev.rnd-center.mpt`):
  - Windows: `%APPDATA%\dev.rnd-center.mpt\`
  - Linux: `~/.local/share/dev.rnd-center.mpt/`
  - macOS: `~/Library/Application Support/dev.rnd-center.mpt/`

  Чтобы начать «с чистого листа», закройте приложение и удалите этот каталог.

## 6. Готовая сборка из CI (без установки инструментов)

Каждый push в `main` и в ветки `task/**` собирает на Windows debug-бинарь со стендом спайков и
прикладывает его к запуску CI как артефакт `mpt-spikes-windows-debug-<sha>` (хранится 14 дней).

- Через сайт: GitHub → **Actions** → нужный запуск CI → блок **Artifacts** → скачать zip,
  распаковать, запустить `my-personal-tutor.exe` (нужен WebView2).
- Через `gh`:
  ```bash
  gh run list -R xillion/My-personal-tutor --limit 5
  gh run download <run-id> -R xillion/My-personal-tutor -n mpt-spikes-windows-debug-<sha>
  ```

Готовых сборок для Linux и macOS CI пока не публикует: соберите локально (`just build-spikes`).
Сборка установщиков в CI — T-408.

## 7. Частые проблемы

| Симптом | Причина и решение |
|---------|-------------------|
| `pnpm: command not found` | pnpm установлен под другую версию Node: `nvm use` в корне проекта или `nvm alias default 24` |
| `just` падает на `[env(...)]` | старая версия just — нужна ≥ 1.59 |
| На Windows `just` не находит `pwsh` | установите PowerShell 7+ |
| Сборка на Linux: ошибка про `libspeechd.h` или `libclang` | не установлены `libspeechd-dev`/`speech-dispatcher-devel` и `libclang-dev`/`clang` |
| Нет звука в стенде на Linux | проверьте плагины GStreamer (`gst-inspect-1.0 avdec_aac`); для TTS — что speech-dispatcher запущен (`spd-say test`) |
| `gen-check` падает после изменения команд | выполните `just gen` и закоммитьте `src/lib/ipc/bindings*.ts` |
