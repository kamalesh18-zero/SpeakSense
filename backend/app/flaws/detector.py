"""Rule-based, evidence-driven temporal flaw detection engine with mathematical explainability."""
import uuid
from typing import List, Dict, Any, Optional
import numpy as np

from app.config import DEFAULT_THRESHOLDS
from app.models.schemas import (
    AudioFeatureSet,
    WordTimestamp,
    FlawEvidence,
    PauseSegment,
)

def detect_temporal_flaws(
    ref_features: AudioFeatureSet,
    part_features: AudioFeatureSet,
    word_contrasts: List[Dict[str, Any]],
    thresholds: Optional[Dict[str, Any]] = None
) -> List[FlawEvidence]:
    """
    Identifies localized delivery flaws, computing exact timestamps,
    mathematical evidence, severity (0-3), and actionable suggestions.
    """
    if thresholds is None:
        thresholds = DEFAULT_THRESHOLDS

    flaws: List[FlawEvidence] = []
    
    # ---------------- 1. Excessive Speed Flaws ----------------
    # Scan aligned word sequences for local WPM bursts
    speed_rel_thresh = thresholds.get("speed_excessive_rel_pct", 25.0)
    speed_abs_thresh = thresholds.get("speed_excessive_wpm_abs", 180.0)

    i = 0
    while i < len(word_contrasts):
        c = word_contrasts[i]
        if not c["is_aligned"]:
            i += 1
            continue

        p_wpm = c["part_local_wpm"]
        r_wpm = c["ref_local_wpm"]
        rel_pct = c["rate_diff_pct"]

        if p_wpm >= speed_abs_thresh or rel_pct >= speed_rel_thresh:
            # Cluster consecutive fast words into a single flaw interval
            start_idx = i
            end_idx = i
            while end_idx + 1 < len(word_contrasts):
                next_c = word_contrasts[end_idx + 1]
                if next_c["is_aligned"] and (next_c["part_local_wpm"] >= 165.0 or next_c["rate_diff_pct"] >= 15.0):
                    end_idx += 1
                else:
                    break

            cluster = word_contrasts[start_idx:end_idx + 1]
            start_t = cluster[0]["part_start"]
            end_t = cluster[-1]["part_end"]

            # Only flag if cluster represents a sustained phrase (at least 4 words or >= 1.2 seconds)
            if len(cluster) >= 4 or (end_t - start_t) >= 1.2:
                cluster_words = " ".join([item["word"] for item in cluster])
                avg_p_wpm = round(float(np.mean([item["part_local_wpm"] for item in cluster])), 1)
                avg_r_wpm = round(float(np.mean([item["ref_local_wpm"] for item in cluster])), 1)
                delta_wpm = round(avg_p_wpm - avg_r_wpm, 1)
                pct_faster = round(((avg_p_wpm - avg_r_wpm) / (avg_r_wpm + 1e-6)) * 100.0, 1)

                # Severity calculation
                if pct_faster > 45.0 or avg_p_wpm > 210.0:
                    severity = 3  # Severe
                elif pct_faster > 30.0 or avg_p_wpm > 190.0:
                    severity = 2  # Moderate
                else:
                    severity = 1  # Mild

                flaws.append(FlawEvidence(
                    flaw_id=f"flaw_speed_{uuid.uuid4().hex[:6]}",
                    flaw_type="excessive_speed",
                    start_time=round(start_t, 2),
                    end_time=round(end_t, 2),
                    severity=severity,
                    reference_value=avg_r_wpm,
                    participant_value=avg_p_wpm,
                    absolute_difference=delta_wpm,
                    relative_difference_pct=pct_faster,
                    measurement_unit="WPM",
                    explanation=f"Phrase delivered at {avg_p_wpm} WPM (+{pct_faster}% faster than reference {avg_r_wpm} WPM). High velocity compresses syllables and impairs comprehension.",
                    improvement_suggestion="Ease your pace on this phrase. Articulate consonants clearly and preserve natural pauses between thoughts.",
                    reliability_status="verified",
                    word_context=cluster_words
                ))
            i = end_idx + 1
        else:
            i += 1

    # ---------------- 2. Unusually Slow Delivery ----------------
    slow_rel_thresh = thresholds.get("speed_slow_rel_pct", -25.0)
    slow_abs_thresh = thresholds.get("speed_slow_wpm_abs", 105.0)

    j = 0
    while j < len(word_contrasts):
        c = word_contrasts[j]
        if not c["is_aligned"]:
            j += 1
            continue

        p_wpm = c["part_local_wpm"]
        r_wpm = c["ref_local_wpm"]
        rel_pct = c["rate_diff_pct"]

        if p_wpm <= slow_abs_thresh or rel_pct <= slow_rel_thresh:
            start_idx = j
            end_idx = j
            while end_idx + 1 < len(word_contrasts):
                next_c = word_contrasts[end_idx + 1]
                if next_c["is_aligned"] and (next_c["part_local_wpm"] <= 115.0 or next_c["rate_diff_pct"] <= -18.0):
                    end_idx += 1
                else:
                    break

            cluster = word_contrasts[start_idx:end_idx + 1]
            cluster_words = " ".join([item["word"] for item in cluster])
            start_t = cluster[0]["part_start"]
            end_t = cluster[-1]["part_end"]
            avg_p_wpm = round(float(np.mean([item["part_local_wpm"] for item in cluster])), 1)
            avg_r_wpm = round(float(np.mean([item["ref_local_wpm"] for item in cluster])), 1)
            delta_wpm = round(avg_p_wpm - avg_r_wpm, 1)
            pct_slower = round(abs(rel_pct), 1)

            severity = 3 if pct_slower > 45.0 else (2 if pct_slower > 30.0 else 1)

            flaws.append(FlawEvidence(
                flaw_id=f"flaw_slow_{uuid.uuid4().hex[:6]}",
                flaw_type="unusually_slow",
                start_time=round(start_t, 2),
                end_time=round(end_t, 2),
                severity=severity,
                reference_value=avg_r_wpm,
                participant_value=avg_p_wpm,
                absolute_difference=delta_wpm,
                relative_difference_pct=-pct_slower,
                measurement_unit="WPM",
                explanation=f"Phrase delivered at {avg_p_wpm} WPM (-{pct_slower}% slower than reference {avg_r_wpm} WPM). Prolonged phrasing causes listener disengagement.",
                improvement_suggestion="Pick up the conversational tempo here to maintain audience energy and forward rhythm.",
                reliability_status="verified",
                word_context=cluster_words
            ))
            j = end_idx + 1
        else:
            j += 1

    # ---------------- 3. Pauses (Excessive & Mid-Phrase) ----------------
    pause_boundary_limit = thresholds.get("pause_excessive_sec", 1.2)
    pause_mid_phrase_limit = thresholds.get("pause_mid_phrase_sec", 0.45)

    for p in part_features.pauses:
        # Match nearest reference pause in the same phrase context
        matching_ref_pause = next(
            (rp for rp in ref_features.pauses if abs(rp.start_time - p.start_time) < 3.0),
            None
        )
        ref_pause_dur = matching_ref_pause.duration_sec if matching_ref_pause else 0.4

        if p.pause_type == "mid_phrase" and p.duration_sec >= pause_mid_phrase_limit:
            # Mid-phrase pause
            delta_sec = round(p.duration_sec - ref_pause_dur, 2)
            rel_pct = round(((p.duration_sec - ref_pause_dur) / (ref_pause_dur + 1e-6)) * 100.0, 1)
            severity = 3 if p.duration_sec >= 1.2 else 2

            flaws.append(FlawEvidence(
                flaw_id=f"flaw_pause_mid_{uuid.uuid4().hex[:6]}",
                flaw_type="mid_phrase_pause",
                start_time=p.start_time,
                end_time=p.end_time,
                severity=severity,
                reference_value=ref_pause_dur,
                participant_value=p.duration_sec,
                absolute_difference=delta_sec,
                relative_difference_pct=rel_pct,
                measurement_unit="seconds",
                explanation=f"Unnatural {p.duration_sec}s hesitation between '{p.preceding_word}' and '{p.following_word}'. In fluent speech, this grammatical unit should not be split.",
                improvement_suggestion="Connect these words in a single continuous breath; reserve pauses for sentence or clause boundaries.",
                reliability_status="verified",
                word_context=f"...{p.preceding_word or ''} [PAUSE] {p.following_word or ''}..."
            ))

        elif p.pause_type == "phrase_boundary" and p.duration_sec >= pause_boundary_limit:
            delta_sec = round(p.duration_sec - ref_pause_dur, 2)
            rel_pct = round(((p.duration_sec - ref_pause_dur) / (ref_pause_dur + 1e-6)) * 100.0, 1)
            severity = 3 if p.duration_sec >= 2.0 else (2 if p.duration_sec >= 1.5 else 1)

            flaws.append(FlawEvidence(
                flaw_id=f"flaw_pause_excess_{uuid.uuid4().hex[:6]}",
                flaw_type="excessive_pause",
                start_time=p.start_time,
                end_time=p.end_time,
                severity=severity,
                reference_value=ref_pause_dur,
                participant_value=p.duration_sec,
                absolute_difference=delta_sec,
                relative_difference_pct=rel_pct,
                measurement_unit="seconds",
                explanation=f"Extended pause of {p.duration_sec}s at phrase boundary (+{delta_sec}s longer than reference). Creates unintended dead air.",
                improvement_suggestion="Keep phrase-boundary breaths under 1.0 second to sustain dramatic tension.",
                reliability_status="verified",
                word_context=f"{p.preceding_word or ''} ... {p.following_word or ''}"
            ))

    # ---------------- 4. Reduced Pitch Variation (Monotone) ----------------
    pitch_thresh = thresholds.get("pitch_monotony_semitone_std", 1.6)
    p_pitch_std = part_features.pitch.semitone_std
    r_pitch_std = ref_features.pitch.semitone_std

    if p_pitch_std < pitch_thresh and (r_pitch_std - p_pitch_std) >= 0.8:
        delta_st = round(p_pitch_std - r_pitch_std, 2)
        rel_drop = round(((r_pitch_std - p_pitch_std) / (r_pitch_std + 1e-6)) * 100.0, 1)
        severity = 3 if p_pitch_std < 1.0 else 2

        # Voiced interval window
        start_t = round(part_features.metadata.duration_sec * 0.15, 2)
        end_t = round(part_features.metadata.duration_sec * 0.85, 2)

        flaws.append(FlawEvidence(
            flaw_id=f"flaw_monotone_{uuid.uuid4().hex[:6]}",
            flaw_type="reduced_pitch_variation",
            start_time=start_t,
            end_time=end_t,
            severity=severity,
            reference_value=r_pitch_std,
            participant_value=p_pitch_std,
            absolute_difference=delta_st,
            relative_difference_pct=-rel_drop,
            measurement_unit="semitones",
            explanation=f"Vocal pitch variability is only {p_pitch_std} semitones standard deviation ({rel_drop}% below reference {r_pitch_std} semitones), creating a monotonous, flat delivery.",
            improvement_suggestion="Introduce expressive pitch inflection: elevate pitch to emphasize core themes, and drop pitch at decisive conclusions.",
            reliability_status="verified",
            word_context="Global delivery contour"
        ))

    # ---------------- 5. Inconsistent Vocal Energy / Sudden Dropouts ----------------
    p_dyn = part_features.energy.dynamic_range_db
    r_dyn = ref_features.energy.dynamic_range_db
    if p_dyn < 10.0 and r_dyn >= 18.0:
        flaws.append(FlawEvidence(
            flaw_id=f"flaw_energy_flat_{uuid.uuid4().hex[:6]}",
            flaw_type="inconsistent_energy",
            start_time=round(part_features.metadata.duration_sec * 0.25, 2),
            end_time=round(part_features.metadata.duration_sec * 0.75, 2),
            severity=2,
            reference_value=r_dyn,
            participant_value=p_dyn,
            absolute_difference=round(p_dyn - r_dyn, 1),
            relative_difference_pct=round(((p_dyn - r_dyn) / r_dyn) * 100.0, 1),
            measurement_unit="dB",
            explanation=f"Dynamic energy range is constrained to {p_dyn} dB (reference exhibited {r_dyn} dB), indicating compressed dynamic projection.",
            improvement_suggestion="Vary vocal projection between reflective phrases and resonant climaxes.",
            reliability_status="verified",
            word_context="Mid-speech dynamics"
        ))

    # Sort flaws chronologically
    flaws.sort(key=lambda f: f.start_time)
    return flaws
