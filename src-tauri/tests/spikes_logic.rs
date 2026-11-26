//! QA T-004.1: границы выбора голоса и маппинга скорости TTS (`mpt_app::spikes`).
//! Только с feature `spikes`: `cargo test -p mpt-app --features spikes --test spikes_logic`.
#![cfg(feature = "spikes")]
#![allow(clippy::unwrap_used, clippy::expect_used, clippy::float_cmp)]

use mpt_app::spikes::{RATE_MULTIPLIER_RANGE, RateRange, VoiceInfo, backend_rate, select_voice};

const SPEECHD: RateRange = RateRange {
    min: -100.0,
    normal: 0.0,
    max: 100.0,
};
const WINRT: RateRange = RateRange {
    min: 0.5,
    normal: 1.0,
    max: 6.0,
};
const AVFOUNDATION: RateRange = RateRange {
    min: 0.1,
    normal: 0.5,
    max: 2.0,
};
const BACKENDS: [RateRange; 3] = [SPEECHD, WINRT, AVFOUNDATION];

fn voice(name: &str, language: &str) -> VoiceInfo {
    VoiceInfo {
        id: name.to_owned(),
        name: name.to_owned(),
        language: language.to_owned(),
    }
}

#[test]
fn rate_multiplier_range_is_half_to_double() {
    assert_eq!(RATE_MULTIPLIER_RANGE, (0.5, 2.0));
}

#[test]
fn backend_rate_maps_exact_boundaries_on_every_backend() {
    // (multiplier, speechd, winrt, avfoundation)
    let table = [
        (0.5, -100.0, 0.5, 0.25),
        (1.0, 0.0, 1.0, 0.5),
        (2.0, 50.0, 2.0, 1.0),
    ];
    for (m, sd, wr, av) in table {
        assert_eq!(backend_rate(m, SPEECHD), Some(sd), "speechd {m}");
        assert_eq!(backend_rate(m, WINRT), Some(wr), "winrt {m}");
        assert_eq!(backend_rate(m, AVFOUNDATION), Some(av), "avfoundation {m}");
    }
}

#[test]
fn backend_rate_clamps_out_of_range_multiplier_to_boundary_value() {
    for range in BACKENDS {
        let at_low = backend_rate(0.5, range);
        let at_high = backend_rate(2.0, range);
        for below in [0.499, 0.0, -0.0, -1.0, f32::MIN, -f32::MIN_POSITIVE] {
            assert_eq!(backend_rate(below, range), at_low, "{below} on {range:?}");
        }
        for above in [2.001, 3.0, 1e6, f32::MAX] {
            assert_eq!(backend_rate(above, range), at_high, "{above} on {range:?}");
        }
    }
}

#[test]
fn backend_rate_rejects_non_finite_multiplier_on_every_backend() {
    for range in BACKENDS {
        for bad in [f32::NAN, -f32::NAN, f32::INFINITY, f32::NEG_INFINITY] {
            assert_eq!(backend_rate(bad, range), None, "{bad} on {range:?}");
        }
    }
}

#[test]
fn backend_rate_is_monotonic_and_stays_within_backend_range() {
    for range in BACKENDS {
        let mut prev = f32::NEG_INFINITY;
        for step in 0..=150 {
            #[allow(clippy::cast_precision_loss)]
            let m = 0.5 + step as f32 * 0.01;
            let v = backend_rate(m, range).unwrap();
            assert!(v.is_finite(), "{m} on {range:?}");
            assert!(
                (range.min..=range.max).contains(&v),
                "{m} -> {v} on {range:?}"
            );
            assert!(
                v >= prev,
                "not monotonic at {m}: {prev} -> {v} on {range:?}"
            );
            prev = v;
        }
    }
}

#[test]
fn backend_rate_clamps_result_to_narrow_backend_range() {
    let narrow = RateRange {
        min: 0.9,
        normal: 1.0,
        max: 1.2,
    };
    assert_eq!(backend_rate(0.5, narrow), Some(0.9));
    assert_eq!(backend_rate(2.0, narrow), Some(1.2));
    assert_eq!(backend_rate(1.0, narrow), Some(1.0));
}

#[test]
fn select_voice_rejects_tags_without_primary_language() {
    let voices = [voice("us", "en-US"), voice("empty", "")];
    for lang in ["", "   ", "-", "_", "-US", "\t\n"] {
        assert_eq!(select_voice(&voices, lang), None, "{lang:?}");
    }
}

#[test]
fn select_voice_ignores_voices_with_empty_language() {
    let voices = [voice("empty", ""), voice("ru", "ru-RU")];
    assert_eq!(select_voice(&voices, "ru"), Some(1));
    assert_eq!(select_voice(&voices[..1], "en"), None);
}

#[test]
fn select_voice_matches_underscore_and_case_on_backend_side() {
    let voices = [voice("gb", "EN_gb"), voice("us", "en-US")];
    assert_eq!(select_voice(&voices, "en-GB"), Some(0));
    assert_eq!(select_voice(&voices, "en"), Some(0));
}

#[test]
fn select_voice_keeps_first_on_equal_tag_length() {
    let voices = [
        voice("au", "en-AU"),
        voice("gb", "en-GB"),
        voice("us", "en-US"),
    ];
    assert_eq!(select_voice(&voices, "en"), Some(0));
    assert_eq!(select_voice(&voices, "en-NZ"), Some(0));
}

#[test]
fn select_voice_returns_none_when_only_variants_exist() {
    let voices = [
        voice("English (America)+Alex", "en-US"),
        voice("Russian+Anika", "ru"),
    ];
    assert_eq!(select_voice(&voices, "en-US"), None);
    assert_eq!(select_voice(&voices, "ru"), None);
}

#[test]
fn select_voice_handles_unicode_and_huge_tags_without_panic() {
    let voices = [voice("ru", "ru"), voice("weird", "рус-RU")];
    assert_eq!(select_voice(&voices, "рус"), Some(1));
    assert_eq!(select_voice(&voices, "рус-RU"), Some(1));
    assert_eq!(select_voice(&voices, "😀"), None);
    let huge = format!("ru-{}", "x".repeat(100_000));
    assert_eq!(select_voice(&voices, &huge), Some(0));
}

#[test]
fn select_voice_scales_to_speech_dispatcher_variant_flood() {
    // speech-dispatcher на Fedora: ~14 600 записей, почти все — варианты `+…`.
    let mut voices: Vec<VoiceInfo> = (0..14_600)
        .map(|i| voice(&format!("English (America)+v{i}"), "en-US"))
        .collect();
    voices.push(voice("English (America)", "en-US"));
    assert_eq!(select_voice(&voices, "en"), Some(14_600));
}
