"""SQLite Database management for SpeakSense AI: users, sessions, benchmarks, scripts, recordings, analyses."""
import sqlite3
import json
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.config import DATABASE_PATH

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

DEFAULT_BENCHMARK_PROFILES = [
    {
        "category_key": "public_speaking",
        "name": "Public Speaking",
        "description": "Balanced conversational pace, audience connection, and comfortable pauses.",
        "target_wpm_min": 130.0,
        "target_wpm_max": 160.0,
        "target_pause_min_sec": 0.4,
        "target_pause_max_sec": 1.2,
        "target_pitch_std_min": 2.0,
        "target_pitch_std_max": 3.5,
        "target_dyn_range_min_db": 15.0,
        "weights": {
            "pacing": 25,
            "pause_control": 20,
            "vocal_variation": 20,
            "energy_control": 15,
            "clarity": 20,
        }
    },
    {
        "category_key": "declamation",
        "name": "Declamation",
        "description": "Dramatic recitation requiring expressive pitch range and deliberate rhetorical weight.",
        "target_wpm_min": 115.0,
        "target_wpm_max": 145.0,
        "target_pause_min_sec": 0.5,
        "target_pause_max_sec": 1.5,
        "target_pitch_std_min": 2.5,
        "target_pitch_std_max": 4.2,
        "target_dyn_range_min_db": 18.0,
        "weights": {
            "pacing": 20,
            "pause_control": 20,
            "vocal_variation": 25,
            "energy_control": 20,
            "clarity": 15,
        }
    },
    {
        "category_key": "persuasive_oratory",
        "name": "Persuasive Oratory",
        "description": "Dynamic rhythm, compelling vocal energy, and strategic pause transitions.",
        "target_wpm_min": 125.0,
        "target_wpm_max": 155.0,
        "target_pause_min_sec": 0.4,
        "target_pause_max_sec": 1.3,
        "target_pitch_std_min": 2.2,
        "target_pitch_std_max": 3.8,
        "target_dyn_range_min_db": 16.0,
        "weights": {
            "pacing": 25,
            "pause_control": 20,
            "vocal_variation": 20,
            "energy_control": 15,
            "clarity": 20,
        }
    },
    {
        "category_key": "interpretive_reading",
        "name": "Interpretive Reading",
        "description": "Expressive narrative cadence with sensitive pause timing and clear articulation.",
        "target_wpm_min": 110.0,
        "target_wpm_max": 140.0,
        "target_pause_min_sec": 0.4,
        "target_pause_max_sec": 1.4,
        "target_pitch_std_min": 2.2,
        "target_pitch_std_max": 4.0,
        "target_dyn_range_min_db": 14.0,
        "weights": {
            "pacing": 25,
            "pause_control": 25,
            "vocal_variation": 25,
            "energy_control": 15,
            "clarity": 10,
        }
    },
    {
        "category_key": "extemporaneous",
        "name": "Extemporaneous Speaking",
        "description": "Structured analytical delivery prioritizing fluent tempo, clarity, and steady energy.",
        "target_wpm_min": 130.0,
        "target_wpm_max": 165.0,
        "target_pause_min_sec": 0.35,
        "target_pause_max_sec": 1.1,
        "target_pitch_std_min": 1.8,
        "target_pitch_std_max": 3.2,
        "target_dyn_range_min_db": 15.0,
        "weights": {
            "pacing": 25,
            "pause_control": 20,
            "vocal_variation": 20,
            "energy_control": 15,
            "clarity": 20,
        }
    },
    {
        "category_key": "debate",
        "name": "Debate",
        "description": "Rapid, crisp articulation, structured cadence, and high persuasive projection.",
        "target_wpm_min": 145.0,
        "target_wpm_max": 185.0,
        "target_pause_min_sec": 0.25,
        "target_pause_max_sec": 0.9,
        "target_pitch_std_min": 1.8,
        "target_pitch_std_max": 3.0,
        "target_dyn_range_min_db": 16.0,
        "weights": {
            "pacing": 30,
            "pause_control": 15,
            "vocal_variation": 15,
            "energy_control": 20,
            "clarity": 20,
        }
    }
]

