#!/usr/bin/env bash
# Тестовое аудио для стенда `/dev/spikes` (T-004.1, ADR-12).
#
# Синтезирует ~30 с английской речи локальным TTS (`espeak-ng` на Linux, `say` на macOS) и
# кодирует её через `ffmpeg` в два файла для сравнения:
#   src-tauri/spikes/speech.m4a — AAC-LC, моно, 64 kbps, 48 кГц, `+faststart` (формат пакета курса);
#   src-tauri/spikes/speech.ogg — Opus, моно, 48 kbps (только для сравнения, ADR-12).
# Текст — собственный (не чужой контент), лицензия файлов — как у репозитория.
#
# Результат не побайтно детерминирован: он зависит от версий espeak-ng/say и ffmpeg. Метаданные
# кодировщика и время создания убраны (`-map_metadata -1`, `-fflags +bitexact`), так что
# повторный запуск теми же версиями инструментов обычно даёт те же байты. Файлы коммитятся;
# перегенерировать нужно только при изменении текста.
#
# Запуск: `bash scripts/make-spike-audio.sh` (из любого каталога). Windows не поддерживается.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="$root/src-tauri/spikes"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

text="Hello! This is a test recording for the audio check. \
We listen to a short story about a small red fox. \
Every morning the fox runs to the river and counts the stones: one, two, three, four, five. \
Then it looks at the clouds and says the colors out loud: white, grey, and a little bit of blue. \
In the afternoon the fox reads a book under a tall green tree. \
When the sun goes down, the fox walks home, eats an apple, and goes to sleep. \
This is the end of the test recording. Thank you for listening!"

for tool in ffmpeg; do
  command -v "$tool" >/dev/null || { echo "make-spike-audio: $tool not found" >&2; exit 1; }
done

wav="$tmp/speech.wav"
if command -v espeak-ng >/dev/null; then
  # -s: слов в минуту (по умолчанию 175); 150 — спокойный темп для детей.
  espeak-ng -v en-us -s 150 -w "$wav" "$text"
elif command -v say >/dev/null; then
  say -o "$tmp/speech.aiff" "$text"
  ffmpeg -hide_banner -loglevel error -y -i "$tmp/speech.aiff" "$wav"
else
  echo "make-spike-audio: neither espeak-ng nor say found" >&2
  exit 1
fi

mkdir -p "$out_dir"
common=(-hide_banner -loglevel error -y -i "$wav" -map_metadata -1 -fflags +bitexact -ac 1 -ar 48000)

# EBU R128 около −16 LUFS (ADR-12), как будет делать компилятор курса.
loudnorm=(-af "loudnorm=I=-16:TP=-1.5:LRA=11")

ffmpeg "${common[@]}" "${loudnorm[@]}" -c:a aac -profile:a aac_low -b:a 64k \
  -movflags +faststart "$out_dir/speech.m4a"
ffmpeg "${common[@]}" "${loudnorm[@]}" -c:a libopus -b:a 48k "$out_dir/speech.ogg"

for file in "$out_dir/speech.m4a" "$out_dir/speech.ogg"; do
  duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$file")"
  size="$(wc -c <"$file" | tr -d ' ')"
  echo "make-spike-audio: wrote ${file#"$root"/} (${duration}s, ${size} bytes)"
done
