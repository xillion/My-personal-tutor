//! `mptc` — CLI-компилятор курсов My Personal Tutor.
//!
//! Пока поддерживает только `--version`/`-V` и `--help`/`-h`; подкоманды появятся в T-101.

use std::ffi::OsString;
use std::process::ExitCode;

/// Код выхода при ошибке использования CLI (как у `clap`).
const USAGE_ERROR: u8 = 2;

const USAGE: &str = "usage: mptc [--version | --help]";

/// Результат разбора аргументов командной строки.
#[derive(Debug, PartialEq, Eq)]
enum Action {
    Version,
    Help,
}

/// Ошибка разбора аргументов.
#[derive(Debug, PartialEq, Eq)]
enum ArgsError {
    Missing,
    Unknown(String),
}

impl std::fmt::Display for ArgsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Missing => write!(f, "mptc: missing argument\n{USAGE}"),
            Self::Unknown(arg) => write!(f, "mptc: unknown argument '{arg}'\n{USAGE}"),
        }
    }
}

/// Разбирает аргументы (без имени программы).
///
/// Принимает `OsString`, а не `String`: `std::env::args()` паникует на аргументах не в UTF-8,
/// а пути на Linux могут быть не в UTF-8.
fn parse_args<I: IntoIterator<Item = OsString>>(args: I) -> Result<Action, ArgsError> {
    let mut args = args.into_iter();
    let first = args.next().ok_or(ArgsError::Missing)?;
    let action = match first.to_str() {
        Some("--version" | "-V") => Action::Version,
        Some("--help" | "-h") => Action::Help,
        _ => return Err(unknown(&first)),
    };
    match args.next() {
        None => Ok(action),
        Some(extra) => Err(unknown(&extra)),
    }
}

fn unknown(arg: &OsString) -> ArgsError {
    ArgsError::Unknown(arg.to_string_lossy().into_owned())
}

/// Строка, которую печатает `mptc --version`.
fn version_line() -> String {
    format!("mptc {}", env!("CARGO_PKG_VERSION"))
}

fn main() -> ExitCode {
    match parse_args(std::env::args_os().skip(1)) {
        Ok(Action::Version) => {
            println!("{}", version_line());
            ExitCode::SUCCESS
        }
        Ok(Action::Help) => {
            println!("{}\n{USAGE}", version_line());
            ExitCode::SUCCESS
        }
        Err(err) => {
            eprintln!("{err}");
            ExitCode::from(USAGE_ERROR)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<OsString> {
        list.iter().map(OsString::from).collect()
    }

    #[test]
    fn parses_long_and_short_version_flags() {
        assert_eq!(parse_args(args(&["--version"])), Ok(Action::Version));
        assert_eq!(parse_args(args(&["-V"])), Ok(Action::Version));
    }

    #[test]
    fn parses_long_and_short_help_flags() {
        assert_eq!(parse_args(args(&["--help"])), Ok(Action::Help));
        assert_eq!(parse_args(args(&["-h"])), Ok(Action::Help));
    }

    #[test]
    fn rejects_unknown_and_extra_arguments() {
        assert_eq!(
            parse_args(args(&["--frobnicate"])),
            Err(ArgsError::Unknown("--frobnicate".into()))
        );
        assert_eq!(
            parse_args(args(&["--version", "x"])),
            Err(ArgsError::Unknown("x".into()))
        );
        assert_eq!(parse_args(args(&[])), Err(ArgsError::Missing));
    }
}
