"""SpeakSense AI configuration settings and thresholds."""
from pathlib import Path
from typing import Dict, Any
import os

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
DEMO_DIR = DATA_DIR / "demo"
SCRIPTS_DIR = DATA_DIR / "scripts"
RECORDINGS_DIR = DATA_DIR / "recordings"
DATABASE_PATH = DATA_DIR / "speaksense.db"

# Gemini AI API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Ensure essential directories exist
for folder in [DATA_DIR, UPLOADS_DIR, DEMO_DIR, SCRIPTS_DIR, RECORDINGS_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

# Audio processing defaults
SAMPLE_RATE = 16000
HOP_LENGTH = 512
N_FFT = 1024
N_MFCC = 13
PITCH_FMIN = 65.0   # C2
PITCH_FMAX = 500.0  # B4
VAD_TOP_DB = 30.0

# Natural speaking pace baseline (Words Per Minute)
BASELINE_WPM_MIN = 120.0
BASELINE_WPM_MAX = 165.0
BASELINE_WPM_OPTIMAL = 145.0

# Flaw detection default thresholds
DEFAULT_THRESHOLDS: Dict[str, Any] = {
    # Speed detection
    "speed_excessive_rel_pct": 25.0,     # +25% faster than baseline/reference
    "speed_excessive_wpm_abs": 180.0,    # Absolute high WPM limit
    "speed_slow_rel_pct": -25.0,         # -25% slower than baseline/reference
    "speed_slow_wpm_abs": 105.0,         # Absolute low WPM limit
    
    # Pauses
    "pause_excessive_sec": 1.2,          # Excessive pause at phrase boundaries
    "pause_mid_phrase_sec": 0.45,        # Awkward pause within unpunctuated phrase
    
    # Pitch variation (monotony)
    "pitch_monotony_semitone_std": 1.6,  # Less than 1.6 semitones variation in voiced segment
    
    # Energy variation
    "energy_drop_db": 12.0,              # Sudden energy drop relative to phrase median
    
    # Experimental
    "clarity_low_spectral_contrast": 14.0, # dB contrast threshold
    "emphasis_misplaced_ratio": 1.8,     # Stress multiplier on non-key word
}

# Rubric presets for speech competitions (Total 100 points)
RUBRIC_PRESETS: Dict[str, Dict[str, Any]] = {
    "persuasive_oratory": {
        "name": "Persuasive Oratory",
        "weights": {
            "pacing": 25,
            "pause_control": 20,
            "vocal_variation": 20,
            "energy_control": 15,
            "clarity": 20,
        },
        "description": "Emphasis on rhythmic delivery, rhetorical pauses, and dynamic energy."
    },
    "declamation": {
        "name": "Declamation",
        "weights": {
            "pacing": 20,
            "pause_control": 20,
            "vocal_variation": 25,
            "energy_control": 20,
            "clarity": 15,
        },
        "description": "Dramatic interpretation requiring broad vocal range and controlled resonance."
    },
    "extemporaneous": {
        "name": "Extemporaneous Speaking",
        "weights": {
            "pacing": 25,
            "pause_control": 20,
            "vocal_variation": 20,
            "energy_control": 15,
            "clarity": 20,
        },
        "description": "Structured analytical presentation prioritizing natural pacing and clean pauses."
    },
    "interpretive_reading": {
        "name": "Interpretive Reading",
        "weights": {
            "pacing": 25,
            "pause_control": 25,
            "vocal_variation": 25,
            "energy_control": 15,
            "clarity": 10,
        },
        "description": "Narrative delivery requiring sensitive emotional timing and phrase boundaries."
    }
}
