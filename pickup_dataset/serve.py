import pickle
import numpy as np
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MODEL_PATH = Path(__file__).parent / "model.pkl"

with open(MODEL_PATH, "rb") as f:
    bundle  = pickle.load(f)
    model   = bundle["model"]
    FEATURES = bundle["features"]
    BACKEND  = bundle["backend"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

class BookingRecord(BaseModel):
    sport:        str
    host:         str
    location:     str
    city:         str
    neighborhood: str
    dayOfWeek:    int
    hourOfDay:    int
    skillLevel:   str

class Candidate(BaseModel):
    id:           int
    sport:        str
    host:         str
    location:     str
    city:         str
    neighborhood: str
    dayOfWeek:    int
    hourOfDay:    int
    skillLevel:   str
    costPerPlayer: float
    distKm:       float

class RecommendRequest(BaseModel):
    history:    list[BookingRecord]
    candidates: list[Candidate]

def freq(lst: list, value: str) -> float:
    if not lst: return 0.0
    return lst.count(value) / len(lst)

def hour_closeness(hours: list[int], target: int) -> float:
    if not hours: return 0.0
    avg = sum(hours) / len(hours)
    return max(0.0, 1.0 - abs(avg - target) / 6.0)

def build_features(history: list[BookingRecord], c: Candidate) -> dict:
    hist_sports  = [h.sport        for h in history]
    hist_days    = [h.dayOfWeek    for h in history]
    hist_hours   = [h.hourOfDay    for h in history]
    hist_skills  = [h.skillLevel   for h in history]
    hist_neighbs = [h.neighborhood for h in history]
    avg_cost_tol = (
        sum(h.costPerPlayer for h in history if hasattr(h, "costPerPlayer")) / len(history)
        if history else 0.0
    )

    return {
        "sport_match":          freq(hist_sports,  c.sport),
        "day_match":            freq(hist_days,    c.dayOfWeek),
        "hour_match":           hour_closeness(hist_hours, c.hourOfDay),
        "skill_match":          min(1.0, freq(hist_skills, c.skillLevel) + (0.3 if c.skillLevel == "all" else 0)),
        "neighborhood_match":   freq(hist_neighbs, c.neighborhood),
        "cost_within_tol":      1.0 if c.costPerPlayer <= avg_cost_tol else 0.05,
        "dist_score":           max(0.0, 1.0 - c.distKm / 80.0),
        "pos_decay":            1.0,
        "seconds_viewed":       10.0,
    }

def build_reasons(history: list[BookingRecord], c: Candidate, feats: dict) -> list[str]:
    reasons = []
    if feats["sport_match"] >= 0.4:
        reasons.append(f"You often play {c.sport}")
    if freq([h.host for h in history], c.host) >= 0.25:
        reasons.append(f"You've played with {c.host} before")
    if freq([h.location for h in history], c.location) >= 0.2:
        reasons.append(f"You like {c.location}")
    if feats["day_match"] >= 0.3:
        days = ["Sundays","Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays"]
        reasons.append(f"You usually play on {days[c.dayOfWeek]}")
    if feats["hour_match"] >= 0.7:
        reasons.append("Matches your preferred time")
    if feats["skill_match"] >= 0.3:
        reasons.append(f"{c.skillLevel} level suits you")
    return reasons[:2]

@app.post("/recommend")
def recommend(req: RecommendRequest):
    if not req.history or not req.candidates:
        return {"results": []}

    rows    = [build_features(req.history, c) for c in req.candidates]
    X       = [[row[f] for f in FEATURES] for row in rows]
    X_np    = np.array(X, dtype=np.float32)

    if BACKEND == "lightgbm":
        scores = model.predict(X_np).tolist()
    else:
        scores = model.predict_proba(X_np)[:, 1].tolist()

    results = []
    for c, score, row in zip(req.candidates, scores, rows):
        reasons = build_reasons(req.history, c, row)
        results.append({
            "id":      c.id,
            "score":   round(float(score), 4),
            "reasons": reasons,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return {"results": results[:4]}

@app.get("/health")
def health():
    return {"status": "ok", "backend": BACKEND, "features": FEATURES}
