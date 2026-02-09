"""
FastAPI server for the Tree of Life Visualization Dashboard.

Supports two modes:
  - Static data mode (production): reads pre-computed JSON from static_data/
  - Live mode (local dev): computes from raw JSONL via aggregator
"""

import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from book_config import BOOKS, CULTURE_COLORS, EMOTION_COLORS, EMOTIONS

app = FastAPI(title="Tree of Life Viz API", version="1.0.0")

# In production (single-origin), CORS is only needed for local dev
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static data mode ──
# If STATIC_DATA env var is set (or static_data/ exists next to this file),
# serve pre-computed JSON instead of computing from raw JSONL.
STATIC_DATA_DIR = Path(
    os.environ.get("STATIC_DATA", Path(__file__).parent / "static_data")
)
USE_STATIC = STATIC_DATA_DIR.is_dir()

if USE_STATIC:
    print(f"[Static mode] Loading pre-computed data from {STATIC_DATA_DIR}")
else:
    print(f"[Live mode] Computing from raw JSONL via aggregator")
    from aggregator import (
        aggregate_book,
        compute_heartbeat,
        compute_trajectory,
        compute_all_summaries,
        compute_culture_comparison,
        compute_culture_averages,
        compute_relationships,
        compute_character_data,
    )


def _load_static(filename: str):
    """Load a pre-computed JSON file from static_data/."""
    path = STATIC_DATA_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Static data file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Serve React frontend in production ──
STATIC_DIR = os.environ.get("STATIC_DIR")
if STATIC_DIR and Path(STATIC_DIR).exists():
    app.mount("/assets", StaticFiles(directory=Path(STATIC_DIR) / "assets"), name="assets")

# ── Cache layer (live mode only) ──
_cache = {}


def _get_cached(key: str, compute_fn, *args):
    if key not in _cache:
        _cache[key] = compute_fn(*args)
    return _cache[key]


# ── Routes ──

@app.get("/")
def root():
    if STATIC_DIR and Path(STATIC_DIR).exists():
        return FileResponse(Path(STATIC_DIR) / "index.html")
    return {"status": "ok", "message": "Tree of Life Visualization API", "books": len(BOOKS)}


@app.get("/api/books")
def get_all_books():
    """Get summary data for all books (dashboard cards)."""
    if USE_STATIC:
        return _load_static("books.json")
    return _get_cached("all_summaries", compute_all_summaries)


@app.get("/api/books/{book_id}")
def get_book_detail(book_id: str):
    """Get detailed data for a single book."""
    if book_id not in BOOKS:
        raise HTTPException(status_code=404, detail=f"Book '{book_id}' not found")
    if USE_STATIC:
        return _load_static(f"books/{book_id}.json")
    return _get_cached(f"book_{book_id}", aggregate_book, book_id)


@app.get("/api/books/{book_id}/heartbeat")
def get_book_heartbeat(book_id: str):
    """Get heartbeat strip data for a book (per-character per-chapter emotions)."""
    if book_id not in BOOKS:
        raise HTTPException(status_code=404, detail=f"Book '{book_id}' not found")
    if USE_STATIC:
        return _load_static(f"books/{book_id}_heartbeat.json")
    return _get_cached(f"heartbeat_{book_id}", compute_heartbeat, book_id)


@app.get("/api/books/{book_id}/trajectory")
def get_book_trajectory(book_id: str):
    """Get 3D story path data (hope/fear x mercy/judgment x time)."""
    if book_id not in BOOKS:
        raise HTTPException(status_code=404, detail=f"Book '{book_id}' not found")
    if USE_STATIC:
        return _load_static(f"books/{book_id}_trajectory.json")
    return _get_cached(f"trajectory_{book_id}", compute_trajectory, book_id)


@app.get("/api/books/{book_id}/relationships")
def get_book_relationships(book_id: str):
    """Get relationship cluster data for a book (character pairs, factions, graph)."""
    if book_id not in BOOKS:
        raise HTTPException(status_code=404, detail=f"Book '{book_id}' not found")
    if USE_STATIC:
        return _load_static(f"books/{book_id}_relationships.json")
    return _get_cached(f"relationships_{book_id}", compute_relationships, book_id)


@app.get("/api/books/{book_id}/character-data")
def get_book_character_data(book_id: str):
    """Get per-character per-chapter emotional, belief, conservation, and event data."""
    if book_id not in BOOKS:
        raise HTTPException(status_code=404, detail=f"Book '{book_id}' not found")
    if USE_STATIC:
        return _load_static(f"books/{book_id}_character_data.json")
    return _get_cached(f"character_data_{book_id}", compute_character_data, book_id)


@app.get("/api/heartbeats")
def get_all_heartbeats():
    """Get blended heartbeat strips for all books (dashboard overview)."""
    if USE_STATIC:
        return _load_static("heartbeats.json")
    result = []
    for book_id in BOOKS:
        try:
            hb = _get_cached(f"heartbeat_{book_id}", compute_heartbeat, book_id)
            result.append({
                "book_id": book_id,
                "title": hb["title"],
                "culture": hb["culture"],
                "blended_strip": hb["blended_strip"],
                "chapters": hb["chapters"],
            })
        except Exception as e:
            print(f"Error computing heartbeat for {book_id}: {e}")
    return result


@app.get("/api/trajectories")
def get_all_trajectories():
    """Get trajectory data for all books (comparison overlay)."""
    if USE_STATIC:
        return _load_static("trajectories.json")
    result = []
    for book_id in BOOKS:
        try:
            traj = _get_cached(f"trajectory_{book_id}", compute_trajectory, book_id)
            result.append(traj)
        except Exception as e:
            print(f"Error computing trajectory for {book_id}: {e}")
    return result


@app.get("/api/cultures")
def get_culture_comparison():
    """Get aggregated culture comparison data."""
    if USE_STATIC:
        return _load_static("cultures.json")
    return _get_cached("cultures", compute_culture_comparison)


@app.get("/api/culture-averages")
def get_culture_averages():
    """Get average trajectory per culture (for overlay lines)."""
    if USE_STATIC:
        return _load_static("culture_averages.json")
    return _get_cached("culture_averages", compute_culture_averages)


@app.get("/api/config")
def get_config():
    """Get visualization configuration (colors, emotion names, etc.)."""
    if USE_STATIC:
        return _load_static("config.json")
    return {
        "culture_colors": CULTURE_COLORS,
        "emotion_colors": EMOTION_COLORS,
        "emotions": EMOTIONS,
        "book_ids": list(BOOKS.keys()),
        "books": {
            bid: {
                "title": b["title"],
                "author": b["author"],
                "culture": b["culture"],
                "protagonist": b["protagonist"],
            }
            for bid, b in BOOKS.items()
        },
    }


@app.post("/api/cache/clear")
def clear_cache():
    """Clear the data cache (use when new data is added)."""
    _cache.clear()
    return {"status": "cache cleared"}


# ── Catch-all: serve React app for client-side routing ──
if STATIC_DIR and Path(STATIC_DIR).exists():
    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        """Serve index.html for any non-API route (React Router handles it)."""
        file_path = Path(STATIC_DIR) / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(Path(STATIC_DIR) / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
