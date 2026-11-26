//! Интеграционные тесты бинаря `mptc`.

use std::process::Command;

fn mptc() -> Command {
    Command::new(env!("CARGO_BIN_EXE_mptc"))
}

#[test]
fn version_flag_prints_name_and_version() {
    let out = mptc().arg("--version").output().expect("run mptc");
    assert!(out.status.success());
    let stdout = String::from_utf8(out.stdout).expect("utf-8 stdout");
    assert_eq!(
        stdout.trim_end(),
        format!("mptc {}", env!("CARGO_PKG_VERSION"))
    );
}

#[test]
fn unknown_argument_fails_with_message() {
    let out = mptc().arg("--frobnicate").output().expect("run mptc");
    assert_eq!(out.status.code(), Some(2));
    let stderr = String::from_utf8(out.stderr).expect("utf-8 stderr");
    assert!(
        stderr.contains("unknown argument '--frobnicate'"),
        "stderr: {stderr}"
    );
}

#[cfg(unix)]
#[test]
fn non_utf8_argument_fails_with_usage_error_instead_of_panic() {
    use std::ffi::OsStr;
    use std::os::unix::ffi::OsStrExt;

    let out = mptc()
        .arg(OsStr::from_bytes(b"\xff"))
        .output()
        .expect("run mptc");
    assert_eq!(out.status.code(), Some(2));
    let stderr = String::from_utf8(out.stderr).expect("utf-8 stderr");
    assert!(stderr.contains("unknown argument"), "stderr: {stderr}");
}
