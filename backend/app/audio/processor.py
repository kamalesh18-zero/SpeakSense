"""Audio decoding, validation, and preprocessing pipeline."""
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Tuple, List
import numpy as np
import soundfile as sf
import librosa
import imageio_ffmpeg

from app.config import SAMPLE_RATE, VAD_TOP_DB
from app.models.schemas import AudioMetadata

def decode_and_resample(file_path: str, target_sr: int = SAMPLE_RATE) -> Tuple[np.ndarray, int, AudioMetadata]:
    """
    Decodes audio (WAV, MP3, etc.), converts to mono, resamples to target_sr,
    and calculates signal quality metadata (clipping, SNR, voiced regions).
    """
    path_obj = Path(file_path)
    if not path_obj.exists():
        raise FileNotFoundError(f"Audio file not found: {file_path}")

    file_size = path_obj.stat().st_size
    format_ext = path_obj.suffix.lower().lstrip(".")
    processing_notes: List[str] = []

    # Attempt decoding via soundfile or fallback to ffmpeg
    try:
        data, sr = sf.read(str(path_obj), dtype="float32")
    except Exception as e:
        processing_notes.append(f"Standard decoding fallback to FFmpeg: {str(e)}")
        # Convert to temp wav via imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_wav = tmp.name

        try:
            cmd = [
                ffmpeg_exe, "-y", "-i", str(path_obj),
                "-ac", "1", "-ar", str(target_sr),
                "-f", "wav", tmp_wav
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            data, sr = sf.read(tmp_wav, dtype="float32")
        finally:
            if os.path.exists(tmp_wav):
                try:
                    os.remove(tmp_wav)
                except OSError:
                    pass

    # Ensure 1D mono
    channels = 1
    if data.ndim > 1:
        channels = data.shape[1]
        data = np.mean(data, axis=1)
        processing_notes.append(f"Averaged {channels} channels into mono.")

    # Resample if needed
    if sr != target_sr:
        data = librosa.resample(data, orig_sr=sr, target_sr=target_sr)
        sr = target_sr
        processing_notes.append(f"Resampled to {target_sr} Hz.")

    # Duration
    duration_sec = float(len(data) / sr)

    # Silence check
    max_amp = float(np.max(np.abs(data))) if len(data) > 0 else 0.0
    is_silent = bool(max_amp < 1e-4)
    if is_silent:
        processing_notes.append("Warning: Audio signal is near-silent.")

    # Clipping detection (samples near +/- 1.0)
    clipping_count = int(np.sum(np.abs(data) >= 0.99))
    clipping_ratio = float(clipping_count / len(data)) if len(data) > 0 else 0.0
    if clipping_ratio > 0.01:
        processing_notes.append(f"Warning: Significant clipping detected ({clipping_ratio*100:.2f}% of samples).")

    # Noise level & SNR estimation
    # Use frame energy percentiles: 90th percentile (speech) vs 10th percentile (noise floor)
    frame_length = 1024
    hop_length = 512
    if len(data) > frame_length:
        rms_frames = librosa.feature.rms(y=data, frame_length=frame_length, hop_length=hop_length)[0]
        rms_db = 20 * np.log10(np.maximum(rms_frames, 1e-6))
        speech_p90 = np.percentile(rms_db, 90)
        noise_p10 = np.percentile(rms_db, 10)
        snr_est = float(np.clip(speech_p90 - noise_p10, 0.0, 60.0))
    else:
        snr_est = 25.0

    # Voiced / non-silent intervals using librosa effects split
    intervals = librosa.effects.split(data, top_db=VAD_TOP_DB)
    voiced_samples = sum(end - start for start, end in intervals)
    voiced_duration_sec = float(voiced_samples / sr)

    metadata = AudioMetadata(
        duration_sec=round(duration_sec, 3),
        sample_rate=sr,
        channels=channels,
        format=format_ext,
        file_size_bytes=file_size,
        clipping_ratio=round(clipping_ratio, 4),
        snr_estimate_db=round(snr_est, 1),
        voiced_duration_sec=round(voiced_duration_sec, 3),
        is_silent=is_silent,
        processing_notes=processing_notes
    )

    return data, sr, metadata
