export interface AudioMetadata {
  duration_sec: number;
  sample_rate: number;
  channels: number;
  format: string;
  file_size_bytes: number;
  clipping_ratio: number;
  snr_estimate_db: number;
  voiced_duration_sec: number;
  is_silent: boolean;
  processing_notes: string[];
}

export interface SpectralFeatures {
  frame_times: number[];
  spectral_centroid: number[];
  spectral_rolloff: number[];
  spectral_contrast: number[];
  mfcc_summary: number[];
}

export interface PitchFeatures {
  frame_times: number[];
  f0_raw_hz: (number | null)[];
  f0_semitones_norm: (number | null)[];
  median_f0_hz: number;
  semitone_std: number;
  voiced_fraction: number;
}

export interface EnergyFeatures {
  frame_times: number[];
  rms_db: number[];
  dynamic_range_db: number;
  energy_variability_db: number;
}

export interface PauseSegment {
  start_time: number;
  end_time: number;
  duration_sec: number;
  pause_type: 'phrase_boundary' | 'mid_phrase' | 'breath';
  preceding_word?: string;
  following_word?: string;
  is_excessive: boolean;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
  is_aligned: boolean;
  local_wpm?: number;
  relative_stretch?: number;
}

export interface AudioFeatureSet {
  audio_id: string;
  metadata: AudioMetadata;
  words: WordTimestamp[];
  pauses: PauseSegment[];
  pitch: PitchFeatures;
  energy: EnergyFeatures;
  spectral: SpectralFeatures;
  overall_wpm: number;
}

export interface ForcedAlignmentResult {
  aligned_words: WordTimestamp[];
  canonical_transcript: string;
  recognized_transcript: string;
  mismatch_detected: boolean;
  similarity_ratio: number;
  alignment_status: 'verified' | 'partial' | 'failed';
  notes: string[];
}

export interface FlawEvidence {
  flaw_id: string;
  flaw_type: string;
  start_time: number;
  end_time: number;
  severity: 0 | 1 | 2 | 3;
  reference_value: number;
  participant_value: number;
  absolute_difference: number;
  relative_difference_pct: number;
  measurement_unit: string;
  explanation: string;
  improvement_suggestion: string;
  reliability_status: 'verified' | 'experimental' | 'unavailable';
  word_context?: string;
}

export interface RubricCategoryScore {
  category_id: string;
  name: string;
  score: number;
  max_score: number;
  weight_pct: number;
  status: 'measured' | 'redistributed' | 'unavailable';
  penalties_applied: string[];
  evidence_summary: string;
}

export interface RubricScoreResult {
  total_score: number;
  max_score: number;
  percentage: number;
  preset_used: string;
  categories: RubricCategoryScore[];
  formula_explanation: string;
  reliability_note: string;
}

export interface ContrastiveAnalysisResult {
  analysis_id: string;
  timestamp: string;
  script_id?: string;
  transcript: string;
  preset_name: string;
  reference_features: AudioFeatureSet;
  participant_features: AudioFeatureSet;
  alignment: ForcedAlignmentResult;
  dtw_distance: number;
  flaws: FlawEvidence[];
  score: RubricScoreResult;
  audio_url_reference: string;
  audio_url_participant: string;
}

export interface ScriptItem {
  id: string;
  title: string;
  category: string;
  target_duration_sec: number;
  transcript: string;
  description: string;
}

export interface RecordingItem {
  id: string;
  script_id: string;
  speaker_id: string;
  reference_id?: string;
  delivery_type: string;
  audio_path: string;
  filename: string;
  duration_sec: number;
  is_reference: number;
  split: string;
  created_at: string;
}

export interface AnnotationItem {
  id: string;
  sample_id: string;
  script_id: string;
  speaker_id: string;
  reference_id: string;
  flaw_category: string;
  flaw_start: number;
  flaw_end: number;
  severity: number;
  label_source: string;
  annotation_confidence: number;
  created_at?: string;
}

export interface BenchmarkMetrics {
  total_samples: number;
  ground_truth_flaw_count: number;
  detected_flaw_count: number;
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  precision: number;
  recall: number;
  f1_score: number;
  temporal_mean_iou: number;
  mean_boundary_error_sec: number;
  evaluated_at: string;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  mobile?: string;
  avatar_color?: string;
  created_at: string;
}

export interface BenchmarkProfileWeights {
  pacing: number;
  pause_control: number;
  vocal_variation: number;
  energy_control: number;
  clarity: number;
}

export interface BenchmarkProfile {
  id: string;
  category_key: string;
  name: string;
  description: string;
  is_builtin: number;
  user_id?: string;
  target_wpm_min: number;
  target_wpm_max: number;
  target_pause_min_sec: number;
  target_pause_max_sec: number;
  target_pitch_std_min: number;
  target_pitch_std_max: number;
  target_dyn_range_min_db: number;
  weights: BenchmarkProfileWeights;
  created_at: string;
}

export interface BenchmarkMeasurements {
  effective_wpm: number;
  mean_pause_sec: number;
  pause_count: number;
  excessive_pause_count: number;
  pitch_semitone_std: number;
  median_f0_hz: number;
  dynamic_range_db: number;
  rms_mean_db: number;
  snr_db: number;
  alignment_confidence: number;
}

export interface TimelineDataPoint {
  time: number;
  f0_hz: number | null;
  f0_semitones: number | null;
  rms_db: number;
}

export interface WpmProgressionPoint {
  window_center_sec: number;
  local_wpm: number;
}

export interface BenchmarkAnalysisResult {
  analysis_id: string;
  timestamp: string;
  category_key: string;
  category_name: string;
  audio_url: string;
  recognized_transcript: string;
  audio_duration_sec: number;
  target_summary: {
    wpm_range: [number, number];
    pause_range_sec: [number, number];
    pitch_std_range_semitones: [number, number];
    dyn_range_min_db: number;
  };
  measurements: BenchmarkMeasurements;
  score: RubricScoreResult;
  flaws: FlawEvidence[];
  words: WordTimestamp[];
  pauses: PauseSegment[];
  timeline: TimelineDataPoint[];
  wpm_progression: WpmProgressionPoint[];
  plain_language_advice: string[];
  strength_notes: string[];
  improvement_steps: string[];
}

export interface AnalysisHistoryItem {
  id: string;
  script_id?: string;
  preset_used: string;
  analysis_type: 'benchmark' | 'contrastive';
  total_score: number;
  created_at: string;
}

