"""FastAPI application entry point for SpeakSense AI."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import BASE_DIR, DATA_DIR, UPLOADS_DIR, RECORDINGS_DIR, DEMO_DIR
from app.database import init_db, get_all_recordings
from app.api.router import router

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Ensure database is initialized and directories are ready."""
    init_db()
    recs = get_all_recordings()
    print(f"SpeakSense AI Backend ready. Loaded {len(recs)} recordings from database.")
    yield

app = FastAPI(
    title="SpeakSense AI",
    description="Counterpointing Speech Analytics & Temporal Flaw Finding API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static audio directories for direct browser playback
app.mount("/media/recordings", StaticFiles(directory=str(RECORDINGS_DIR)), name="recordings")
app.mount("/media/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
if DEMO_DIR.exists():
    app.mount("/media/demo", StaticFiles(directory=str(DEMO_DIR)), name="demo")

# Include API Router
app.include_router(router)

# Mount built frontend SPA if available
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Don't hijack API or media routes
        if full_path.startswith("api") or full_path.startswith("media") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not Found")
        
        file_candidate = FRONTEND_DIST / full_path
        if file_candidate.is_file():
            return FileResponse(file_candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    def root():
        return {
            "project": "SpeakSense AI",
            "title": "Counterpointing Speech Analytics & Temporal Flaw Finding",
            "status": "operational",
            "docs_url": "/docs"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
