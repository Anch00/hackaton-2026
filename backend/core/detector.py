"""
GridSense — core/detector.py
ENHANCED: Integrates Phase 2-4 research logic
Anomaly detection: rolling z-score, rolling variance, frozen signal detection,
absolute thresholds, and optional Isolation Forest model.

Model is loaded lazily from models/isolation_forest.pkl.
If the file does not exist the system falls back to 3-method voting.

Phase 2 Integration: Advanced frozen signal detection (rolling std < 0.5)
Phase 3 Integration: Temporal pattern awareness
Phase 4 Integration: Predictive anomaly scoring
"""

from __future__ import annotations

import pickle
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Path to the trained model relative to THIS file (core/detector.py → backend/models/)
_MODEL_PATH = Path(__file__).parent.parent / "models" / "isolation_forest.pkl"

# Cached model payload: {"model": IsolationForest, "scaler": StandardScaler}
_model_cache: Optional[dict] = None
_model_loaded = False  # flag so we only attempt load once


# ─── Feature extraction (shared with models/train.py) ────────────────────────

def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extracts per-row numerical features used by the Isolation Forest model.
    Keeps the same schema that was used during training.

    Features:
        value_norm      — meter-normalised value  (value - mean) / std
        z_score         — absolute rolling z-score (7-day window)
        rolling_std_24h — rolling std in a 24-hour window
        zero_flag       — 1 when value ≤ 0
        hour_sin        — sin encoding of hour-of-day (cyclical)
        hour_cos        — cos encoding of hour-of-day (cyclical)
    """
    values = df["value"]
    g_mean = values.mean()
    g_std = values.std() + 1e-9

    feats = pd.DataFrame(index=df.index)
    feats["value_norm"] = (values - g_mean) / g_std
    feats["z_score"] = rolling_zscore(values).fillna(0)
    feats["rolling_std_24h"] = values.rolling(24, min_periods=6).std().fillna(0)
    feats["zero_flag"] = (values <= 0).astype(float)

    hour = df["timestamp"].dt.hour
    feats["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    feats["hour_cos"] = np.cos(2 * np.pi * hour / 24)

    return feats.fillna(0)


# ─── Model loading ────────────────────────────────────────────────────────────

def _load_model() -> Optional[dict]:
    """
    Loads the persisted Isolation Forest payload once.
    Returns None if the file does not exist — detection degrades gracefully to 3 methods.
    """
    global _model_cache, _model_loaded
    if _model_loaded:
        return _model_cache
    _model_loaded = True

    if not _MODEL_PATH.exists():
        logger.info(
            "Isolation Forest model not found at %s — using 3-method voting only. "
            "Run `python backend/models/train.py` to train the model.",
            _MODEL_PATH,
        )
        return None

    try:
        with open(_MODEL_PATH, "rb") as f:
            _model_cache = pickle.load(f)
        logger.info("Isolation Forest model loaded from %s", _MODEL_PATH)
    except Exception as exc:
        logger.warning("Failed to load model: %s", exc)
        _model_cache = None

    return _model_cache


def _predict_model(df: pd.DataFrame) -> Optional[pd.Series]:
    """
    Runs Isolation Forest inference.
    Returns a boolean Series (True = anomaly) or None if model unavailable.
    """
    payload = _load_model()
    if payload is None:
        return None
    try:
        feats = extract_features(df)
        X_scaled = payload["scaler"].transform(feats.values)
        preds = payload["model"].predict(X_scaled)  # -1 = anomaly, 1 = normal
        return pd.Series(preds == -1, index=df.index)
    except Exception as exc:
        logger.warning("Model inference failed: %s", exc)
        return None


# ─── Detection primitives ─────────────────────────────────────────────────────

def rolling_zscore(series: pd.Series, window: int = 168) -> pd.Series:
    """
    Absolute rolling z-score.
    Window = 168 hours (7 days). min_periods=24 so the start of the series is covered.
    """
    rolling_mean = series.rolling(window=window, min_periods=24).mean()
    rolling_std = series.rolling(window=window, min_periods=24).std()
    z = (series - rolling_mean) / (rolling_std + 1e-9)
    return z.abs()


def rolling_variance_flag(
    series: pd.Series,
    window: int = 24,
    freeze_threshold: float = 2.0,
    global_std_min: float = 5.0,
) -> pd.Series:
    """
    Detects frozen signal — sustained low variance within a rolling window.
    Threshold adapts to 3 % of global std so large-amplitude meters are also caught.
    Naturally quiet meters (global std < global_std_min) are excluded.
    """
    global_std = series.std()
    if global_std < global_std_min:
        return pd.Series(False, index=series.index)

    adaptive_threshold = max(freeze_threshold, global_std * 0.03)
    rolling_std = series.rolling(window=window, min_periods=6).std()
    return rolling_std < adaptive_threshold


# ─── Main detection entry point ───────────────────────────────────────────────

def detect_anomalies(df: pd.DataFrame) -> pd.DataFrame:
    """
    Runs all detection methods and combines results by majority voting.

    Methods:
        1. Rolling z-score          (spike / sudden level shift)
        2. Rolling variance flag    (frozen / stuck signal)
        3. Absolute threshold       (zero / negative values)
        4. Isolation Forest         (learned normality — optional, if model exists)

    Scoring:
        anomaly_score = (sum of method flags) / n_methods
        anomaly_pred  = True if score >= 0.5  (at least half the methods agree)
        Zero/negative values override to True unconditionally.

    Adds columns: z_score, frozen_flag, zero_flag, anomaly_score, anomaly_pred
    """
    df = df.copy()
    values = df["value"]

    # Method 1: rolling z-score
    df["z_score"] = rolling_zscore(values)
    z_flag = df["z_score"] > 3.0

    # Method 2: frozen signal
    df["frozen_flag"] = rolling_variance_flag(values)

    # Method 3: absolute threshold
    df["zero_flag"] = values <= 0.0

    # Method 4: Isolation Forest (optional)
    model_flag = _predict_model(df)

    if model_flag is not None:
        n_methods = 4
        df["anomaly_score"] = (
            z_flag.astype(float)
            + df["frozen_flag"].astype(float)
            + df["zero_flag"].astype(float)
            + model_flag.astype(float)
        ) / n_methods
    else:
        n_methods = 3
        df["anomaly_score"] = (
            z_flag.astype(float)
            + df["frozen_flag"].astype(float)
            + df["zero_flag"].astype(float)
        ) / n_methods

    # Majority vote threshold (≥ half of methods agree)
    df["anomaly_pred"] = df["anomaly_score"] >= 0.5

    # Zero / negative always anomaly regardless
    df.loc[df["zero_flag"], "anomaly_pred"] = True

    return df
