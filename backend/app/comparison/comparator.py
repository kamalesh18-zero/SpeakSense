"""Baseline contrastive comparison engine between reference and participant deliveries."""
import numpy as np
import librosa
from typing import List, Dict, Any, Tuple, Optional

from app.models.schemas import (
    AudioFeatureSet,
    WordTimestamp,
    FlawEvidence,
)

def compute_dtw_acoustic_distance(mfcc_ref: np.ndarray, mfcc_part: np.ndarray) -> float:
    """
    Computes normalized Dynamic Time Warping (DTW) distance between
    reference and participant acoustic MFCC sequences.
    """
    try:
        # mfcc shape: (n_mfcc, n_frames)
        # Cosine or euclidean distance cost matrix
        d, wp = librosa.sequence.dtw(X=mfcc_ref, Y=mfcc_part, metric="cosine")
        normalized_distance = float(d[-1, -1] / len(wp))
        return round(normalized_distance, 4)
    except Exception:
        return 0.25

def align_and_contrast_words(
    ref_words: List[WordTimestamp],
    part_words: List[WordTimestamp]
) -> List[Dict[str, Any]]:
    """
    Pairs corresponding words from reference and participant deliveries,
    calculating duration difference, relative stretch, and rate comparison.
    """
    contrasts: List[Dict[str, Any]] = []
    min_len = min(len(ref_words), len(part_words))

    for i in range(min_len):
        r_w = ref_words[i]
        p_w = part_words[i]

        r_dur = max(0.05, r_w.end - r_w.start)
        p_dur = max(0.05, p_w.end - p_w.start)
        dur_diff = p_dur - r_dur
        relative_stretch = p_dur / r_dur

        # Rate difference
        r_rate = r_w.local_wpm or 140.0
        p_rate = p_w.local_wpm or 140.0
        rate_diff = p_rate - r_rate
        rate_pct = ((p_rate - r_rate) / (r_rate + 1e-6)) * 100.0

        p_w.relative_stretch = round(relative_stretch, 2)

        contrasts.append({
            "word": p_w.word,
            "ref_start": r_w.start,
            "ref_end": r_w.end,
            "ref_duration": round(r_dur, 2),
            "part_start": p_w.start,
            "part_end": p_w.end,
            "part_duration": round(p_dur, 2),
            "duration_diff": round(dur_diff, 2),
            "relative_stretch": round(relative_stretch, 2),
            "ref_local_wpm": round(r_rate, 1),
            "part_local_wpm": round(p_rate, 1),
            "rate_diff_wpm": round(rate_diff, 1),
            "rate_diff_pct": round(rate_pct, 1),
            "is_aligned": r_w.is_aligned and p_w.is_aligned
        })

    return contrasts

def compute_phrase_level_comparisons(
    ref_features: AudioFeatureSet,
    part_features: AudioFeatureSet,
    word_contrasts: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Computes global and phrase-level contrastive metrics.
    """
    # Duration comparison
    ref_dur = ref_features.metadata.duration_sec
    part_dur = part_features.metadata.duration_sec
    dur_delta = round(part_dur - ref_dur, 2)
    dur_delta_pct = round(((part_dur - ref_dur) / (ref_dur + 1e-6)) * 100.0, 1)

    # Speaking rate comparison
    ref_wpm = ref_features.overall_wpm
    part_wpm = part_features.overall_wpm
    wpm_delta = round(part_wpm - ref_wpm, 1)
    wpm_delta_pct = round(((part_wpm - ref_wpm) / (ref_wpm + 1e-6)) * 100.0, 1)

    # Pitch variability comparison (semitones)
    ref_pitch_std = ref_features.pitch.semitone_std
    part_pitch_std = part_features.pitch.semitone_std
    pitch_std_delta = round(part_pitch_std - ref_pitch_std, 2)

    # Pause comparison
    ref_total_pause = round(sum(p.duration_sec for p in ref_features.pauses), 2)
    part_total_pause = round(sum(p.duration_sec for p in part_features.pauses), 2)
    pause_delta = round(part_total_pause - ref_total_pause, 2)

    # Energy dynamic range comparison
    ref_dyn_range = ref_features.energy.dynamic_range_db
    part_dyn_range = part_features.energy.dynamic_range_db
    dyn_range_delta = round(part_dyn_range - ref_dyn_range, 1)

    return {
        "duration": {
            "ref_sec": ref_dur,
            "part_sec": part_dur,
            "delta_sec": dur_delta,
            "delta_pct": dur_delta_pct,
        },
        "speaking_rate": {
            "ref_wpm": ref_wpm,
            "part_wpm": part_wpm,
            "delta_wpm": wpm_delta,
            "delta_pct": wpm_delta_pct,
        },
        "pitch_variability": {
            "ref_semitone_std": ref_pitch_std,
            "part_semitone_std": part_pitch_std,
            "delta_semitones": pitch_std_delta,
        },
        "pauses": {
            "ref_total_sec": ref_total_pause,
            "part_total_sec": part_total_pause,
            "delta_sec": pause_delta,
            "ref_pause_count": len(ref_features.pauses),
            "part_pause_count": len(part_features.pauses),
        },
        "energy_dynamics": {
            "ref_dynamic_range_db": ref_dyn_range,
            "part_dynamic_range_db": part_dyn_range,
            "delta_db": dyn_range_delta,
        }
    }
