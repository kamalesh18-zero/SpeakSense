"""FastAPI REST API routes for SpeakSense AI."""
import os
import uuid
import csv
import io
import json
from pathlib import Path
from typing import List, Optional, Dict, Any
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Header
from fastapi.responses import JSONResponse, Response

from app.config import (
    UPLOADS_DIR,
    RECORDINGS_DIR,
    DEFAULT_THRESHOLDS,
    RUBRIC_PRESETS,
    SAMPLE_RATE
)
from app.database import (
    get_all_scripts,
    get_all_recordings,
    get_all_annotations,
    insert_annotation,
    save_analysis,
    get_recent_analyses,
    get_analysis_by_id,
    insert_recording,
    get_db_connection,
    create_user,
    get_user_by_email,
    get_user_by_id,
    update_user_profile,
    get_all_benchmark_profiles,
    get_benchmark_profile_by_key,
    update_benchmark_profile,
    reset_default_benchmarks,
    delete_analysis
)
from app.auth import (
    hash_password,
    verify_password,
    create_user_session,
    get_user_from_session,
    delete_user_session,
    get_current_user_optional,
    get_current_user_required
)
from app.audio.processor import decode_and_resample
from app.alignment.forced_aligner import transcribe_and_align
from app.features.extractor import extract_all_features
from app.comparison.comparator import (
    align_and_contrast_words,
    compute_dtw_acoustic_distance,
    compute_phrase_level_comparisons
)
from app.flaws.detector import detect_temporal_flaws
from app.scoring.engine import compute_rubric_scores
from app.scoring.benchmark_engine import evaluate_single_audio_benchmark
from app.dataset.evaluator import evaluate_flaw_detection_benchmark
from app.models.schemas import (
    ContrastiveAnalysisResult,
    BenchmarkMetrics,
    UserRegisterRequest,
    UserLoginRequest,
    UserProfileUpdateRequest,
    BenchmarkProfileUpdateRequest
)

router = APIRouter(prefix="/api")

# ----------------- Health & Hardware -----------------
@router.get("/health")
def get_health():
    import ctranslate2
    import soundfile
    import librosa
    return {
        "status": "healthy",
        "service": "SpeakSense AI Backend",
        "hardware": {
            "platform": "windows",
            "cpu_device": "Intel/AMD x86_64",
            "cuda_available": False,
            "ctranslate2_version": ctranslate2.__version__,
            "whisper_device": "cpu (int8 quantized)",
            "librosa_version": librosa.__version__,
            "soundfile_version": soundfile.__version__,
        }
    }

# ----------------- Authentication -----------------
@router.post("/auth/register")
def register_user(payload: UserRegisterRequest):
    if not payload.email or "@" not in payload.email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    existing = get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    
    pwd_hash, salt = hash_password(payload.password)
    user = create_user(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=pwd_hash,
        salt=salt,
        mobile=payload.mobile
    )
    token = create_user_session(user["id"])
    return {
        "status": "success",
        "token": token,
        "user": user
    }

@router.post("/auth/login")
def login_user(payload: UserLoginRequest):
    user_record = get_user_by_email(payload.email)
    if not user_record:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    if not verify_password(payload.password, user_record["salt"], user_record["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    token = create_user_session(user_record["id"])
    safe_user = {
        "id": user_record["id"],
        "full_name": user_record["full_name"],
        "email": user_record["email"],
        "mobile": user_record.get("mobile"),
        "avatar_color": user_record.get("avatar_color", "#14B8A6"),
        "created_at": user_record["created_at"]
    }
    return {
        "status": "success",
        "token": token,
        "user": safe_user
    }

@router.get("/auth/me")
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user_required)):
    return {"status": "success", "user": user}

@router.post("/auth/logout")
def logout_user(authorization: Optional[str] = Header(None)):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        delete_user_session(token)
    return {"status": "success", "message": "Logged out successfully."}

@router.put("/auth/profile")
def update_profile(payload: UserProfileUpdateRequest, user: Dict[str, Any] = Depends(get_current_user_required)):
    update_user_profile(user["id"], payload.full_name, payload.mobile, payload.avatar_color)
    updated = get_user_by_id(user["id"])
    return {"status": "success", "user": updated}

