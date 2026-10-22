"""Test suite for User Authentication, Benchmark Profiles, and Single-Audio Benchmark Analysis."""
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_auth_workflow(client):
    unique_email = f"speaker_{uuid.uuid4().hex[:8]}@example.com"
    
    # 1. Register
    reg_payload = {
        "full_name": "Test Speaker",
        "email": unique_email,
        "password": "securepassword123",
        "mobile": "+15551234567"
    }
    reg_res = client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 200, reg_res.text
    reg_data = reg_res.json()
    assert "token" in reg_data
    token = reg_data["token"]
    assert reg_data["user"]["email"] == unique_email
    
    # 2. Get profile with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["user"]["full_name"] == "Test Speaker"
    
    # 3. Update profile
    upd_payload = {
        "full_name": "Speaker Updated",
        "mobile": "+15559876543",
        "avatar_color": "#0284C7"
    }
    upd_res = client.put("/api/auth/profile", json=upd_payload, headers=headers)
    assert upd_res.status_code == 200
    assert upd_res.json()["user"]["full_name"] == "Speaker Updated"
    assert upd_res.json()["user"]["avatar_color"] == "#0284C7"
    
    # 4. Login with credentials
    login_payload = {
        "email": unique_email,
        "password": "securepassword123"
    }
    login_res = client.post("/api/auth/login", json=login_payload)
    assert login_res.status_code == 200
    assert "token" in login_res.json()
    
    # 5. Logout
    logout_res = client.post("/api/auth/logout", headers=headers)
    assert logout_res.status_code == 200

def test_benchmark_profiles_api(client):
    # 1. List profiles
    res = client.get("/api/benchmarks")
    assert res.status_code == 200
    profiles = res.json()
    assert len(profiles) >= 6
    keys = [p["category_key"] for p in profiles]
    assert "public_speaking" in keys
    assert "persuasive_oratory" in keys
    assert "declamation" in keys
    assert "debate" in keys
    
    # 2. Update profile targets
    upd_data = {
        "target_wpm_min": 132.0,
        "target_wpm_max": 158.0
    }
    upd_res = client.put("/api/benchmarks/public_speaking", json=upd_data)
    assert upd_res.status_code == 200
    prof = upd_res.json()["profile"]
    assert prof["target_wpm_min"] == 132.0
    assert prof["target_wpm_max"] == 158.0
    
    # 3. Reset defaults
    reset_res = client.post("/api/benchmarks/reset")
    assert reset_res.status_code == 200

def test_single_audio_benchmark_analysis(client):
    # Use one of the existing sample recordings
    scripts_res = client.get("/api/scripts")
    script = scripts_res.json()[0]
    sample_audio_path = f"data/recordings/{script['id']}_near_perfect.wav"
    
    # Register a user to verify user-isolated history
    email = f"benchuser_{uuid.uuid4().hex[:6]}@example.com"
    reg = client.post("/api/auth/register", json={
        "full_name": "Benchmark User",
        "email": email,
        "password": "password123"
    }).json()
    token = reg["token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Call /api/analyze/benchmark
    form_data = {
        "audio_path": sample_audio_path,
        "category_key": "public_speaking",
        "transcript": script["transcript"],
        "script_id": script["id"]
    }
    res = client.post("/api/analyze/benchmark", data=form_data, headers=headers)
    assert res.status_code == 200, res.text
    result = res.json()
    
    assert "analysis_id" in result
    assert "score" in result
    assert result["score"]["total_score"] >= 70.0
    assert len(result["score"]["categories"]) == 5
    assert "measurements" in result
    assert result["measurements"]["effective_wpm"] > 50
    assert len(result["timeline"]) > 0
    assert len(result["plain_language_advice"]) > 0
    
    # Verify recorded in user history
    hist_res = client.get("/api/user/history", headers=headers)
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert len(hist) >= 1
    assert any(h["id"] == result["analysis_id"] for h in hist)
    
    # Delete from history
    del_res = client.delete(f"/api/user/history/{result['analysis_id']}", headers=headers)
    assert del_res.status_code == 200