def init_db():
    """Initialize database tables and run safe migrations."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        mobile TEXT,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        avatar_color TEXT DEFAULT '#14B8A6',
        created_at TEXT NOT NULL
    );
    """)

    # User sessions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );
    """)

    # Benchmark profiles table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS benchmark_profiles (
        id TEXT PRIMARY KEY,
        category_key TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_builtin INTEGER DEFAULT 1,
        user_id TEXT,
        target_wpm_min REAL NOT NULL,
        target_wpm_max REAL NOT NULL,
        target_pause_min_sec REAL NOT NULL,
        target_pause_max_sec REAL NOT NULL,
        target_pitch_std_min REAL NOT NULL,
        target_pitch_std_max REAL NOT NULL,
        target_dyn_range_min_db REAL NOT NULL,
        weights_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # Scripts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scripts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        target_duration_sec REAL NOT NULL,
        transcript TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL
    );
    """)

    # Recordings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        script_id TEXT NOT NULL,
        speaker_id TEXT NOT NULL,
        reference_id TEXT,
        delivery_type TEXT NOT NULL,
        audio_path TEXT NOT NULL,
        filename TEXT NOT NULL,
        duration_sec REAL NOT NULL,
        is_reference INTEGER DEFAULT 0,
        split TEXT DEFAULT 'train',
        created_at TEXT NOT NULL,
        FOREIGN KEY(script_id) REFERENCES scripts(id)
    );
    """)

    # Annotations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS annotations (
        id TEXT PRIMARY KEY,
        sample_id TEXT NOT NULL,
        script_id TEXT NOT NULL,
        speaker_id TEXT NOT NULL,
        reference_id TEXT NOT NULL,
        flaw_category TEXT NOT NULL,
        flaw_start REAL NOT NULL,
        flaw_end REAL NOT NULL,
        severity INTEGER NOT NULL,
        label_source TEXT DEFAULT 'expert_human',
        annotation_confidence REAL DEFAULT 1.0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(sample_id) REFERENCES recordings(id),
        FOREIGN KEY(script_id) REFERENCES scripts(id)
    );
    """)

    # Analysis History table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        script_id TEXT,
        reference_recording_id TEXT,
        participant_recording_id TEXT,
        preset_used TEXT NOT NULL,
        analysis_type TEXT DEFAULT 'benchmark',
        total_score REAL NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # Safe migration: add user_id and analysis_type columns to analyses if older table exists
    cursor.execute("PRAGMA table_info(analyses)")
    columns = [row["name"] for row in cursor.fetchall()]
    if "user_id" not in columns:
        cursor.execute("ALTER TABLE analyses ADD COLUMN user_id TEXT;")
    if "analysis_type" not in columns:
        cursor.execute("ALTER TABLE analyses ADD COLUMN analysis_type TEXT DEFAULT 'benchmark';")

    # Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)

    conn.commit()

    # Seed initial benchmark profiles if not present
    for prof in DEFAULT_BENCHMARK_PROFILES:
        cursor.execute("SELECT id FROM benchmark_profiles WHERE category_key = ?", (prof["category_key"],))
        if not cursor.fetchone():
            cursor.execute("""
            INSERT INTO benchmark_profiles (
                id, category_key, name, description, is_builtin, user_id,
                target_wpm_min, target_wpm_max, target_pause_min_sec, target_pause_max_sec,
                target_pitch_std_min, target_pitch_std_max, target_dyn_range_min_db,
                weights_json, created_at
            ) VALUES (?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                f"bench_{prof['category_key']}",
                prof["category_key"],
                prof["name"],
                prof["description"],
                prof["target_wpm_min"],
                prof["target_wpm_max"],
                prof["target_pause_min_sec"],
                prof["target_pause_max_sec"],
                prof["target_pitch_std_min"],
                prof["target_pitch_std_max"],
                prof["target_dyn_range_min_db"],
                json.dumps(prof["weights"]),
                datetime.utcnow().isoformat()
            ))

    conn.commit()
    conn.close()

# ----------------- User Queries -----------------

def create_user(full_name: str, email: str, password_hash: str, salt: str, mobile: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()
    user_id = f"user_{uuid.uuid4().hex[:10]}"
    now_iso = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT INTO users (id, full_name, email, mobile, password_hash, salt, avatar_color, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, full_name, email.strip().lower(), mobile, password_hash, salt, "#14B8A6", now_iso))
    conn.commit()
    conn.close()
    return {
        "id": user_id,
        "full_name": full_name,
        "email": email.strip().lower(),
        "mobile": mobile,
        "avatar_color": "#14B8A6",
        "created_at": now_iso
    }

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, full_name, email, mobile, avatar_color, created_at FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_user_profile(user_id: str, full_name: str, mobile: Optional[str], avatar_color: Optional[str]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE users SET full_name = ?, mobile = ?, avatar_color = COALESCE(?, avatar_color) WHERE id = ?
    """, (full_name, mobile, avatar_color, user_id))
    conn.commit()
    conn.close()

