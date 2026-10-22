"""Unit tests for temporal flaw detection and deterministic rubric scoring."""
import pytest
from app.models.schemas import (
    AudioMetadata,
    PitchFeatures,
    EnergyFeatures,
    SpectralFeatures,
    AudioFeatureSet,
    WordTimestamp,
    PauseSegment,
    ForcedAlignmentResult,
)
from app.flaws.detector import detect_temporal_flaws
from app.scoring.engine import compute_rubric_scores
from app.comparison.comparator import align_and_contrast_words

def make_mock_features(audio_id: str, wpm: float, pitch_std: float, pauses=None, dyn_range: float = 20.0):
    words = [
        WordTimestamp(word="word1", start=0.0, end=0.3, local_wpm=wpm),
        WordTimestamp(word="word2", start=0.3, end=0.6, local_wpm=wpm),
        WordTimestamp(word="word3", start=0.6, end=0.9, local_wpm=wpm),
        WordTimestamp(word="word4", start=0.9, end=1.2, local_wpm=wpm),
    ]
    meta = AudioMetadata(
        duration_sec=2.0,
        sample_rate=16000,
        channels=1,
        format="wav",
        file_size_bytes=64000,
        clipping_ratio=0.0,
        snr_estimate_db=25.0,
        voiced_duration_sec=1.5
    )
    return AudioFeatureSet(
        audio_id=audio_id,
        metadata=meta,
        words=words,
        pauses=pauses or [],
        pitch=PitchFeatures(
            frame_times=[0.0, 0.5, 1.0],
            f0_raw_hz=[140.0, 145.0, 142.0],
            f0_semitones_norm=[0.0, 0.6, 0.2],
            median_f0_hz=142.0,
            semitone_std=pitch_std,
            voiced_fraction=0.8
        ),
        energy=EnergyFeatures(
            frame_times=[0.0, 0.5, 1.0],
            rms_db=[-10.0, -8.0, -12.0],
            dynamic_range_db=dyn_range,
            energy_variability_db=3.5
        ),
        spectral=SpectralFeatures(
            frame_times=[0.0, 0.5, 1.0],
            spectral_centroid=[1800.0, 1900.0, 1850.0],
            spectral_rolloff=[3500.0, 3600.0, 3550.0],
            spectral_contrast=[18.0, 19.0, 18.5],
            mfcc_summary=[0.0] * 13
        ),
        overall_wpm=wpm
    )

def test_detect_excessive_speed():
    ref_feat = make_mock_features("ref", wpm=140.0, pitch_std=2.2)
    part_feat = make_mock_features("part", wpm=210.0, pitch_std=2.2)
    contrasts = align_and_contrast_words(ref_feat.words, part_feat.words)
    flaws = detect_temporal_flaws(ref_feat, part_feat, contrasts)
    
    speed_flaws = [f for f in flaws if f.flaw_type == "excessive_speed"]
    assert len(speed_flaws) >= 1
    assert speed_flaws[0].severity >= 2
    assert speed_flaws[0].measurement_unit == "WPM"
    assert speed_flaws[0].relative_difference_pct > 25.0

def test_detect_monotone_flaw():
    ref_feat = make_mock_features("ref", wpm=140.0, pitch_std=2.5)
    part_feat = make_mock_features("part", wpm=140.0, pitch_std=0.8) # severely flat
    contrasts = align_and_contrast_words(ref_feat.words, part_feat.words)
    flaws = detect_temporal_flaws(ref_feat, part_feat, contrasts)

    pitch_flaws = [f for f in flaws if f.flaw_type == "reduced_pitch_variation"]
    assert len(pitch_flaws) >= 1
    assert pitch_flaws[0].severity in [2, 3]

def test_detect_mid_phrase_pause():
    ref_feat = make_mock_features("ref", wpm=140.0, pitch_std=2.0)
    awkward_pause = PauseSegment(
        start_time=0.6,
        end_time=1.8,
        duration_sec=1.2,
        pause_type="mid_phrase",
        preceding_word="access",
        following_word="water",
        is_excessive=True
    )
    part_feat = make_mock_features("part", wpm=140.0, pitch_std=2.0, pauses=[awkward_pause])
    contrasts = align_and_contrast_words(ref_feat.words, part_feat.words)
    flaws = detect_temporal_flaws(ref_feat, part_feat, contrasts)

    pause_flaws = [f for f in flaws if f.flaw_type == "mid_phrase_pause"]
    assert len(pause_flaws) >= 1
    assert pause_flaws[0].severity == 3

def test_deterministic_scoring_and_clarity_redistribution():
    ref_feat = make_mock_features("ref", wpm=140.0, pitch_std=2.2)
    part_feat = make_mock_features("part", wpm=140.0, pitch_std=2.2)
    align_verified = ForcedAlignmentResult(
        aligned_words=part_feat.words,
        canonical_transcript="word1 word2 word3 word4",
        recognized_transcript="word1 word2 word3 word4",
        mismatch_detected=False,
        similarity_ratio=1.0,
        alignment_status="verified"
    )

    # 1. Near perfect score
    score1 = compute_rubric_scores(ref_feat, part_feat, align_verified, flaws=[])
    assert score1.total_score >= 95.0
    assert score1.max_score == 100.0

    # 2. When clarity is unavailable (e.g. transcript mismatch or degraded audio)
    align_failed = ForcedAlignmentResult(
        aligned_words=[],
        canonical_transcript="word1 word2",
        recognized_transcript="completely wrong text",
        mismatch_detected=True,
        similarity_ratio=0.1,
        alignment_status="failed"
    )
    score2 = compute_rubric_scores(ref_feat, part_feat, align_failed, flaws=[], clarity_available=False)
    clarity_cat = next(c for c in score2.categories if c.category_id == "clarity")
    assert clarity_cat.status == "unavailable"
    assert "redistributed" in score2.formula_explanation.lower()
    # The score should still be bounded in 0-100 without fabricated clarity
    assert 0.0 <= score2.total_score <= 100.0
