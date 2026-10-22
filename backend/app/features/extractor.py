"""Advanced acoustic feature extraction module (FFT, MFCC, Pitch/F0, Energy, Pauses, Rate)."""
import numpy as np
import librosa
from typing import List, Tuple, Dict, Any, Optional

from app.config import (
    SAMPLE_RATE,
    HOP_LENGTH,
    N_FFT,
    N_MFCC,
    PITCH_FMIN,
    PITCH_FMAX,
    VAD_TOP_DB,
    BASELINE_WPM_OPTIMAL,
)
from app.models.schemas import (
    AudioMetadata,
    SpectralFeatures,
    PitchFeatures,
    EnergyFeatures,
    PauseSegment,
    WordTimestamp,
    AudioFeatureSet,
)

def extract_pitch_f0(y: np.ndarray, sr: int = SAMPLE_RATE, hop_length: int = HOP_LENGTH) -> Tuple[PitchFeatures, np.ndarray, np.ndarray]:
    """
    Extracts fundamental frequency (F0) using librosa.pyin (Probabilistic YIN algorithm).
    Computes speaker-normalized semitone contours and pitch variability (semitone standard deviation).
    """
    # Downsample or optimize pyin range for speech
    f0, voiced_flag, voiced_probs = librosa.pyin(
        y,
        fmin=PITCH_FMIN,
        fmax=PITCH_FMAX,
        sr=sr,
        hop_length=hop_length,
        fill_na=np.nan
    )

    times = librosa.times_like(f0, sr=sr, hop_length=hop_length)

    valid_f0 = f0[~np.isnan(f0)]
    if len(valid_f0) > 10:
        median_f0 = float(np.median(valid_f0))
        # Semitone conversion: 12 * log2(f0 / median_f0)
        # This completely neutralizes absolute pitch differences between male/female/higher/lower voices!
        semitones = 12.0 * np.log2(valid_f0 / (median_f0 + 1e-6))
        semitone_std = float(np.std(semitones))
        voiced_fraction = float(len(valid_f0) / len(f0))
        
        # Build normalized contour (None for unvoiced frames)
        semitones_norm = []
        f0_raw_list = []
        for val in f0:
            if np.isnan(val) or val <= 0:
                f0_raw_list.append(None)
                semitones_norm.append(None)
            else:
                f0_raw_list.append(round(float(val), 2))
                st_val = 12.0 * np.log2(val / (median_f0 + 1e-6))
                semitones_norm.append(round(float(st_val), 2))
    else:
        median_f0 = 150.0
        semitone_std = 0.5
        voiced_fraction = 0.0
        f0_raw_list = [None] * len(f0)
        semitones_norm = [None] * len(f0)

    # Downsample time series for lightweight JSON transport (~10-15 points per second)
    step = max(1, len(times) // 250)
    sampled_times = [round(float(t), 3) for t in times[::step]]
    sampled_raw = f0_raw_list[::step]
    sampled_norm = semitones_norm[::step]

    features = PitchFeatures(
        frame_times=sampled_times,
        f0_raw_hz=sampled_raw,
        f0_semitones_norm=sampled_norm,
        median_f0_hz=round(median_f0, 1),
        semitone_std=round(semitone_std, 2),
        voiced_fraction=round(voiced_fraction, 3)
    )
    return features, f0, times

def extract_energy(y: np.ndarray, sr: int = SAMPLE_RATE, hop_length: int = HOP_LENGTH) -> Tuple[EnergyFeatures, np.ndarray, np.ndarray]:
    """Extracts frame-level RMS energy and dynamic range."""
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=hop_length)

    # Convert to dB relative to max
    rms_db = 20 * np.log10(np.maximum(rms, 1e-5))
    max_db = np.max(rms_db) if len(rms_db) > 0 else 0.0
    rel_db = rms_db - max_db  # Range: -60 dB to 0 dB

    # Dynamic range (difference between 95th and 10th percentile of energy)
    p95 = np.percentile(rel_db, 95)
    p10 = np.percentile(rel_db, 10)
    dyn_range = float(p95 - p10)
    std_energy = float(np.std(rel_db[rel_db > -35.0])) if np.any(rel_db > -35.0) else 5.0

    step = max(1, len(times) // 250)
    sampled_times = [round(float(t), 3) for t in times[::step]]
    sampled_db = [round(float(db), 1) for db in rel_db[::step]]

    features = EnergyFeatures(
        frame_times=sampled_times,
        rms_db=sampled_db,
        dynamic_range_db=round(dyn_range, 1),
        energy_variability_db=round(std_energy, 2)
    )
    return features, rel_db, times

def extract_spectral_features(y: np.ndarray, sr: int = SAMPLE_RATE, hop_length: int = HOP_LENGTH) -> SpectralFeatures:
    """Computes STFT spectral centroid, rolloff, contrast, and MFCC summary."""
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)[0]
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, hop_length=hop_length)
    mean_contrast = np.mean(contrast, axis=0)

    # MFCC extraction
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC, hop_length=hop_length)
    mfcc_summary = [round(float(m), 2) for m in np.mean(mfccs, axis=1)]

    times = librosa.times_like(centroid, sr=sr, hop_length=hop_length)
    step = max(1, len(times) // 250)

    return SpectralFeatures(
        frame_times=[round(float(t), 3) for t in times[::step]],
        spectral_centroid=[round(float(c), 1) for c in centroid[::step]],
        spectral_rolloff=[round(float(r), 1) for r in rolloff[::step]],
        spectral_contrast=[round(float(k), 2) for k in mean_contrast[::step]],
        mfcc_summary=mfcc_summary
    )

def detect_pauses_from_words(
    words: List[WordTimestamp],
    total_duration: float,
    min_pause_sec: float = 0.3
) -> List[PauseSegment]:
    """
    Detects pauses between aligned spoken words.
    Categorizes them into phrase-boundary pauses (following punctuation or clause completion)
    or suspicious mid-phrase pauses.
    """
    pauses: List[PauseSegment] = []

    # Initial pause before first word
    if len(words) > 0 and words[0].start >= min_pause_sec:
        pauses.append(PauseSegment(
            start_time=0.0,
            end_time=round(words[0].start, 2),
            duration_sec=round(words[0].start, 2),
            pause_type="breath",
            following_word=words[0].word,
            is_excessive=bool(words[0].start > 1.5)
        ))

    for i in range(len(words) - 1):
        gap = words[i+1].start - words[i].end
        if gap >= min_pause_sec:
            prev_word = words[i].word
            next_word = words[i+1].word

            # Punctuation heuristic: ends with comma, period, semicolon, colon
            is_boundary = bool(prev_word.endswith((".", ",", ";", ":", "!", "?", "—", "-")))
            pause_type = "phrase_boundary" if is_boundary else "mid_phrase"
            is_excessive = (gap > 1.2) if is_boundary else (gap > 0.45)

            pauses.append(PauseSegment(
                start_time=round(words[i].end, 2),
                end_time=round(words[i+1].start, 2),
                duration_sec=round(gap, 2),
                pause_type=pause_type,
                preceding_word=prev_word,
                following_word=next_word,
                is_excessive=is_excessive
            ))

    return pauses

def extract_all_features(
    audio_id: str,
    audio_path: str,
    aligned_words: List[WordTimestamp],
    y: Optional[np.ndarray] = None,
    sr: int = SAMPLE_RATE,
    metadata: Optional[AudioMetadata] = None
) -> AudioFeatureSet:
    """Full acoustic feature extraction pipeline for an audio file."""
    if y is None or metadata is None:
        from app.audio.processor import decode_and_resample
        y, sr, metadata = decode_and_resample(audio_path, target_sr=sr)

    pitch_feats, _, _ = extract_pitch_f0(y, sr)
    energy_feats, _, _ = extract_energy(y, sr)
    spectral_feats = extract_spectral_features(y, sr)
    pauses = detect_pauses_from_words(aligned_words, metadata.duration_sec)

    # Overall Words Per Minute (WPM)
    # Using speech active duration (total duration - long pauses)
    active_speech_time = max(1.0, metadata.voiced_duration_sec)
    overall_wpm = round((len(aligned_words) / (metadata.duration_sec / 60.0)), 1) if metadata.duration_sec > 0 else 0.0

    return AudioFeatureSet(
        audio_id=audio_id,
        metadata=metadata,
        words=aligned_words,
        pauses=pauses,
        pitch=pitch_feats,
        energy=energy_feats,
        spectral=spectral_feats,
        overall_wpm=overall_wpm
    )