# ----------------- Benchmark Profiles -----------------
@router.get("/benchmarks")
def list_benchmark_profiles(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    user_id = user["id"] if user else None
    return get_all_benchmark_profiles(user_id=user_id)

@router.get("/benchmarks/{category_key}")
def get_benchmark_profile(category_key: str):
    profile = get_benchmark_profile_by_key(category_key)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Benchmark profile '{category_key}' not found.")
    return profile

@router.put("/benchmarks/{category_key}")
def edit_benchmark_profile(category_key: str, payload: BenchmarkProfileUpdateRequest):
    existing = get_benchmark_profile_by_key(category_key)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Benchmark profile '{category_key}' not found.")
    data = payload.model_dump(exclude_unset=True)
    update_benchmark_profile(category_key, data)
    return {"status": "success", "profile": get_benchmark_profile_by_key(category_key)}

@router.post("/benchmarks/reset")
def reset_benchmarks():
    reset_default_benchmarks()
    return {"status": "success", "profiles": get_all_benchmark_profiles()}

# ----------------- Single-Audio Benchmark Analysis -----------------
@router.post("/analyze/benchmark")
async def analyze_benchmark_speech(
    audio_file: Optional[UploadFile] = File(None),
    audio_path: Optional[str] = Form(None),
    category_key: str = Form("public_speaking"),
    transcript: Optional[str] = Form(None),
    script_id: Optional[str] = Form(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Evaluates a single audio recording against a built-in benchmark profile
    WITHOUT requiring a reference audio.
    """
    target_path = None
    if audio_file:
        file_ext = Path(audio_file.filename or "recording.wav").suffix or ".wav"
        unique_filename = f"bench_{uuid.uuid4().hex[:10]}{file_ext}"
        dest_path = UPLOADS_DIR / unique_filename
        contents = await audio_file.read()
        with open(dest_path, "wb") as f:
            f.write(contents)
        target_path = str(dest_path)
    elif audio_path:
        cand = Path(audio_path)
        if cand.exists():
            target_path = str(cand)
        elif (RECORDINGS_DIR / cand.name).exists():
            target_path = str(RECORDINGS_DIR / cand.name)
        elif (UPLOADS_DIR / cand.name).exists():
            target_path = str(UPLOADS_DIR / cand.name)
        else:
            raise HTTPException(status_code=404, detail=f"Audio file not found: {audio_path}")
    else:
        raise HTTPException(status_code=400, detail="Either audio_file upload or audio_path is required.")

    try:
        result = evaluate_single_audio_benchmark(
            audio_path=target_path,
            category_key=category_key,
            provided_transcript=transcript
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Audio analysis failed: {str(e)}")

    analysis_id = result["analysis_id"]
    user_id = user["id"] if user else None
    total_score = float(result["score"]["total_score"])

    # Store analysis record in SQLite
    save_analysis(
        analysis_id=analysis_id,
        script_id=script_id,
        ref_id=None,
        part_id=Path(target_path).name,
        preset=category_key,
        score=total_score,
        result_dict=result,
        user_id=user_id,
        analysis_type="benchmark"
    )

    return result

# ----------------- User History -----------------
@router.get("/user/history")
def list_user_history(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    user_id = user["id"] if user else None
    return get_recent_analyses(limit=50, user_id=user_id)

@router.delete("/user/history/{analysis_id}")
def delete_history_item(analysis_id: str, user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    user_id = user["id"] if user else None
    success = delete_analysis(analysis_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Analysis record not found.")
    return {"status": "success", "deleted_id": analysis_id}


# ----------------- Scripts & Dataset -----------------
@router.get("/scripts")
def list_scripts():
    return get_all_scripts()

@router.get("/recordings")
def list_recordings(script_id: Optional[str] = None):
    return get_all_recordings(script_id=script_id)

@router.get("/annotations")
def list_annotations():
    return get_all_annotations()

@router.post("/annotations")
def create_annotation(annotation: Dict[str, Any]):
    if not annotation.get("id"):
        annotation["id"] = f"ann_{uuid.uuid4().hex[:8]}"
    insert_annotation(annotation)
    return {"status": "success", "annotation": annotation}

@router.delete("/annotations/{ann_id}")
def delete_annotation(ann_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM annotations WHERE id = ?", (ann_id,))
    conn.commit()
    conn.close()
    return {"status": "success", "deleted_id": ann_id}

@router.get("/dataset/export/json")
def export_dataset_json():
    recordings = get_all_recordings()
    annotations = get_all_annotations()
    data = {
        "recordings": recordings,
        "annotations": annotations,
    }
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=speaksense_dataset.json"}
    )

@router.get("/dataset/export/csv")
def export_dataset_csv():
    annotations = get_all_annotations()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "sample_id", "script_id", "speaker_id", "reference_id",
        "flaw_category", "flaw_start", "flaw_end", "severity",
        "label_source", "annotation_confidence"
    ])
    for a in annotations:
        writer.writerow([
            a["sample_id"], a["script_id"], a["speaker_id"], a["reference_id"],
            a["flaw_category"], a["flaw_start"], a["flaw_end"], a["severity"],
            a.get("label_source", "expert_human"), a.get("annotation_confidence", 1.0)
        ])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=speaksense_annotations.csv"}
    )

# ----------------- Benchmark Evaluation -----------------
@router.post("/dataset/evaluate", response_model=BenchmarkMetrics)
def run_evaluation(split: str = "test"):
    return evaluate_flaw_detection_benchmark(split_filter=split)

# ----------------- Audio Upload -----------------
@router.post("/audio/upload")
async def upload_audio(file: UploadFile = File(...), audio_type: str = Form("participant")):
    """Uploads a WAV or MP3 audio file and validates decoding."""
    ext = Path(file.filename or "recording.wav").suffix.lower()
    if ext not in [".wav", ".mp3", ".ogg", ".m4a", ".flac"]:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}. Please upload WAV or MP3.")

    unique_id = f"{audio_type}_{uuid.uuid4().hex[:8]}"
    out_filename = f"{unique_id}{ext}"
    out_path = UPLOADS_DIR / out_filename

    content = await file.read()
    with open(out_path, "wb") as f:
        f.write(content)

    # Validate audio with preprocessor
    try:
        y, sr, meta = decode_and_resample(str(out_path))
    except Exception as e:
        if out_path.exists():
            out_path.unlink()
        raise HTTPException(status_code=400, detail=f"Audio decoding failed: {str(e)}")

    return {
        "audio_id": unique_id,
        "filename": out_filename,
        "filepath": str(out_path),
        "url": f"/media/uploads/{out_filename}",
        "metadata": meta.model_dump()
    }

# ----------------- Core End-to-End Analysis -----------------
@router.post("/analyze", response_model=ContrastiveAnalysisResult)
async def analyze_speech(
    reference_path: str = Form(...),
    participant_path: str = Form(...),
    transcript: str = Form(...),
    preset_name: str = Form("persuasive_oratory"),
    script_id: Optional[str] = Form(None),
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
):
    """
    Core contrastive speech evaluation pipeline:
    1. Preprocess both audio files (mono, resample, VAD, clipping, SNR)
    2. Forced alignment via Faster-Whisper
    3. Acoustic feature extraction (FFT, MFCC, PYIN F0, RMS, pauses)
    4. Contrastive alignment & DTW distance
    5. Rule-based temporal flaw detection with mathematical evidence
    6. Deterministic 100-pt rubric score calculation
    """
    if not os.path.exists(reference_path):
        # Look in RECORDINGS_DIR or UPLOADS_DIR
        candidate1 = RECORDINGS_DIR / Path(reference_path).name
        candidate2 = UPLOADS_DIR / Path(reference_path).name
        if candidate1.exists():
            reference_path = str(candidate1)
        elif candidate2.exists():
            reference_path = str(candidate2)
        else:
            raise HTTPException(status_code=404, detail=f"Reference audio not found: {reference_path}")

    if not os.path.exists(participant_path):
        candidate1 = RECORDINGS_DIR / Path(participant_path).name
        candidate2 = UPLOADS_DIR / Path(participant_path).name
        if candidate1.exists():
            participant_path = str(candidate1)
        elif candidate2.exists():
            participant_path = str(candidate2)
        else:
            raise HTTPException(status_code=404, detail=f"Participant audio not found: {participant_path}")

    if not transcript or len(transcript.strip().split()) < 3:
        raise HTTPException(status_code=400, detail="Transcript is too short or empty. Minimum 3 words required.")

    # 1. Decode and preprocess audio
    ref_y, ref_sr, ref_meta = decode_and_resample(reference_path)
    part_y, part_sr, part_meta = decode_and_resample(participant_path)

    if ref_meta.is_silent or part_meta.is_silent:
        raise HTTPException(status_code=400, detail="One or both audio recordings contain near-total silence.")

    # 2. Transcription and forced alignment
    ref_align, ref_words = transcribe_and_align(ref_y, transcript, ref_sr)
    part_align, part_words = transcribe_and_align(part_y, transcript, part_sr)

    # 3. Acoustic features
    ref_id = Path(reference_path).stem
    part_id = Path(participant_path).stem

    ref_features = extract_all_features(ref_id, reference_path, ref_words, ref_y, ref_sr, ref_meta)
    part_features = extract_all_features(part_id, participant_path, part_words, part_y, part_sr, part_meta)

    # 4. DTW acoustic distance & word contrasts
    dtw_dist = compute_dtw_acoustic_distance(
        np.array(ref_features.spectral.mfcc_summary).reshape(-1, 1),
        np.array(part_features.spectral.mfcc_summary).reshape(-1, 1)
    )
    contrasts = align_and_contrast_words(ref_words, part_words)

    # 5. Temporal flaw detection
    flaws = detect_temporal_flaws(ref_features, part_features, contrasts)

    # 6. Scoring
    score_result = compute_rubric_scores(
        ref_features=ref_features,
        part_features=part_features,
        alignment=part_align,
        flaws=flaws,
        preset_name=preset_name,
        clarity_available=bool(not part_align.mismatch_detected)
    )

    # URLs
    ref_sub = "recordings" if "recordings" in reference_path else "uploads"
    part_sub = "recordings" if "recordings" in participant_path else "uploads"
    url_ref = f"/media/{ref_sub}/{Path(reference_path).name}"
    url_part = f"/media/{part_sub}/{Path(participant_path).name}"

    analysis_id = f"analysis_{uuid.uuid4().hex[:10]}"
    from datetime import datetime
    now_ts = datetime.utcnow().isoformat()

    result = ContrastiveAnalysisResult(
        analysis_id=analysis_id,
        timestamp=now_ts,
        script_id=script_id,
        transcript=transcript,
        preset_name=preset_name,
        reference_features=ref_features,
        participant_features=part_features,
        alignment=part_align,
        dtw_distance=dtw_dist,
        flaws=flaws,
        score=score_result,
        audio_url_reference=url_ref,
        audio_url_participant=url_part
    )

    # Save to SQLite
    user_id = user["id"] if user else None
    save_analysis(
        analysis_id=analysis_id,
        script_id=script_id,
        ref_id=ref_id,
        part_id=part_id,
        preset=preset_name,
        score=score_result.total_score,
        result_dict=result.model_dump(),
        user_id=user_id,
        analysis_type="contrastive"
    )

    return result

# ----------------- Analyses & Reports -----------------
@router.get("/analysis/recent")
def list_recent_analyses(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    user_id = user["id"] if user else None
    return get_recent_analyses(limit=15, user_id=user_id)

@router.get("/analysis/{analysis_id}")
def get_analysis(analysis_id: str):
    record = get_analysis_by_id(analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail="Analysis record not found.")
    return record["result"]

# ----------------- Settings -----------------
@router.get("/settings")
def get_settings():
    return {
        "thresholds": DEFAULT_THRESHOLDS,
        "rubric_presets": RUBRIC_PRESETS
    }

@router.post("/settings")
def update_settings(payload: Dict[str, Any]):
    # Allow overriding thresholds or presets in memory/session
    if "thresholds" in payload:
        DEFAULT_THRESHOLDS.update(payload["thresholds"])
    return {"status": "success", "thresholds": DEFAULT_THRESHOLDS}


# ----------------- Gemini AI Speech & Coaching Features -----------------
from app.services.gemini_service import (
    generate_speech_script,
    ask_coach_ai,
    diagnose_flaws_ai,
    polish_speech_transcript
)

@router.post("/ai/generate-script")
async def api_generate_script(payload: Dict[str, Any]):
    topic = payload.get("topic", "").strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required.")
    category = payload.get("category", "persuasive_oratory")
    duration_seconds = int(payload.get("duration_seconds", 45))
    tone = payload.get("tone", "inspiring")

    try:
        result = await generate_speech_script(
            topic=topic,
            category=category,
            duration_seconds=duration_seconds,
            tone=tone
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/ai/ask-coach")
async def api_ask_coach(payload: Dict[str, Any]):
    question = payload.get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required.")
    context = payload.get("context", "")

    try:
        result = await ask_coach_ai(user_question=question, context=context)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Coach AI failed: {str(e)}")


@router.post("/ai/flaw-doctor")
async def api_flaw_doctor(payload: Dict[str, Any]):
    measurements = payload.get("measurements", {})
    try:
        result = await diagnose_flaws_ai(acoustic_metrics=measurements)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flaw Doctor failed: {str(e)}")


@router.post("/ai/polish-speech")
async def api_polish_speech(payload: Dict[str, Any]):
    text = payload.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required.")
    try:
        result = await polish_speech_transcript(raw_text=text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Speech polishing failed: {str(e)}")

