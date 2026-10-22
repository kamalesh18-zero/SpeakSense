"""Faster-Whisper transcription and sequence-guided forced alignment engine."""
import re
import difflib
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
from faster_whisper import WhisperModel

from app.models.schemas import WordTimestamp, ForcedAlignmentResult

# Global cached model instance
_WHISPER_MODEL: Optional[WhisperModel] = None

def get_whisper_model(model_size: str = "tiny.en") -> WhisperModel:
    """Returns singleton WhisperModel instance running on CPU with int8 quantization."""
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        _WHISPER_MODEL = WhisperModel(model_size, device="cpu", compute_type="int8")
    return _WHISPER_MODEL

def clean_token(token: str) -> str:
    """Normalize token by lowercasing and stripping punctuation."""
    return re.sub(r"[^\w\s]", "", token).lower().strip()

def transcribe_and_align(
    audio_data: np.ndarray,
    canonical_transcript: str,
    sr: int = 16000
) -> Tuple[ForcedAlignmentResult, List[WordTimestamp]]:
    """
    1. Transcribes audio using faster-whisper with word-level timestamps.
    2. Compares recognized words against canonical transcript.
    3. Flags substantial mismatches (similarity < 60%).
    4. Force-aligns timestamps to the canonical transcript words.
    5. Excludes unreliable/unaligned regions.
    """
    model = get_whisper_model()
    
    # Run transcription on raw numpy float32 audio
    segments, info = model.transcribe(
        audio_data,
        word_timestamps=True,
        beam_size=3,
        temperature=0.0
    )

    recognized_words: List[Dict[str, Any]] = []
    recognized_tokens: List[str] = []

    for seg in segments:
        for w in seg.words:
            w_text = w.word.strip()
            if not w_text:
                continue
            recognized_words.append({
                "word": w_text,
                "clean": clean_token(w_text),
                "start": round(float(w.start), 3),
                "end": round(float(w.end), 3),
                "confidence": round(float(w.probability), 3)
            })
            recognized_tokens.append(clean_token(w_text))

    # Parse canonical transcript
    canonical_raw_words = canonical_transcript.split()
    canonical_tokens = [clean_token(w) for w in canonical_raw_words]

    # Compare sequence similarity
    matcher = difflib.SequenceMatcher(None, canonical_tokens, recognized_tokens)
    similarity_ratio = round(float(matcher.ratio()), 3)

    notes: List[str] = []
    mismatch_detected = bool(similarity_ratio < 0.60)
    
    if mismatch_detected:
        notes.append(f"Substantial transcript mismatch detected (similarity: {similarity_ratio*100:.1f}%).")
        alignment_status = "failed"
    elif similarity_ratio < 0.85:
        notes.append(f"Minor word variations detected (similarity: {similarity_ratio*100:.1f}%).")
        alignment_status = "partial"
    else:
        notes.append(f"High-fidelity transcript alignment (similarity: {similarity_ratio*100:.1f}%).")
        alignment_status = "verified"

    # Aligned words list for the canonical transcript
    aligned_words: List[WordTimestamp] = []
    
    # Map matched blocks
    rec_idx_map: Dict[int, int] = {}
    for block in matcher.get_matching_blocks():
        c_start, r_start, length = block
        for k in range(length):
            rec_idx_map[c_start + k] = r_start + k

    last_end = 0.0
    for i, orig_word in enumerate(canonical_raw_words):
        if i in rec_idx_map:
            r_idx = rec_idx_map[i]
            r_w = recognized_words[r_idx]
            start_t = r_w["start"]
            end_t = r_w["end"]
            conf = r_w["confidence"]
            last_end = end_t
            aligned_words.append(WordTimestamp(
                word=orig_word,
                start=start_t,
                end=end_t,
                confidence=conf,
                is_aligned=True
            ))
        else:
            # Word unaligned / skipped in speech
            # Assign interpolated timestamp range marked as unaligned
            interpolated_start = round(last_end, 3)
            interpolated_end = round(last_end + 0.3, 3)
            aligned_words.append(WordTimestamp(
                word=orig_word,
                start=interpolated_start,
                end=interpolated_end,
                confidence=0.0,
                is_aligned=False
            ))
            notes.append(f"Word '{orig_word}' not clearly spoken or unaligned.")

    # Calculate local speaking rate (WPM) for aligned words
    window_size = 5
    for idx in range(len(aligned_words)):
        if not aligned_words[idx].is_aligned:
            continue
        w_start_idx = max(0, idx - window_size // 2)
        w_end_idx = min(len(aligned_words) - 1, idx + window_size // 2)
        window_words = [aligned_words[k] for k in range(w_start_idx, w_end_idx + 1) if aligned_words[k].is_aligned]
        
        if len(window_words) >= 2:
            time_span = window_words[-1].end - window_words[0].start
            if time_span > 0.1:
                local_wpm = round((len(window_words) / (time_span / 60.0)), 1)
                aligned_words[idx].local_wpm = local_wpm

    result = ForcedAlignmentResult(
        aligned_words=aligned_words,
        canonical_transcript=canonical_transcript,
        recognized_transcript=" ".join([w["word"] for w in recognized_words]),
        mismatch_detected=mismatch_detected,
        similarity_ratio=similarity_ratio,
        alignment_status=alignment_status,
        notes=notes
    )

    return result, aligned_words
