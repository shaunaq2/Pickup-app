# PickUp Recommendation Dataset

Synthetic dataset for training a pickup sports game recommendation model.

## Files

| File | Rows | Description |
|------|------|-------------|
| `users.csv` | 500 | User accounts with city and join date |
| `games.csv` | 200 | Game listings with sport, location, time, cost |
| `impressions.csv` | ~167k | Every game shown to a user — the training table |
| `bookings.csv` | ~5k | Confirmed joins (positive labels subset) |
| `user_preferences.csv` | 500 | Aggregated preference summary per user |
| `user_latent_prefs.csv` | 500 | Ground-truth latent preferences (for eval only) |

## User segments

| Segment | Count | Avg bookings | Notes |
|---------|-------|-------------|-------|
| power | 40 (8%) | ~71 | Highly active, strong preferences |
| regular | 110 (22%) | ~18 | Consistent weekly players |
| casual | 200 (40%) | ~1.2 | Play occasionally |
| one_timer | 150 (30%) | ~0.1 | Tried it once |

## Training table: `impressions.csv`

Each row = one game card shown to one user in one session.

### Features
| Column | Type | Description |
|--------|------|-------------|
| `sport_match` | float 0/1 | Game sport matches user's preferred sports |
| `day_match` | float 0/1 | Day of week matches user's preferred days |
| `hour_match` | float 0/1 | Hour matches user's preferred hours |
| `skill_match` | float 0/1 | Skill level compatible with user |
| `neighborhood_match` | float 0/1 | Location in user's preferred neighborhood |
| `cost_within_tol` | float 0/1 | Cost ≤ user's average cost tolerance |
| `dist_km` | float | Distance from user's home city to game |
| `dist_score` | float | 1 - dist_km/80, clipped to [0,1] |
| `pos_decay` | float | 1/(1 + 0.15 * position) — position bias correction |
| `position_in_feed` | int | 0-indexed position in the feed session |
| `seconds_viewed` | int | Time spent looking at the card |

### Label
| Column | Type | Description |
|--------|------|-------------|
| `was_joined` | int 0/1 | **Target variable** — did user join this game? |
| `was_clicked` | int 0/1 | Did user click the card? (secondary signal) |

Label balance: ~3% positive (was_joined=1). This is realistic for recommendation.
Use class_weight='balanced' or scale_pos_weight=32 in your model.

## Recommended model

LightGBM or XGBoost with these features:
```
sport_match, day_match, hour_match, skill_match,
neighborhood_match, cost_within_tol, dist_score,
pos_decay, seconds_viewed
```

Do NOT include position_in_feed as a raw feature — use pos_decay instead.
Do NOT include user_id or game_id directly — these cause leakage.

## Evaluation

Use `user_latent_prefs.csv` to evaluate whether the model learned true preferences.
Split by user: train on 80% of users, test on 20% (not random row split — that leaks).