# ----------------- Benchmark Profiles Queries -----------------

def get_all_benchmark_profiles(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("SELECT * FROM benchmark_profiles WHERE is_builtin = 1 OR user_id = ? ORDER BY is_builtin DESC, name ASC", (user_id,))
    else:
        cursor.execute("SELECT * FROM benchmark_profiles ORDER BY is_builtin DESC, name ASC")
    rows = cursor.fetchall()
    conn.close()
    profiles = []
    for r in rows:
        d = dict(r)
        d["weights"] = json.loads(d["weights_json"])
        profiles.append(d)
    return profiles

def get_benchmark_profile_by_key(category_key: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM benchmark_profiles WHERE category_key = ?", (category_key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        d = dict(row)
        d["weights"] = json.loads(d["weights_json"])
        return d
    return None

def update_benchmark_profile(category_key: str, data: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    weights_str = json.dumps(data["weights"]) if "weights" in data else None
    cursor.execute("""
    UPDATE benchmark_profiles SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        target_wpm_min = COALESCE(?, target_wpm_min),
        target_wpm_max = COALESCE(?, target_wpm_max),
        target_pause_min_sec = COALESCE(?, target_pause_min_sec),
        target_pause_max_sec = COALESCE(?, target_pause_max_sec),
        target_pitch_std_min = COALESCE(?, target_pitch_std_min),
        target_pitch_std_max = COALESCE(?, target_pitch_std_max),
        target_dyn_range_min_db = COALESCE(?, target_dyn_range_min_db),
        weights_json = COALESCE(?, weights_json)
    WHERE category_key = ?
    """, (
        data.get("name"),
        data.get("description"),
        data.get("target_wpm_min"),
        data.get("target_wpm_max"),
        data.get("target_pause_min_sec"),
        data.get("target_pause_max_sec"),
        data.get("target_pitch_std_min"),
        data.get("target_pitch_std_max"),
        data.get("target_dyn_range_min_db"),
        weights_str,
        category_key
    ))
    conn.commit()
    conn.close()

def reset_default_benchmarks():
    """Restores default target values for the 6 built-in categories."""
    conn = get_db_connection()
    cursor = conn.cursor()
    for prof in DEFAULT_BENCHMARK_PROFILES:
        cursor.execute("""
        UPDATE benchmark_profiles SET
            target_wpm_min = ?,
            target_wpm_max = ?,
            target_pause_min_sec = ?,
            target_pause_max_sec = ?,
            target_pitch_std_min = ?,
            target_pitch_std_max = ?,
            target_dyn_range_min_db = ?,
            weights_json = ?
        WHERE category_key = ?
        """, (
            prof["target_wpm_min"],
            prof["target_wpm_max"],
            prof["target_pause_min_sec"],
            prof["target_pause_max_sec"],
            prof["target_pitch_std_min"],
            prof["target_pitch_std_max"],
            prof["target_dyn_range_min_db"],
            json.dumps(prof["weights"]),
            prof["category_key"]
        ))
    conn.commit()
    conn.close()

# ----------------- Scripts & Recordings -----------------

def insert_script(script_id: str, title: str, category: str, duration: float, transcript: str, description: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO scripts (id, title, category, target_duration_sec, transcript, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (script_id, title, category, duration, transcript, description, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

def get_all_scripts() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM scripts ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def insert_recording(recording: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO recordings 
    (id, script_id, speaker_id, reference_id, delivery_type, audio_path, filename, duration_sec, is_reference, split, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        recording["id"],
        recording["script_id"],
        recording["speaker_id"],
        recording.get("reference_id"),
        recording["delivery_type"],
        recording["audio_path"],
        recording["filename"],
        recording["duration_sec"],
        1 if recording.get("is_reference") else 0,
        recording.get("split", "train"),
        datetime.utcnow().isoformat()
    ))
    conn.commit()
    conn.close()

def get_all_recordings(script_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if script_id:
        cursor.execute("SELECT * FROM recordings WHERE script_id = ? ORDER BY id ASC", (script_id,))
    else:
        cursor.execute("SELECT * FROM recordings ORDER BY id ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def insert_annotation(annotation: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT OR REPLACE INTO annotations
    (id, sample_id, script_id, speaker_id, reference_id, flaw_category, flaw_start, flaw_end, severity, label_source, annotation_confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        annotation["id"],
        annotation["sample_id"],
        annotation["script_id"],
        annotation["speaker_id"],
        annotation["reference_id"],
        annotation["flaw_category"],
        annotation["flaw_start"],
        annotation["flaw_end"],
        annotation["severity"],
        annotation.get("label_source", "expert_human"),
        annotation.get("annotation_confidence", 1.0),
        datetime.utcnow().isoformat()
    ))
    conn.commit()
    conn.close()

def get_annotations_for_sample(sample_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM annotations WHERE sample_id = ? ORDER BY flaw_start ASC", (sample_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_all_annotations() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM annotations ORDER BY sample_id, flaw_start ASC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ----------------- Analysis History -----------------

def save_analysis(
    analysis_id: str,
    script_id: Optional[str],
    ref_id: Optional[str],
    part_id: Optional[str],
    preset: str,
    score: float,
    result_dict: Dict[str, Any],
    user_id: Optional[str] = None,
    analysis_type: str = "benchmark"
):
    conn = get_db_connection()
    cursor = conn.cursor()
    now_iso = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT OR REPLACE INTO analyses (id, user_id, script_id, reference_recording_id, participant_recording_id, preset_used, analysis_type, total_score, result_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (analysis_id, user_id, script_id, ref_id, part_id, preset, analysis_type, score, json.dumps(result_dict), now_iso))
    conn.commit()
    conn.close()

def get_recent_analyses(limit: int = 15, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("""
        SELECT id, script_id, preset_used, analysis_type, total_score, created_at
        FROM analyses
        WHERE user_id = ?
        ORDER BY created_at DESC LIMIT ?
        """, (user_id, limit))
    else:
        cursor.execute("""
        SELECT id, script_id, preset_used, analysis_type, total_score, created_at
        FROM analyses
        ORDER BY created_at DESC LIMIT ?
        """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_analysis_by_id(analysis_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM analyses WHERE id = ?", (analysis_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        data = dict(row)
        data["result"] = json.loads(data["result_json"])
        return data
    return None

def delete_analysis(analysis_id: str, user_id: Optional[str] = None) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    if user_id:
        cursor.execute("DELETE FROM analyses WHERE id = ? AND user_id = ?", (analysis_id, user_id))
    else:
        cursor.execute("DELETE FROM analyses WHERE id = ?", (analysis_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected
