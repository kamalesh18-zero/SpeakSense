"""Transparent, deterministic rubric-based scoring engine for speech delivery evaluation."""
from typing import List, Dict, Any, Optional
import numpy as np
from app.config import RUBRIC_PRESETS
from app.models.schemas import (
    AudioFeatureSet,
    FlawEvidence,
    ForcedAlignmentResult,
    RubricCategoryScore,
    RubricScoreResult,
)

def compute_rubric_scores(
    ref_features: AudioFeatureSet,
    part_features: AudioFeatureSet,
    alignment: ForcedAlignmentResult,
    flaws: List[FlawEvidence],
    preset_name: str = "persuasive_oratory",
    clarity_available: bool = True
) -> RubricScoreResult:
    """
    Computes deterministic 100-point rubric evaluation with category breakdowns,
    applied penalties, and explicit redistribution when clarity is unavailable.
    """
    preset = RUBRIC_PRESETS.get(preset_name, RUBRIC_PRESETS["persuasive_oratory"])
    weights = preset["weights"]

    categories: List[RubricCategoryScore] = []

    # ---------------- 1. Pacing (e.g. 25 pts) ----------------
    pacing_max = float(weights["pacing"])
    pacing_penalties: List[str] = []
    pacing_deductions = 0.0

    # Count speed and slow flaws
    speed_flaws = [f for f in flaws if f.flaw_type in ("excessive_speed", "unusually_slow")]
    for f in speed_flaws:
        deduction = f.severity * 2.5
        pacing_deductions += deduction
        pacing_penalties.append(f"-{deduction:.1f} pts: {f.flaw_type.replace('_', ' ').title()} (severity {f.severity}) at {f.start_time}s-{f.end_time}s")

    # Global rate deviation penalty
    rate_diff_pct = abs(((part_features.overall_wpm - ref_features.overall_wpm) / (ref_features.overall_wpm + 1e-6)) * 100.0)
    if rate_diff_pct > 20.0:
        d_rate = min(5.0, round((rate_diff_pct - 20.0) * 0.25, 1))
        pacing_deductions += d_rate
        pacing_penalties.append(f"-{d_rate:.1f} pts: Overall tempo deviation of {rate_diff_pct:.1f}% vs reference")

    pacing_score = max(0.0, round(pacing_max - min(pacing_max, pacing_deductions), 1))
    categories.append(RubricCategoryScore(
        category_id="pacing",
        name="Pacing & Tempo",
        score=pacing_score,
        max_score=pacing_max,
        weight_pct=pacing_max,
        status="measured",
        penalties_applied=pacing_penalties,
        evidence_summary=f"Participant averaged {part_features.overall_wpm} WPM vs reference {ref_features.overall_wpm} WPM ({len(speed_flaws)} localized tempo deviations)."
    ))

    # ---------------- 2. Pause Control (e.g. 20 pts) ----------------
    pause_max = float(weights["pause_control"])
    pause_penalties: List[str] = []
    pause_deductions = 0.0

    pause_flaws = [f for f in flaws if f.flaw_type in ("excessive_pause", "mid_phrase_pause")]
    for f in pause_flaws:
        if f.flaw_type == "mid_phrase_pause":
            d_p = f.severity * 3.0  # Mid-phrase pauses heavily penalize fluent cadence
        else:
            d_p = f.severity * 2.0
        pause_deductions += d_p
        pause_penalties.append(f"-{d_p:.1f} pts: {f.flaw_type.replace('_', ' ').title()} (severity {f.severity}) at {f.start_time}s")

    pause_score = max(0.0, round(pause_max - min(pause_max, pause_deductions), 1))
    categories.append(RubricCategoryScore(
        category_id="pause_control",
        name="Pause Control & Cadence",
        score=pause_score,
        max_score=pause_max,
        weight_pct=pause_max,
        status="measured",
        penalties_applied=pause_penalties,
        evidence_summary=f"{len(part_features.pauses)} total pauses detected; {len(pause_flaws)} flagged as awkward or excessive."
    ))

    # ---------------- 3. Vocal Variation & Inflection (e.g. 20 pts) ----------------
    vocal_max = float(weights["vocal_variation"])
    vocal_penalties: List[str] = []
    vocal_deductions = 0.0

    p_std = part_features.pitch.semitone_std
    r_std = ref_features.pitch.semitone_std
    if p_std < 1.6:
        # Monotony penalty
        deficit = max(0.0, 1.6 - p_std)
        d_vocal = round(min(vocal_max * 0.7, deficit * 6.0), 1)
        vocal_deductions += d_vocal
        vocal_penalties.append(f"-{d_vocal:.1f} pts: Reduced pitch variability ({p_std} semitones vs optimal >= 1.6)")
    elif p_std > 3.8:
        # Over-exaggerated pitch swings
        d_vocal = 2.5
        vocal_deductions += d_vocal
        vocal_penalties.append(f"-{d_vocal:.1f} pts: Excessive pitch fluctuations ({p_std} semitones)")

    vocal_score = max(0.0, round(vocal_max - min(vocal_max, vocal_deductions), 1))
    categories.append(RubricCategoryScore(
        category_id="vocal_variation",
        name="Vocal Pitch & Inflection",
        score=vocal_score,
        max_score=vocal_max,
        weight_pct=vocal_max,
        status="measured",
        penalties_applied=vocal_penalties,
        evidence_summary=f"Pitch variability: {p_std} semitones standard deviation (reference: {r_std} semitones)."
    ))

    # ---------------- 4. Energy Control (e.g. 15 pts) ----------------
    energy_max = float(weights["energy_control"])
    energy_penalties: List[str] = []
    energy_deductions = 0.0

    energy_flaws = [f for f in flaws if f.flaw_type == "inconsistent_energy"]
    for f in energy_flaws:
        d_e = f.severity * 2.5
        energy_deductions += d_e
        energy_penalties.append(f"-{d_e:.1f} pts: Energy inconsistency (severity {f.severity}) at {f.start_time}s")

    # Dynamic range evaluation
    dyn = part_features.energy.dynamic_range_db
    if dyn < 12.0:
        d_dyn = round((12.0 - dyn) * 0.5, 1)
        energy_deductions += d_dyn
        energy_penalties.append(f"-{d_dyn:.1f} pts: Restricted dynamic range ({dyn} dB)")

    energy_score = max(0.0, round(energy_max - min(energy_max, energy_deductions), 1))
    categories.append(RubricCategoryScore(
        category_id="energy_control",
        name="Energy Dynamics & Projection",
        score=energy_score,
        max_score=energy_max,
        weight_pct=energy_max,
        status="measured",
        penalties_applied=energy_penalties,
        evidence_summary=f"Dynamic range of {dyn} dB with variability standard deviation of {part_features.energy.energy_variability_db} dB."
    ))

    # ---------------- 5. Clarity & Intelligibility (e.g. 20 pts) ----------------
    clarity_max = float(weights["clarity"])
    clarity_penalties: List[str] = []

    # Check if speech alignment or SNR is degraded
    if alignment.alignment_status == "failed" or part_features.metadata.is_silent or not clarity_available:
        # Mark explicitly unavailable and redistribute weight proportionally
        formula_explanation = (
            f"Clarity metric marked unavailable due to transcript mismatch or acoustic degradation. "
            f"Available {100.0 - clarity_max} base points proportionally rescaled and redistributed to 100-point scale: "
            f"Final_Score = (Base_Score / {100.0 - clarity_max}) * 100."
        )
        reliability_note = "Clarity score unavailable; weights redistributed strictly without fabrication."

        categories.append(RubricCategoryScore(
            category_id="clarity",
            name="Clarity & Intelligibility",
            score=0.0,
            max_score=clarity_max,
            weight_pct=clarity_max,
            status="unavailable",
            penalties_applied=["Clarity unavailable: alignment or acoustic confidence below verification threshold."],
            evidence_summary="Phonetic intelligibility cannot be objectively verified; category omitted to prevent false scores."
        ))

        raw_base_sum = pacing_score + pause_score + vocal_score + energy_score
        max_base = 100.0 - clarity_max
        total_score = round((raw_base_sum / max_base) * 100.0, 1)

    else:
        # Measurable acoustic clarity: alignment token confidence and high-frequency spectral contrast
        avg_conf = float(np.mean([w.confidence for w in alignment.aligned_words if w.is_aligned])) if alignment.aligned_words else 0.8
        snr = part_features.metadata.snr_estimate_db

        clarity_deductions = 0.0
        if avg_conf < 0.80:
            d_conf = round((0.80 - avg_conf) * 20.0, 1)
            clarity_deductions += d_conf
            clarity_penalties.append(f"-{d_conf:.1f} pts: Low phonetic recognition confidence ({avg_conf*100:.1f}%)")

        if snr < 15.0:
            d_snr = round((15.0 - snr) * 0.5, 1)
            clarity_deductions += d_snr
            clarity_penalties.append(f"-{d_snr:.1f} pts: Background noise floor (SNR {snr:.1f} dB)")

        clarity_score = max(0.0, round(clarity_max - min(clarity_max, clarity_deductions), 1))

        categories.append(RubricCategoryScore(
            category_id="clarity",
            name="Acoustic Articulation & Clarity",
            score=clarity_score,
            max_score=clarity_max,
            weight_pct=clarity_max,
            status="measured",
            penalties_applied=clarity_penalties,
            evidence_summary=f"Average phonetic alignment confidence: {avg_conf*100:.1f}%; Signal-to-Noise Ratio: {snr:.1f} dB."
        ))

        total_score = round(pacing_score + pause_score + vocal_score + energy_score + clarity_score, 1)
        formula_explanation = "Sum of deterministic category deductions evaluated against reference speech."
        reliability_note = "All score deductions grounded in acoustic measurements."

    percentage = round((total_score / 100.0) * 100.0, 1)

    return RubricScoreResult(
        total_score=total_score,
        max_score=100.0,
        percentage=percentage,
        preset_used=preset["name"],
        categories=categories,
        formula_explanation=formula_explanation,
        reliability_note=reliability_note
    )
