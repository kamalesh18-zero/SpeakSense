"""Unit tests for audio preprocessing and feature extraction."""
import pytest
import numpy as np
from pathlib import Path

from app.config import RECORDINGS_DIR
from app.audio.processor import decode_and_resample
from app.features.extractor import (
    extract_pitch_f0,
    extract_energy,
    extract_spectral_features,
    detect_pauses_from_words,
)
from app.models.schemas import WordTimestamp

@pytest.fixture
def sample_wav_path():
    path = RECORDINGS_DIR / "script_1_ideal_reference.wav"
    assert path.exists(), f"Sample WAV not found: {path}"
    return str(path)

def test_decode_and_resample(sample_wav_path):
    data, sr, meta = decode_and_resample(sample_wav_path, target_sr=16000)
    assert sr == 16000
    assert data.ndim == 1
    assert len(data) > 0
    assert meta.duration_sec > 10.0
    assert not meta.is_silent
    assert meta.clipping_ratio < 0.05
    assert meta.snr_estimate_db > 10.0

def test_pitch_extraction(sample_wav_path):
    data, sr, _ = decode_and_resample(sample_wav_path)
    pitch_feats, f0, times = extract_pitch_f0(data, sr)
    assert len(pitch_feats.frame_times) > 0
    assert pitch_feats.median_f0_hz > 50.0
    assert pitch_feats.semitone_std >= 0.0
    assert 0.0 <= pitch_feats.voiced_fraction <= 1.0

def test_energy_extraction(sample_wav_path):
    data, sr, _ = decode_and_resample(sample_wav_path)
    energy_feats, rel_db, times = extract_energy(data, sr)
    assert len(energy_feats.frame_times) > 0
    assert energy_feats.dynamic_range_db > 5.0
    assert len(energy_feats.rms_db) == len(energy_feats.frame_times)

def test_spectral_features(sample_wav_path):
    data, sr, _ = decode_and_resample(sample_wav_path)
    spectral = extract_spectral_features(data, sr)
    assert len(spectral.spectral_centroid) > 0
    assert len(spectral.mfcc_summary) == 13

def test_detect_pauses_from_words():
    words = [
        WordTimestamp(word="Access,", start=0.5, end=0.9),
        WordTimestamp(word="to", start=1.0, end=1.2),
        WordTimestamp(word="water.", start=1.3, end=1.8),
        # Gap of 1.4 seconds after period (phrase boundary pause)
        WordTimestamp(word="It", start=3.2, end=3.4),
        # Gap of 0.8 seconds between unpunctuated words (mid-phrase pause)
        WordTimestamp(word="is", start=4.2, end=4.4),
    ]
    pauses = detect_pauses_from_words(words, total_duration=5.0)
    assert len(pauses) >= 2
    types = [p.pause_type for p in pauses]
    assert "phrase_boundary" in types
    assert "mid_phrase" in types
