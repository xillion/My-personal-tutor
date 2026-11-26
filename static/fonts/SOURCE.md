# Источники шрифтов

Оба шрифта — SIL Open Font License 1.1 (текст лицензии лежит рядом со шрифтами, `OFL.txt`).
Имена «Andika» и «OpenDyslexic» зарезервированы (Reserved Font Name): модифицированные
версии, в том числе урезанные по набору глифов, нельзя распространять под этими именами.

| Шрифт | Версия | Источник |
|-------|--------|----------|
| Andika | 7.000 | `Andika-7.000.zip`, релиз v7.000, https://github.com/silnrsi/font-andika (папка `web/`, woff2 без конвертации) |
| OpenDyslexic | 0.990 (Italic/BoldItalic — 0.950) | https://forge.hackers.town/antijingoist/opendyslexic, коммит `48218028cc8bd9f4f244cd4ce4049e6c879d4d1a` (2025-11-29), каталог `compiled/` |

Покрытие OpenDyslexic (cmap): русский алфавит с Ёё — 100 %; блок кириллицы U+0400–04FF — 83 %;
IPA U+0250–02AF — 87,5 % (английская IPA — полностью). Недостающее подставляет Andika через
стек `"OpenDyslexic", "Andika", sans-serif`.

## SHA-256

```
42b1be871ca7be536628046a8d86deec34c01dea2340e6f8388c4741a47234f9  andika/Andika-BoldItalic.woff2
d42a45070e8e85ed4122a56c826fd3e894ba5ea205fcda6c6bcd000efabff208  andika/Andika-Bold.woff2
c9ddf781aeacfce4134a0f19b243c77ba8c9b336e8480daca88aac9596526232  andika/Andika-Italic.woff2
bd46cba17fb1ee30023f88376810cee1787c918d34933e0d761485375e2c1bcb  andika/Andika-Regular.woff2
b706216c7dcb7695c3769738de77b55aaf2453368e75eab863f5bb92185b82fb  opendyslexic/OpenDyslexic-BoldItalic.woff2
078d02b066bb2d495dc3bcecb90734360415292bdfef60a3d68012e81311b50d  opendyslexic/OpenDyslexic-Bold.woff2
943a8591db18c782e2f256811719a79476327ef7b881c0c559399f68ff17a9aa  opendyslexic/OpenDyslexic-Italic.woff2
5a7c8f7e613bfdb8d3dd3df6151635dc454b8a58293402a78acda493c7bf383d  opendyslexic/OpenDyslexic-Regular.woff2
```
