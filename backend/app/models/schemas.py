"""Pydantic schemas and data models for SpeakSense AI."""
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

# ----------------- Audio & Preprocessing -----------------

class AudioMetadata(BaseModel):
    duration_sec: float
    sample_rate: int
    channels: int
    format: str
    file_size_bytes: int
    clipping_ratio: float
    snr_estimate_db: float
    voiced_duration_sec: float
    is_silent: bool = False
    processing_notes: List[str] = Field(default_factory=list)

# ----------------- Acoustic Features -----------------

class SpectralFeatures(BaseModel):
    frame_times: List[float]
    spectral_centroid: List[float]
    spectral_rolloff: List[float]
    spectral_contrast: List[float]
    mfcc_summary: List[float]  # 13 means

class PitchFeatures(BaseModel):
    frame_times: List[float]
    f0_raw_hz: List[Optional[float]]
    f0_semitones_norm: List[Optional[float]]  # Centered around speaker median
    median_f0_hz: float
    semitone_std: float
    voiced_fraction: float

class EnergyFeatures(BaseModel):
    frame_times: List[float]
    rms_db: List[float]
    dynamic_range_db: float
    energy_variability_db: float

class PauseSegment(BaseModel):
    start_time: float
    end_time: float
    duration_sec: float
    pause_type: Literal["phrase_boundary", "mid_phrase", "breath"]
    preceding_word: Optional[str] = None
    following_word: Optional[str] = None
    is_excessive: bool = False

class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float
    confidence: float = 1.0
    is_aligned: bool = True
    local_wpm: Optional[float] = None
    relative_stretch: Optional[float] = None  # vs reference

class AudioFeatureSet(BaseModel):
    audio_id: str
    metadata: AudioMetadata
    words: List[WordTimestamp]
    pauses: List[PauseSegment]
    pitch: PitchFeatures
    energy: EnergyFeatures
    spectral: SpectralFeatures
    overall_wpm: float

# ----------------- Alignment -----------------

class ForcedAlignmentResult(BaseModel):
    aligned_words: List[WordTimestamp]
    canonical_transcript: str
    recognized_transcript: str
    mismatch_detected: bool
    similarity_ratio: float
    alignment_status: Literal["verified", "partial", "failed"]
    notes: List[str] = Field(default_factory=list)

# ----------------- Flaws & Evidence -----------------

class FlawEvidence(BaseModel):
    flaw_id: str
    flaw_type: str
    start_time: float
    end_time: float
    severity: int = Field(ge=0, le=3)  # 0=Reference-like, 1=Mild, 2=Moderate, 3=Severe
    reference_value: float
    participant_value: float
    absolute_difference: float
    relative_difference_pct: float
    measurement_unit: str
    explanation: str
    improvement_suggestion: str
    reliability_status: Literal["verified", "experimental", "unavailable"] = "verified"
    word_context: Optional[str] = None

# ----------------- Scoring & Rubric -----------------

class RubricCategoryScore(BaseModel):
    category_id: str
    name: str
    score: float
    max_score: float
    weight_pct: float
    status: Literal["measured", "redistributed", "unavailable"] = "measured"
    penalties_applied: List[str] = Field(default_factory=list)
    evidence_summary: str

class RubricScoreResult(BaseModel):
    total_score: float
    max_score: float
    percentage: float
    preset_used: str
    categories: List[RubricCategoryScore]
    formula_explanation: str
    reliability_note: str

# ----------------- Full Comparison Result -----------------

class ContrastiveAnalysisResult(BaseModel):
    analysis_id: str
    timestamp: str
    script_id: Optional[str] = None
    transcript: str
    preset_name: str
    reference_features: AudioFeatureSet
    participant_features: AudioFeatureSet
    alignment: ForcedAlignmentResult
    dtw_distance: float
    flaws: List[FlawEvidence]
    score: RubricScoreResult
    audio_url_reference: str
    audio_url_participant: str

# ----------------- Dataset & Benchmarking -----------------

class DatasetAnnotation(BaseModel):
    annotation_id: Optional[str] = None
    sample_id: str
    script_id: str
    speaker_id: str
    reference_id: str
    transcript: str
    audio_path: str
    delivery_type: Literal[
        "ideal_reference",
        "excessively_fast",
        "flat_monotonous",
        "awkward_pauses",
        "misplaced_emphasis",
        "near_perfect"
    ]
    severity: int = Field(ge=0, le=3)
    flaw_start: float
    flaw_end: float
    flaw_category: str
    label_source: str = "expert_human"
    annotation_confidence: float = 1.0
    split: Literal["train", "val", "test"] = "train"

class BenchmarkMetrics(BaseModel):
    total_samples: int
    ground_truth_flaw_count: int
    detected_flaw_count: int
    true_positives: int
    false_positives: int
    false_negatives: int
    precision: float
    recall: float
    f1_score: float
    temporal_mean_iou: float
    evaluated_at: str

# ----------------- Auth & Benchmark Schemas -----------------

class UserRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    mobile: Optional[str] = None

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserProfileUpdateRequest(BaseModel):
    full_name: str
    mobile: Optional[str] = None
    avatar_color: Optional[str] = None

class BenchmarkProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_wpm_min: Optional[float] = None
    target_wpm_max: Optional[float] = None
    target_pause_min_sec: Optional[float] = None
    target_pause_max_sec: Optional[float] = None
    target_pitch_std_min: Optional[float] = None
    target_pitch_std_max: Optional[float] = None
    target_dyn_range_min_db: Optional[float] = None
    weights: Optional[Dict[str, float]] = None

