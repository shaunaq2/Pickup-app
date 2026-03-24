"""
PickUp recommendation model — training script
Trains a LightGBM binary classifier on the impressions table.
Output: model.pkl + feature_importance.csv
"""

import pandas as pd
import numpy as np
import pickle
from pathlib import Path

try:
    import lightgbm as lgb
    BACKEND = "lightgbm"
except ImportError:
    try:
        from sklearn.ensemble import GradientBoostingClassifier
        BACKEND = "sklearn"
    except ImportError:
        raise ImportError("Install lightgbm or scikit-learn: pip install lightgbm")

from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import roc_auc_score, average_precision_score, classification_report

DATA_DIR = Path(__file__).parent

FEATURES = [
    "sport_match",
    "day_match",
    "hour_match",
    "skill_match",
    "neighborhood_match",
    "cost_within_tol",
    "dist_score",
    "pos_decay",
    "seconds_viewed",
]
LABEL = "was_joined"

def load_data():
    print("Loading data...")
    imp = pd.read_csv(DATA_DIR / "impressions.csv")
    users = pd.read_csv(DATA_DIR / "users.csv")[["user_id", "segment"]]
    imp = imp.merge(users, on="user_id", how="left")
    print(f"  {len(imp):,} impressions | {imp[LABEL].sum():,} positives ({imp[LABEL].mean()*100:.1f}%)")
    return imp

def split_by_user(df):
    """
    Split by user so the model is evaluated on users it has never seen.
    This is the correct split for recommendation — random row split leaks.
    """
    unique_users = df["user_id"].unique()
    rng = np.random.default_rng(42)
    unique_users = np.array(unique_users)
    rng.shuffle(unique_users)
    split = int(len(unique_users) * 0.8)
    train_users = set(unique_users[:split])
    test_users  = set(unique_users[split:])

    train = df[df["user_id"].isin(train_users)].copy()
    test  = df[df["user_id"].isin(test_users)].copy()
    print(f"  Train: {len(train):,} rows ({len(train_users)} users)")
    print(f"  Test:  {len(test):,} rows ({len(test_users)} users)")
    return train, test

def train_lgbm(X_train, y_train, X_test, y_test):
    pos = y_train.sum()
    neg = len(y_train) - pos
    scale = neg / pos

    dtrain = lgb.Dataset(X_train, label=y_train)
    dval   = lgb.Dataset(X_test,  label=y_test, reference=dtrain)

    params = {
        "objective":        "binary",
        "metric":           ["binary_logloss", "auc"],
        "scale_pos_weight": scale,
        "num_leaves":       31,
        "learning_rate":    0.05,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq":     5,
        "min_child_samples":20,
        "verbose":          -1,
        "seed":             42,
    }

    callbacks = [lgb.early_stopping(50, verbose=False), lgb.log_evaluation(100)]
    model = lgb.train(
        params, dtrain,
        num_boost_round=1000,
        valid_sets=[dval],
        callbacks=callbacks,
    )
    return model

def train_sklearn(X_train, y_train):
    from sklearn.ensemble import GradientBoostingClassifier
    model = GradientBoostingClassifier(
        n_estimators=200, max_depth=4,
        learning_rate=0.05, subsample=0.8,
        random_state=42
    )
    model.fit(X_train, y_train)
    return model

def evaluate(model, X_test, y_test, backend):
    if backend == "lightgbm":
        probs = model.predict(X_test)
    else:
        probs = model.predict_proba(X_test)[:, 1]

    auc = roc_auc_score(y_test, probs)
    ap  = average_precision_score(y_test, probs)
    preds = (probs >= 0.5).astype(int)

    print(f"\n── Evaluation ───────────────────────────────────────────")
    print(f"  ROC-AUC:           {auc:.4f}")
    print(f"  Avg Precision:     {ap:.4f}")
    print(classification_report(y_test, preds, target_names=["skip", "join"]))
    return probs

def feature_importance(model, feature_names, backend):
    if backend == "lightgbm":
        imp = pd.DataFrame({
            "feature": feature_names,
            "gain":    model.feature_importance(importance_type="gain"),
            "split":   model.feature_importance(importance_type="split"),
        }).sort_values("gain", ascending=False)
    else:
        imp = pd.DataFrame({
            "feature": feature_names,
            "gain":    model.feature_importances_,
        }).sort_values("gain", ascending=False)

    print("\n── Feature importance (by gain) ─────────────────────────")
    print(imp.to_string(index=False))
    imp.to_csv(DATA_DIR / "feature_importance.csv", index=False)
    return imp

