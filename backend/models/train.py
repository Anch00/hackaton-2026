"""
GridSense — models/train.py
Trains an Isolation Forest anomaly detector on the labelled (ovrednoteni) dataset.

Usage (run once from the repo root or backend/ dir):
    python backend/models/train.py

Output:
    backend/models/isolation_forest.pkl   — model + scaler payload

The trained model is used in core/detector.py as a 4th detection method
alongside rolling z-score, rolling variance, and absolute thresholds.

Why Isolation Forest?
    - Unsupervised — learns what "normal" looks like from clean rows.
    - No class imbalance issues: we train only on anomaly=0 rows.
    - Fast at inference (O(n log n) trees).
    - Works well on small feature sets with mixed units.
"""

from __future__ import annotations

import pickle
import sys
import logging
from pathlib import Path

# Allow imports from backend/core/ regardless of CWD
_BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_BACKEND_DIR))

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, roc_auc_score

from core.parser import load_all_meters
from core.detector import extract_features

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────────
DATA_DIR = _BACKEND_DIR.parent / "data" / "ovrednoteni"
MODEL_PATH = Path(__file__).parent / "isolation_forest.pkl"


# ── Main training routine ──────────────────────────────────────────────────────

def train() -> None:
    logger.info("Loading labelled data from %s …", DATA_DIR)
    meters = load_all_meters(str(DATA_DIR))

    if not meters:
        logger.error("No CSV files found in %s. Place ovrednoteni CSVs there first.", DATA_DIR)
        sys.exit(1)

    # ── Build feature matrix ───────────────────────────────────────────────────
    feat_frames: list[pd.DataFrame] = []
    label_arrays: list[np.ndarray] = []

    for meter_id, df in meters.items():
        if df["anomaly"].isna().all():
            logger.debug("Meter %s has no labels — skipping.", meter_id)
            continue

        feats = extract_features(df)
        labels = df["anomaly"].fillna(0).astype(int).values
        feat_frames.append(feats)
        label_arrays.append(labels)

    if not feat_frames:
        logger.error("No labelled meters found. Cannot train.")
        sys.exit(1)

    X = pd.concat(feat_frames, ignore_index=True).values
    y = np.concatenate(label_arrays)

    n_normal = int((y == 0).sum())
    n_anomaly = int((y == 1).sum())
    contamination_est = round(n_anomaly / len(y), 4)
    logger.info(
        "Dataset: %d meters, %d rows total (%d normal, %d anomaly, contamination=%.3f)",
        len(feat_frames), len(y), n_normal, n_anomaly, contamination_est,
    )

    # ── Scale features ─────────────────────────────────────────────────────────
    scaler = StandardScaler()
    # Fit scaler on NORMAL rows only — same distribution the model will learn
    X_normal = X[y == 0]
    scaler.fit(X_normal)
    X_scaled = scaler.transform(X)
    X_normal_scaled = X_scaled[y == 0]

    # ── Train Isolation Forest on normal rows ──────────────────────────────────
    # contamination = estimated fraction of anomalies expected in new data
    contamination = min(max(contamination_est, 0.01), 0.40)
    logger.info("Training IsolationForest (n_estimators=200, contamination=%.3f) …", contamination)

    model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        max_samples="auto",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_normal_scaled)

    # ── Evaluate on full labelled set ──────────────────────────────────────────
    raw_scores = model.score_samples(X_scaled)          # higher = more normal
    preds = model.predict(X_scaled)                     # -1 = anomaly, 1 = normal
    pred_binary = (preds == -1).astype(int)

    logger.info("\n%s", classification_report(y, pred_binary, target_names=["Normal", "Anomaly"]))
    try:
        auc = roc_auc_score(y, -raw_scores)             # negate: higher anomaly score = more anomaly
        logger.info("ROC-AUC: %.4f", auc)
    except ValueError:
        pass

    # ── Persist model ──────────────────────────────────────────────────────────
    payload = {
        "model": model,
        "scaler": scaler,
        "feature_names": [
            "value_norm", "z_score", "rolling_std_24h",
            "zero_flag", "hour_sin", "hour_cos",
        ],
        "contamination": contamination,
        "n_training_rows": n_normal,
    }
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(payload, f, protocol=pickle.HIGHEST_PROTOCOL)

    logger.info("Model saved → %s", MODEL_PATH)
    logger.info("Run the GridSense backend — the model will be loaded automatically.")


if __name__ == "__main__":
    train()
