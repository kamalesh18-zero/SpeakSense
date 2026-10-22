# SpeakSense AI
### Counterpointing Speech Analytics & Temporal Flaw Finding

SpeakSense AI is a full-stack, AI-powered speech evaluation platform that compares an ideal reference speech with a participant's delivery of the **exact same transcript**, identifies localized delivery flaws, explains them using measurable acoustic evidence, and generates reproducible rubric-based scores.

---

## 🌟 Key Highlights & Engineering Features

1. **Zero Fake Metrics or Mockups**:
   - Every waveform, pitch contour, RMS energy plot, and word timestamp is computed directly from acoustic audio files using Librosa, SciPy, and Faster-Whisper.
   - Accents and natural voice pitch ranges are normalized using speaker-median semitones, ensuring zero penalty for natural pitch differences.

2. **Custom Contrastive Dataset (30 Real Audio Recordings)**:
   - 5 standard competition-length speech scripts (20–45s) across 4 speech categories (Persuasive Oratory, Declamation, Extemporaneous, Interpretive Reading).
   - 6 delivery variations per script:
     1. Ideal Reference (Control)
     2. Excessively Fast (+35% WPM)
     3. Flat / Monotonous (Reduced pitch variability)
     4. Awkward Pauses (Mid-phrase hesitations)
     5. Misplaced Emphasis (Erratic dynamic energy)
     6. Near-Perfect Delivery (94+ score)
   - Calibrated ground-truth flaw annotations with start/end timestamps and severity labels (0–3).
   - Strict Train / Validation / Test separation across scripts to prevent evaluation leakage.

3. **Multi-Stage Audio Processing & Forced Alignment**:
   - Audio decoding via `soundfile` and `imageio-ffmpeg` supporting WAV, MP3, and browser microphone recordings.
   - Automatic 16kHz mono resampling, clipping detection, SNR estimation, and VAD voice extraction.
   - Word-level forced alignment via Faster-Whisper (CPU INT8 quantized) with cross-attention acoustic timestamps.
   - Substantial transcript mismatch detection (SequenceMatcher similarity ratio).

4. **Rule-Based Temporal Flaw Finding & Mathematical Explainability**:
   - Detects `excessive_speed`, `unusually_slow`, `excessive_pause`, `mid_phrase_pause`, `reduced_pitch_variation`, and `inconsistent_energy`.
   - Explains mathematical acoustic deviations (e.g., `+30% WPM faster than reference`) with actionable coaching recommendations.

5. **Transparent Deterministic 100-Point Rubric Scoring**:
   - Categories: Pacing (25), Pause Control (20), Vocal Variation (20), Energy Control (15), Clarity & Intelligibility (20).
   - Explicit handling for clarity: if alignment fails or audio is degraded, clarity is marked `unavailable` and remaining points are proportionally redistributed without inventing fake scores.
   - Competition presets: Persuasive Oratory, Declamation, Extemporaneous, Interpretive Reading.

6. **Interactive Modern Dark Navy Dashboard (7 Functional Pages)**:
   - **Dashboard**: High-level KPIs, 1-click demo launchers, recent runs table.
   - **Analyze Speech Studio**: Dual audio upload, browser mic recording, script selector, real-time stage progress indicator.
   - **Ideal vs Participant Comparison**: Side-by-side synchronized audio players, dual interactive waveforms, normalized pitch (semitones) & RMS energy overlays, aligned word-by-word stretch table, DTW distance.
   - **Temporal Flaw Analysis**: Interactive time band visualizer, clickable flaw cards that seek the participant audio player to the exact flaw start timestamp, evidence comparison grid.
   - **Contrastive Dataset Manager**: Filter by script/split, audio preview, flaw annotation editor modal, JSON & CSV export, automated benchmark evaluator computing Precision, Recall, F1, and temporal IoU.
   - **Performance Reports**: Official evaluation summary, rubric radar chart, itemized flaw ledger, JSON download, printable/PDF export.
   - **Settings**: Threshold sliders, rubric weight adjustments, hardware status diagnostic badge.

---

## 🚀 Quickstart & Running the Application

### 1. Prerequisites
- Python 3.11+ (tested on Python 3.12)
- Node.js 18+ (tested on v24.19)

### 2. Backend Setup & Startup
```powershell
cd backend
# Using the pre-configured virtual environment:
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- API Docs: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/api/health`

### 3. Frontend Development Server
```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
- Open `http://localhost:5173` in your browser.
*(Alternatively, navigate to `http://localhost:8000` to view the unified FastAPI-hosted production build).*

### 4. Running Backend Unit Tests
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```
All 14 unit and integration tests will execute and verify audio processing, pYIN pitch tracking, forced alignment, flaw detection, and deterministic rubric scoring.

---

## 📂 Project Structure

```
speaksense-ai/
├── backend/
│   ├── app/
│   │   ├── alignment/        # Faster-Whisper word alignment & token matcher
│   │   ├── api/              # FastAPI REST endpoints
│   │   ├── audio/            # Audio preprocessor (resampling, VAD, clipping, SNR)
│   │   ├── comparison/       # Baseline comparison & DTW distance
│   │   ├── dataset/          # Dataset generator & ground-truth benchmark evaluator
│   │   ├── features/         # Acoustic DSP (STFT, MFCC, pYIN F0, RMS, pauses)
│   │   ├── flaws/            # Evidence-driven temporal flaw detector
│   │   ├── models/           # Pydantic schemas
│   │   ├── scoring/          # Deterministic 100-pt rubric engine
│   │   ├── config.py         # Baseline thresholds & competition presets
│   │   ├── database.py       # SQLite database engine
│   │   └── main.py           # FastAPI entry point & SPA static server
│   ├── tests/                # Pytest test suite (14 tests)
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── components/       # Navbar, AudioPlayerWaveform
│   │   ├── pages/            # 7 functional application pages
│   │   ├── services/         # API client service
│   │   ├── types/            # TypeScript data contracts
│   │   ├── App.tsx           # Main application state & routing
│   │   └── index.css         # Dark navy design tokens & glass panels
│   └── package.json
└── data/
    ├── recordings/           # 30 real WAV recordings
    ├── scripts/              # 5 competition speech scripts
    ├── uploads/              # Custom uploaded user audio
    └── speaksense.db         # SQLite database
```