def score_new_user(model, user_history: list[dict], candidate_games: list[dict], backend: str) -> list[dict]:
    """
    Score candidate games for a new user given their booking history.
    user_history: list of past booking dicts with sport, day_of_week, hour_of_day,
                  neighborhood, skill_level, cost_per_player, dist_km
    candidate_games: list of game dicts with the same fields
    Returns candidate_games sorted by predicted join probability.
    """
    if not user_history:
        return candidate_games

    hist_sports  = [h["sport"]        for h in user_history]
    hist_days    = [h["day_of_week"]  for h in user_history]
    hist_hours   = [h["hour_of_day"]  for h in user_history]
    hist_neighbs = [h["neighborhood"] for h in user_history]
    hist_skills  = [h["skill_level"]  for h in user_history]
    hist_costs   = [h["cost_per_player"] for h in user_history]
    avg_cost_tol = np.mean(hist_costs) if hist_costs else 0

    def freq(lst, val):
        return lst.count(val) / len(lst) if lst else 0

    def hour_score(hours, target):
        if not hours: return 0
        avg = np.mean(hours)
        return max(0, 1 - abs(avg - target) / 6)

    rows = []
    for g in candidate_games:
        dist_km   = g.get("dist_km", 0)
        rows.append({
            "sport_match":          freq(hist_sports,  g["sport"]),
            "day_match":            freq(hist_days,    g["day_of_week"]),
            "hour_match":           hour_score(hist_hours, g["hour_of_day"]),
            "skill_match":          freq(hist_skills,  g["skill_level"]) + (0.3 if g["skill_level"] == "all" else 0),
            "neighborhood_match":   freq(hist_neighbs, g["neighborhood"]),
            "cost_within_tol":      1.0 if g["cost_per_player"] <= avg_cost_tol else 0.05,
            "dist_score":           max(0, 1 - dist_km / 80),
            "pos_decay":            1.0,
            "seconds_viewed":       10.0,
        })

    X = pd.DataFrame(rows)[FEATURES]
    if backend == "lightgbm":
        probs = model.predict(X)
    else:
        probs = model.predict_proba(X)[:, 1]

    results = []
    for g, p in zip(candidate_games, probs):
        results.append({**g, "score": float(round(p, 4))})
    return sorted(results, key=lambda x: x["score"], reverse=True)

def main():
    df = load_data()

    print("\nSplitting by user...")
    train, test = split_by_user(df)

    X_train = train[FEATURES]
    y_train = train[LABEL]
    X_test  = test[FEATURES]
    y_test  = test[LABEL]

    print(f"\nTraining with backend: {BACKEND}")
    if BACKEND == "lightgbm":
        model = train_lgbm(X_train, y_train, X_test, y_test)
    else:
        model = train_sklearn(X_train, y_train)

    evaluate(model, X_test, y_test, BACKEND)
    feature_importance(model, FEATURES, BACKEND)

    model_path = DATA_DIR / "model.pkl"
    with open(model_path, "wb") as f:
        pickle.dump({"model": model, "features": FEATURES, "backend": BACKEND}, f)
    print(f"\nModel saved to {model_path}")

    print("\n── Example: score games for a user with basketball history ──")
    history = [
        {"sport": "basketball", "day_of_week": 3, "hour_of_day": 18,
         "neighborhood": "Vilas", "skill_level": "beginner", "cost_per_player": 2.0, "dist_km": 1.5},
        {"sport": "basketball", "day_of_week": 3, "hour_of_day": 18,
         "neighborhood": "Vilas", "skill_level": "beginner", "cost_per_player": 2.0, "dist_km": 1.5},
        {"sport": "frisbee",    "day_of_week": 5, "hour_of_day": 15,
         "neighborhood": "Near West", "skill_level": "beginner", "cost_per_player": 0.0, "dist_km": 3.0},
    ]
    candidates = [
        {"game_id": "A", "sport": "basketball", "day_of_week": 3, "hour_of_day": 18, "neighborhood": "Vilas",      "skill_level": "beginner",     "cost_per_player": 2.0, "dist_km": 1.2},
        {"game_id": "B", "sport": "soccer",     "day_of_week": 1, "hour_of_day": 10, "neighborhood": "Wingra",     "skill_level": "intermediate", "cost_per_player": 5.0, "dist_km": 4.0},
        {"game_id": "C", "sport": "frisbee",    "day_of_week": 5, "hour_of_day": 15, "neighborhood": "Near West",  "skill_level": "beginner",     "cost_per_player": 0.0, "dist_km": 3.5},
        {"game_id": "D", "sport": "tennis",     "day_of_week": 6, "hour_of_day": 9,  "neighborhood": "Riverside",  "skill_level": "advanced",     "cost_per_player": 10.0,"dist_km": 20.0},
    ]
    ranked = score_new_user(model, history, candidates, BACKEND)
    print("\nRanked candidates:")
    for r in ranked:
        print(f"  game {r['game_id']} ({r['sport']:>12}) — score {r['score']:.4f}")

if __name__ == "__main__":
    main()
