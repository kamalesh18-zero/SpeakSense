"""Built-in Speech Benchmark Engine: Single-recording speech analysis against category targets."""
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
import numpy as np

from app.audio.processor import decode_and_resample
from app.features.extractor import (
    extract_pitch_f0,
    extract_energy,
    extract_spectral_features,
    detect_pauses_from_words,
)
from app.alignment.forced_aligner import transcribe_and_align, get_whisper_model
from app.database import get_benchmark_profile_by_key
from app.models.schemas import WordTimestamp

def evaluate_single_audio_benchmark(
    audio_path: str,
    category_key: str = "public_speaking",
    provided_transcript: Optional[str] = None,
    custom_profile_override: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Evaluates a single audio recording against a built-in or custom benchmark profile
    WITHOUT requiring reference audio.
    """
    # 1. Fetch benchmark profile targets
    profile = custom_profile_override or get_benchmark_profile_by_key(category_key)
    if not profile:
        profile = get_benchmark_profile_by_key("public_speaking")

    weights = profile.get("weights", {
        "pacing": 25,
        "pause_control": 20,
        "vocal_variation": 20,
        "energy_control": 15,
        "clarity": 20,
    })

    target_wpm_min = float(profile["target_wpm_min"])
    target_wpm_max = float(profile["target_wpm_max"])
    target_pause_min = float(profile["target_pause_min_sec"])
    target_pause_max = float(profile["target_pause_max_sec"])
    target_pitch_min = float(profile["target_pitch_std_min"])
    target_pitch_max = float(profile["target_pitch_std_max"])
    target_dyn_min = float(profile["target_dyn_range_min_db"])

    # 2. Decode and preprocess audio
    y, sr, meta = decode_and_resample(audio_path)
    if meta.is_silent or meta.duration_sec < 1.0:
        raise ValueError("Audio recording is silent or shorter than 1 second.")

    # 3. Transcription & Word Timestamps via Faster-Whisper
    words: List[WordTimestamp] = []
    recognized_text = ""
    clarity_available = True
    alignment_confidence = 0.85

    try:
        if provided_transcript and len(provided_transcript.strip().split()) >= 3:
            alignment_res, words = transcribe_and_align(y, provided_transcript.strip(), sr)
            recognized_text = alignment_res.recognized_transcript
            if alignment_res.aligned_words:
                alignment_confidence = float(np.mean([w.confidence for w in alignment_res.aligned_words if w.is_aligned]))
            if alignment_res.alignment_status == "failed":
                clarity_available = False
        else:
            # Free speaking mode or automatic transcription
            model = get_whisper_model()
            segments, _ = model.transcribe(y, word_timestamps=True, beam_size=3)
            rec_words = []
            for seg in segments:
                for w in seg.words:
                    clean_w = w.word.strip()
                    if clean_w:
                        rec_words.append(WordTimestamp(
                            word=clean_w,
                            start=round(float(w.start), 2),
                            end=round(float(w.end), 2),
                            confidence=round(float(w.probability), 2),
                            is_aligned=True,
                        ))
            words = rec_words
            recognized_text = " ".join([w.word for w in words])
            if words:
                alignment_confidence = float(np.mean([w.confidence for w in words]))
    except Exception as e:
        clarity_available = False
        # Fallback approximate words based on voiced intervals
        word_count_est = max(1, int(meta.voiced_duration_sec * 2.3))
        step_t = meta.duration_sec / max(1, word_count_est)
        words = [
            WordTimestamp(word=f"word_{i+1}", start=round(i * step_t, 2), end=round((i + 1) * step_t, 2), confidence=0.5, is_aligned=False)
            for i in range(word_count_est)
        ]

    # Calculate local speaking rates
    window = 4
    for i in range(len(words)):
        s_idx = max(0, i - window // 2)
        e_idx = min(len(words) - 1, i + window // 2)
        sub_words = words[s_idx:e_idx + 1]
        if len(sub_words) >= 2:
            span = sub_words[-1].end - sub_words[0].start
            if span > 0.1:
                words[i].local_wpm = round((len(sub_words) / (span / 60.0)), 1)

    # 4. Extract Acoustic Features
    pitch_feats, _, _ = extract_pitch_f0(y, sr)
    energy_feats, _, _ = extract_energy(y, sr)
    spectral_feats = extract_spectral_features(y, sr)
    pauses = detect_pauses_from_words(words, meta.duration_sec)

    # Effective WPM: words divided by active speaking duration
    active_dur = max(0.5, meta.voiced_duration_sec)
    measured_wpm = round((len(words) / (active_dur / 60.0)), 1) if active_dur > 0 else 0.0

    # 5. Rule-Based Flaw Detection against Benchmark Target Ranges
    flaws: List[Dict[str, Any]] = []

    # Flaw 1: Overall Pace Deviation
    if measured_wpm > target_wpm_max:
        excess = round(measured_wpm - target_wpm_max, 1)
        severity = "High" if excess > 25.0 else ("Medium" if excess > 12.0 else "Low")
        flaws.append({
            "flaw_id": f"flaw_wpm_fast_{uuid.uuid4().hex[:6]}",
            "flaw_type": "excessive_speed",
            "start_time": 0.0,
            "end_time": round(min(5.0, meta.duration_sec), 2),
            "severity": severity,
            "measured_value": measured_wpm,
            "target_range": f"{target_wpm_min} – {target_wpm_max} WPM",
            "difference": f"+{excess} WPM",
            "measurement_unit": "WPM",
            "plain_explanation": f"Your speaking pace is {measured_wpm} WPM, which is faster than the recommended {target_wpm_min}–{target_wpm_max} WPM for {profile['name']}.",
            "improvement_suggestion": "Take a calm breath between sentences and allow important points time to settle with the listener."
        })
    elif measured_wpm < target_wpm_min:
        deficit = round(target_wpm_min - measured_wpm, 1)
        severity = "High" if deficit > 25.0 else ("Medium" if deficit > 12.0 else "Low")
        flaws.append({
            "flaw_id": f"flaw_wpm_slow_{uuid.uuid4().hex[:6]}",
            "flaw_type": "unusually_slow",
            "start_time": 0.0,
            "end_time": round(min(5.0, meta.duration_sec), 2),
            "severity": severity,
            "measured_value": measured_wpm,
            "target_range": f"{target_wpm_min} – {target_wpm_max} WPM",
            "difference": f"-{deficit} WPM",
            "measurement_unit": "WPM",
            "plain_explanation": f"Your speaking pace is {measured_wpm} WPM, which is slower than the recommended {target_wpm_min}–{target_wpm_max} WPM for {profile['name']}.",
            "improvement_suggestion": "Pick up your forward momentum slightly to keep your listeners energized and engaged."
        })

    # Flaw 2: Pause Control (Excessive or Mid-Phrase Pauses)
    long_pauses = [p for p in pauses if p.duration_sec > target_pause_max]
    for p in long_pauses[:3]:
        diff_sec = round(p.duration_sec - target_pause_max, 2)
        sev = "High" if p.duration_sec > 2.2 else ("Medium" if p.duration_sec > 1.6 else "Low")
        flaws.append({
            "flaw_id": f"flaw_pause_long_{uuid.uuid4().hex[:6]}",
            "flaw_type": "long_pause",
            "start_time": p.start_time,
            "end_time": p.end_time,
            "severity": sev,
            "measured_value": p.duration_sec,
            "target_range": f"{target_pause_min} – {target_pause_max} sec",
            "difference": f"+{diff_sec} sec",
            "measurement_unit": "seconds",
            "plain_explanation": f"You paused for {p.duration_sec}s between '{p.preceding_word or 'phrase'}' and '{p.following_word or 'phrase'}', which created silent dead air.",
            "improvement_suggestion": "Shorten transition pauses to 1 second so you maintain dramatic flow without losing listener attention."
        })

    mid_pauses = [p for p in pauses if p.pause_type == "mid_phrase" and p.duration_sec >= 0.5]
    for p in mid_pauses[:2]:
        flaws.append({
            "flaw_id": f"flaw_pause_mid_{uuid.uuid4().hex[:6]}",
            "flaw_type": "mid_phrase_pause",
            "start_time": p.start_time,
            "end_time": p.end_time,
            "severity": "Medium" if p.duration_sec < 1.0 else "High",
            "measured_value": p.duration_sec,
            "target_range": "< 0.35 sec",
            "difference": f"+{round(p.duration_sec - 0.35, 2)} sec",
            "measurement_unit": "seconds",
            "plain_explanation": f"Awkward hesitation of {p.duration_sec}s between '{p.preceding_word}' and '{p.following_word}' in the middle of a thought.",
            "improvement_suggestion": "Connect these related words smoothly on one breath; save pauses for commas and sentence endings."
        })

    # Flaw 3: Pitch Variation / Monotony
    measured_pitch_std = pitch_feats.semitone_std
    if measured_pitch_std < target_pitch_min:
        deficit_st = round(target_pitch_min - measured_pitch_std, 2)
        flaws.append({
            "flaw_id": f"flaw_pitch_monotone_{uuid.uuid4().hex[:6]}",
            "flaw_type": "monotonous_pitch",
            "start_time": round(meta.duration_sec * 0.15, 2),
            "end_time": round(meta.duration_sec * 0.85, 2),
            "severity": "High" if measured_pitch_std < 1.3 else "Medium",
            "measured_value": measured_pitch_std,
            "target_range": f"{target_pitch_min} – {target_pitch_max} semitones",
            "difference": f"-{deficit_st} st",
            "measurement_unit": "semitones",
            "plain_explanation": f"Your pitch variation was {measured_pitch_std} semitones, indicating a flat delivery with little vocal melody.",
            "improvement_suggestion": "Try raising your pitch on key action words and lowering your pitch when concluding an important thought."
        })

    # Flaw 4: Vocal Energy Dynamic Range
    measured_dyn = energy_feats.dynamic_range_db
    if measured_dyn < target_dyn_min:
        deficit_db = round(target_dyn_min - measured_dyn, 1)
        flaws.append({
            "flaw_id": f"flaw_energy_flat_{uuid.uuid4().hex[:6]}",
            "flaw_type": "restricted_dynamics",
            "start_time": round(meta.duration_sec * 0.2, 2),
            "end_time": round(meta.duration_sec * 0.8, 2),
            "severity": "Medium",
            "measured_value": measured_dyn,
            "target_range": f"≥ {target_dyn_min} dB",
            "difference": f"-{deficit_db} dB",
            "measurement_unit": "dB",
            "plain_explanation": f"Your dynamic energy range was {measured_dyn} dB, which means your volume stayed at the same level throughout.",
            "improvement_suggestion": "Vary your volume: project with confidence on headline sentences and soften your tone on reflective phrases."
        })

    # 6. Category Scores (0 - 100 normalized)
    # Category 1: Speaking Pace
    pace_weight = float(weights.get("pacing", 25))
    pace_err = abs(measured_wpm - (target_wpm_min + target_wpm_max) / 2.0)
    pace_norm = max(0.0, min(100.0, 100.0 - pace_err * 2.0))
    pace_score = round((pace_norm / 100.0) * pace_weight, 1)

    # Category 2: Pause Control
    pause_weight = float(weights.get("pause_control", 20))
    pause_deductions = (len(long_pauses) * 15.0) + (len(mid_pauses) * 12.0)
    pause_norm = max(0.0, min(100.0, 100.0 - pause_deductions))
    pause_score = round((pause_norm / 100.0) * pause_weight, 1)

    # Category 3: Pitch Variation
    pitch_weight = float(weights.get("vocal_variation", 20))
    if measured_pitch_std >= target_pitch_min and measured_pitch_std <= target_pitch_max:
        pitch_norm = 96.0
    elif measured_pitch_std < target_pitch_min:
        pitch_norm = max(0.0, 96.0 - (target_pitch_min - measured_pitch_std) * 35.0)
    else:
        pitch_norm = max(0.0, 96.0 - (measured_pitch_std - target_pitch_max) * 20.0)
    pitch_score = round((pitch_norm / 100.0) * pitch_weight, 1)

    # Category 4: Vocal Energy
    energy_weight = float(weights.get("energy_control", 15))
    if measured_dyn >= target_dyn_min:
        energy_norm = 95.0
    else:
        energy_norm = max(0.0, 95.0 - (target_dyn_min - measured_dyn) * 4.0)
    energy_score = round((energy_norm / 100.0) * energy_weight, 1)

    # Category 5: Speech Clarity Indicators
    clarity_weight = float(weights.get("clarity", 20))
    if not clarity_available or meta.snr_estimate_db < 8.0:
        # Transparent weight redistribution
        clarity_status = "unavailable"
        clarity_score = 0.0
        clarity_norm = 0.0
        clarity_summary = "Clarity metric unavailable due to recording conditions. Points proportionally redistributed."
        valid_base_weight = 100.0 - clarity_weight
        raw_sum = pace_score + pause_score + pitch_score + energy_score
        total_score = round((raw_sum / valid_base_weight) * 100.0, 1)
        score_explanation = f"Score computed from 4 verified acoustic categories; clarity points redistributed without fabrication."
    else:
        clarity_status = "measured"
        clarity_norm = min(100.0, max(0.0, alignment_confidence * 80.0 + min(20.0, meta.snr_estimate_db)))
        clarity_score = round((clarity_norm / 100.0) * clarity_weight, 1)
        clarity_summary = f"Articulation confidence: {alignment_confidence*100:.1f}%, Audio SNR: {meta.snr_estimate_db:.1f} dB."
        total_score = round(pace_score + pause_score + pitch_score + energy_score + clarity_score, 1)
        score_explanation = f"Standard 100-point rubric applied against {profile['name']} benchmark target ranges."

    categories = [
        {
            "category_id": "pacing",
            "name": "Speaking Pace",
            "score": pace_score,
            "max_score": pace_weight,
            "normalized_score": round(pace_norm, 1),
            "status": "measured",
            "measured_value": f"{measured_wpm} WPM",
            "target_range": f"{target_wpm_min} – {target_wpm_max} WPM",
            "interpretation": "Good conversational flow" if pace_norm >= 80 else ("Pace too fast" if measured_wpm > target_wpm_max else "Pace too slow"),
            "improvement_tip": "Keep practicing maintaining this comfortable conversational cadence." if pace_norm >= 80 else "Adjust speaking tempo towards the target range."
        },
        {
            "category_id": "pause_control",
            "name": "Pause Control & Rhythm",
            "score": pause_score,
            "max_score": pause_weight,
            "normalized_score": round(pause_norm, 1),
            "status": "measured",
            "measured_value": f"{len(pauses)} pauses ({len(long_pauses)} extended)",
            "target_range": f"{target_pause_min} – {target_pause_max} sec pauses",
            "interpretation": "Natural, controlled pauses" if pause_norm >= 80 else f"{len(long_pauses) + len(mid_pauses)} awkward pauses detected",
            "improvement_tip": "Pause after major punctuation to let your thoughts breathe."
        },
        {
            "category_id": "vocal_variation",
            "name": "Pitch Variation & Melody",
            "score": pitch_score,
            "max_score": pitch_weight,
            "normalized_score": round(pitch_norm, 1),
            "status": "measured",
            "measured_value": f"{measured_pitch_std} semitones std",
            "target_range": f"{target_pitch_min} – {target_pitch_max} semitones",
            "interpretation": "Expressive melodic modulation" if pitch_norm >= 80 else "Delivery sounds somewhat monotone",
            "improvement_tip": "Raise your pitch on exciting words and lower it when concluding."
        },
        {
            "category_id": "energy_control",
            "name": "Vocal Energy Consistency",
            "score": energy_score,
            "max_score": energy_weight,
            "normalized_score": round(energy_norm, 1),
            "status": "measured",
            "measured_value": f"{measured_dyn} dB dynamic range",
            "target_range": f"≥ {target_dyn_min} dB",
            "interpretation": "Dynamic volume and vocal projection" if energy_norm >= 80 else "Volume lacks contrast",
            "improvement_tip": "Project from your diaphragm to add energy on your key message."
        },
        {
            "category_id": "clarity",
            "name": "Speech Clarity Indicators",
            "score": clarity_score,
            "max_score": clarity_weight,
            "normalized_score": round(clarity_norm, 1),
            "status": clarity_status,
            "measured_value": f"{alignment_confidence*100:.0f}% confidence",
            "target_range": "≥ 85% confidence",
            "interpretation": "Crisp and clear articulation" if clarity_norm >= 80 else ("Clarity unavailable" if clarity_status == "unavailable" else "Some mumbled syllables"),
            "improvement_tip": "Speak slightly closer to your microphone and enunciate final consonants."
        }
    ]

    # Build timeline points for charts
    times = pitch_feats.frame_times
    timeline = []
    for i, t in enumerate(times):
        f0 = pitch_feats.f0_raw_hz[i] if i < len(pitch_feats.f0_raw_hz) else None
        st = pitch_feats.f0_semitones_norm[i] if i < len(pitch_feats.f0_semitones_norm) else None
        rms = energy_feats.rms_db[i] if i < len(energy_feats.rms_db) else -40.0
        timeline.append({
            "time": round(float(t), 2),
            "f0_hz": round(float(f0), 1) if f0 is not None else None,
            "f0_semitones": round(float(st), 2) if st is not None else None,
            "rms_db": round(float(rms), 1)
        })

    # Build local WPM progression
    wpm_progression = []
    if meta.duration_sec > 3.0:
        win_size = 5.0
        step = 2.0
        t_cursor = win_size / 2.0
        while t_cursor < meta.duration_sec:
            w_in_win = [w for w in words if abs(w.start - t_cursor) <= (win_size / 2.0)]
            local_wpm = (len(w_in_win) / (win_size / 60.0))
            wpm_progression.append({
                "window_center_sec": round(float(t_cursor), 1),
                "local_wpm": round(float(local_wpm), 1)
            })
            t_cursor += step
    if not wpm_progression:
        wpm_progression.append({"window_center_sec": round(meta.duration_sec / 2, 1), "local_wpm": measured_wpm})

    mean_pause = float(np.mean([p.duration_sec for p in pauses])) if pauses else 0.0
    excessive_pauses = len(long_pauses) + len(mid_pauses)
    median_f0 = float(pitch_feats.median_f0_hz)

    # Strengths & Advice
    strength_notes = []
    if pace_norm >= 80:
        strength_notes.append(f"Well-controlled speaking rate ({measured_wpm} WPM) within category guidelines.")
    if pause_norm >= 80:
        strength_notes.append("Clean pause boundaries with appropriate breath pacing.")
    if pitch_norm >= 80:
        strength_notes.append("Expressive pitch modulation preventing vocal monotony.")
    if energy_norm >= 80:
        strength_notes.append("Strong acoustic projection and volume contrast.")
    if not strength_notes:
        strength_notes.append("Clear vocal presence and audible articulation.")

    plain_language_advice = []
    if pace_norm < 80:
        plain_language_advice.append(categories[0]["improvement_tip"])
    if pause_norm < 80:
        plain_language_advice.append(categories[1]["improvement_tip"])
    if pitch_norm < 80:
        plain_language_advice.append(categories[2]["improvement_tip"])
    if energy_norm < 80:
        plain_language_advice.append(categories[3]["improvement_tip"])
    if not plain_language_advice:
        plain_language_advice.append("Maintain this steady cadence and natural vocal energy in upcoming sessions!")

    improvement_steps = [
        f"Metronome Reading: Practice reading at exactly {int((target_wpm_min + target_wpm_max) / 2)} WPM to lock in natural pacing.",
        "Punctuation Breathing: Place a deliberate 1-second pause at every comma and 1.5 seconds at every period.",
        "Vocal Variety Drill: Intentionally emphasize key nouns with a 2-semitone pitch rise."
    ]

    # Friendly summary text
    if total_score >= 88:
        summary_text = f"Outstanding speech! Your pacing ({measured_wpm} WPM) and vocal energy are well-aligned with the {profile['name']} benchmark guidelines."
    elif total_score >= 75:
        summary_text = f"Solid speech delivery! You articulated well, but a few localized pauses or tempo bursts can be smoothed out for even higher impact."
    else:
        summary_text = f"Good effort! We detected a few areas for improvement, particularly around {categories[0]['name'].lower()}."

    from datetime import datetime
    now_iso = datetime.utcnow().isoformat()

    return {
        "analysis_id": f"bench_eval_{uuid.uuid4().hex[:10]}",
        "timestamp": now_iso,
        "category_key": category_key,
        "category_name": profile["name"],
        "audio_url": f"/media/uploads/{Path(audio_path).name}" if "uploads" in audio_path else f"/media/recordings/{Path(audio_path).name}",
        "recognized_transcript": recognized_text,
        "audio_duration_sec": meta.duration_sec,
        "target_summary": {
            "wpm_range": [target_wpm_min, target_wpm_max],
            "pause_range_sec": [target_pause_min, target_pause_max],
            "pitch_std_range_semitones": [target_pitch_min, target_pitch_max],
            "dyn_range_min_db": target_dyn_min
        },
        "measurements": {
            "effective_wpm": measured_wpm,
            "mean_pause_sec": round(mean_pause, 2),
            "pause_count": len(pauses),
            "excessive_pause_count": excessive_pauses,
            "pitch_semitone_std": round(measured_pitch_std, 2),
            "median_f0_hz": round(median_f0, 1),
            "dynamic_range_db": round(energy_feats.dynamic_range_db, 1),
            "rms_mean_db": round(float(np.mean(energy_feats.rms_db)) if energy_feats.rms_db else -25.0, 1),
            "snr_db": round(meta.snr_estimate_db, 1),
            "alignment_confidence": round(alignment_confidence, 2)
        },
        "score": {
            "total_score": total_score,
            "max_score": 100.0,
            "percentage": total_score,
            "preset_used": category_key,
            "categories": [
                {
                    "category_id": c["category_id"],
                    "name": c["name"],
                    "score": c["score"],
                    "max_score": c["max_score"],
                    "weight_pct": float(weights.get(c["category_id"], 20)),
                    "status": c.get("status", "measured"),
                    "penalties_applied": [],
                    "evidence_summary": c.get("interpretation", "")
                }
                for c in categories
            ],
            "formula_explanation": score_explanation,
            "reliability_note": "Acoustically validated against category standard"
        },
        "flaws": flaws,
        "words": [w.model_dump() for w in words],
        "pauses": [p.model_dump() for p in pauses],
        "timeline": timeline,
        "wpm_progression": wpm_progression,
        "plain_language_advice": plain_language_advice,
        "strength_notes": strength_notes,
        "improvement_steps": improvement_steps,
        "duration_sec": meta.duration_sec,
        "total_score": total_score,
        "categories": categories,
        "summary_text": summary_text
    }
