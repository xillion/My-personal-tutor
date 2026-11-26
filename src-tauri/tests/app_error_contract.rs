//! QA T-002: граничные случаи IPC-контракта `AppError` и `app_ping`.
#![allow(clippy::unwrap_used, clippy::expect_used)]

use mpt_app::commands::app::ping;
use mpt_app::{AppError, AppErrorCode};
use serde_json::json;

#[test]
fn every_code_is_dotted_domain_reason() {
    for code in [AppErrorCode::Internal, AppErrorCode::InvalidArgument] {
        let s = code.as_str();
        let (domain, reason) = s.split_once('.').expect(s);
        assert!(!domain.is_empty() && !reason.is_empty(), "{s}");
        assert!(
            s.chars()
                .all(|c| c.is_ascii_lowercase() || c == '.' || c == '_'),
            "{s}"
        );
    }
}

#[test]
fn serializes_unicode_message_verbatim_without_details() {
    let err = AppError::internal("сбой 👋 \"quoted\"\n");
    let value = serde_json::to_value(&err).unwrap();
    assert_eq!(
        value,
        json!({ "code": "app.internal", "message": "сбой 👋 \"quoted\"\n" })
    );
    assert!(value.get("details").is_none());
}

#[test]
fn serializes_empty_message_and_keeps_explicit_null_details() {
    let err = AppError::new(AppErrorCode::InvalidArgument, "");
    assert_eq!(
        serde_json::to_string(&err).unwrap(),
        r#"{"code":"app.invalid_argument","message":""}"#
    );
    // `Some(Value::Null)` — заданные детали; TS-тип `details?: unknown | null` это допускает.
    let with_null = err.with_details(serde_json::Value::Null);
    assert_eq!(
        serde_json::to_value(&with_null).unwrap()["details"],
        serde_json::Value::Null
    );
}

#[test]
fn ping_handles_unicode_large_and_repeated_calls() {
    let big = "я".repeat(1_000_000);
    assert_eq!(ping(big.clone()).unwrap(), big);
    assert_eq!(ping("👋🏽\u{0}".to_owned()).unwrap(), "👋🏽\u{0}");
    for _ in 0..3 {
        let err = ping(String::new()).unwrap_err();
        assert_eq!(err.code, AppErrorCode::InvalidArgument);
        assert_eq!(
            serde_json::to_value(&err).unwrap(),
            json!({ "code": "app.invalid_argument", "message": "message must not be empty" })
        );
    }
}
