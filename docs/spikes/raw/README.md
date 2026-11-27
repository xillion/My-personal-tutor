# Сырые результаты спайков T-004

JSON со стенда `/dev/spikes` («Скопировать результат в JSON»). Пути обезличены стендом
(`$APPDATA/…`, `~`); перед коммитом проверено, что в файлах нет имён пользователей ОС.
Сводный отчёт — `docs/spikes/2026-12-platforms.md` (T-004.2).

| Файл | ОС | Сборка | Примечание |
|------|----|--------|------------|
| `2026-11-27-fedora44-dev.json` | Fedora 44, WebKitGTK 2.54 | `just dev` (CSP не действует) | первый прогон |
| `2026-11-27-fedora44-spikes-build.json` | Fedora 44 | `just build-spikes` (CSP действует) | первый прогон |
| `2026-11-27-fedora44-dev-2.json` | Fedora 44 | `just dev` | после исправлений джиттера (blob) и ползунка TTS |
| `2026-11-27-win10-vm-ci-spikes.json` | Windows 10 (VM), WebView2 / Edge 152 | CI-артефакт `c6ce40c` (spikes, CSP действует) | T-004.3, мышь; Ugee M808 ещё не подключали |

Предварительные выводы (решения — T-004.4):
- `<audio src=asset://…>` (`convertFileSrc`) на WebKitGTK не играет ни AAC (`.m4a`), ни Opus (`.ogg`):
  MediaError 4 `NotSupportedError` — и в dev, и в сборке с CSP.
- Blob URL из байтов IPC (`spike_media_bytes`) играет оба формата: play, seek, `ended`, 0.75×.
- `fetch` к asset-URL в сборке с CSP блокируется `connect-src` (ожидаемо).
- Джиттер `currentTime` (blob, m4a, 10 с): ошибка кадра p50 0.25 мс, p95 0.84 мс, max 17 мс;
  интервал обновления p50 16 мс — достаточно для караоке.
- CSP: inline-скрипт и `eval` заблокированы. KaTeX: `\htmlData` работает, 6 запрещённых
  команд не дают утечек, шрифты загружаются локально.
- TTS (speech-dispatcher + espeak-ng): голоса en/ru выбираются, ползунок скорости работает;
  качество голоса неприемлемо для детей (KI-021).
- Перо: проверено только мышью (планшета на Linux не было).

Windows 10 (VM, T-004.3, предварительно):
- `convertFileSrc` (asset) на WebView2 играет m4a: play, seek, `ended`, 0.75× (`preservesPitch`).
  Blob тоже работает. Для `.ogg` `canplay` и длительность получены, полный цикл play/seek не
  запускался (поля `null`) — повторить.
- Джиттер (m4a и ogg, оба источника): ошибка кадра p50 ≈ 0.6 мс, p95 2–4.8 мс, max ≤ 22 мс;
  интервал обновления 15.6 мс — для караоке достаточно.
- TTS WinRT: 2 русских голоса (Irina, Pavel), английских нет (`no system voice for language
  "en-US"` — в русской Windows голос en-US надо ставить отдельно). Акцента нет, качество
  неприемлемо — переход на Piper (KI-021, `docs/PIPER.md`).
- CSP: inline-скрипт и `eval` заблокированы. KaTeX: утечек нет, шрифты локальные.
- Перо: только мышь (`pressure` 0…0.5). Нужен повтор с Ugee M808 (Windows Ink вкл./выкл.)
  и прогон на Windows 11.
