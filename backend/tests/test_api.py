"""Integration test for FastAPI API endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "hardware" in data
    assert data["hardware"]["platform"] == "windows"

def test_list_scripts(client):
    response = client.get("/api/scripts")
    assert response.status_code == 200
    scripts = response.json()
    assert len(scripts) == 5
    assert any(s["id"] == "script_1" for s in scripts)

def test_list_recordings(client):
    response = client.get("/api/recordings")
    assert response.status_code == 200
    recordings = response.json()
    assert len(recordings) == 30

def test_settings_endpoint(client):
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert "thresholds" in data
    assert "rubric_presets" in data

def test_full_analysis_endpoint(client):
    response = client.get("/api/scripts")
    script = response.json()[0]
    
    # Run analysis comparing ideal reference vs excessively fast delivery
    data = {
        "reference_path": f"data/recordings/{script['id']}_ideal_reference.wav",
        "participant_path": f"data/recordings/{script['id']}_excessively_fast.wav",
        "transcript": script["transcript"],
        "preset_name": "persuasive_oratory",
        "script_id": script["id"]
    }
    res = client.post("/api/analyze", data=data)
    assert res.status_code == 200
    res_data = res.json()
    assert "analysis_id" in res_data
    assert "flaws" in res_data
    assert len(res_data["flaws"]) >= 1
    assert "score" in res_data
    assert res_data["score"]["total_score"] < 95.0
    assert len(res_data["score"]["categories"]) == 5
    assert len(res_data["participant_features"]["words"]) > 0

