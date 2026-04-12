"""
GridSense — classifier.py
Groups consecutive anomaly rows into AnomalyBlock objects and classifies their type.
"""

import pandas as pd
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class AnomalyBlock:
    meter_id: int
    start: pd.Timestamp
    end: pd.Timestamp
    duration_h: int
    anomaly_type: str
    severity: str          # LOW | MEDIUM | HIGH
    avg_value: float
    normal_avg: float


# ─────────────────────────────────────────────
# Type classification
# ─────────────────────────────────────────────

def _severity(atype: str, duration_h: int) -> str:
    if atype in ("DALJSI_IZPAD", "ZAMRZNJEN_SIGNAL") or duration_h > 6:
        return "HIGH"
    if duration_h > 2 or atype in ("DELNI_IZPAD", "NEGATIVNA_VREDNOST"):
        return "MEDIUM"
    return "LOW"


def classify_block(
    block_df: pd.DataFrame,
    normal_df: pd.DataFrame,
    full_df: Optional[pd.DataFrame] = None,
) -> str:
    """
    Classifies the anomaly type for a single contiguous block.
    Priority: NEGATIVNA_VREDNOST > zero-based izpad > ZAMRZNJEN_SIGNAL > SPIKE > DRIFT > UNKNOWN

    full_df: the complete meter DataFrame (used when normal_df is empty, e.g. m0 fully frozen).
    """
    values = block_df["value"]
    duration = len(block_df)

    # Negative values — physically impossible
    if (values < 0).any():
        return "NEGATIVNA_VREDNOST"

    # All zeros → outage
    if (values == 0.0).all():
        return "DALJSI_IZPAD" if duration > 2 else "IZOLIRAN_IZPAD"

    # Some zeros → partial outage
    if (values == 0.0).any():
        return "DELNI_IZPAD"

    block_std = float(values.std()) if duration > 1 else 0.0
    block_avg = float(values.mean())

    # Reference stats: prefer normal_df, fall back to full meter
    ref_df = normal_df if not normal_df.empty else full_df
    normal_avg: Optional[float] = float(ref_df["value"].mean()) if ref_df is not None and not ref_df.empty else None
    normal_std: Optional[float] = (
        float(ref_df["value"].std())
        if ref_df is not None and not ref_df.empty and len(ref_df) > 1
        else None
    )

    # Frozen signal: very low variance in block.
    # When normal_df is empty (whole meter is anomaly), use block_std alone vs global std of full_df.
    if duration >= 4:
        if normal_std is not None and normal_std > 5.0 and block_std < max(2.0, normal_std * 0.05):
            return "ZAMRZNJEN_SIGNAL"
        # Whole-file frozen: no normal reference, but block_std tiny AND values not near 0
        if normal_df.empty and block_std < 2.0 and block_avg > 5.0:
            return "ZAMRZNJEN_SIGNAL"

    # Spike: short block, high z vs normal
    if duration <= 3 and normal_std is not None and normal_std > 0 and normal_avg is not None:
        z = abs(block_avg - normal_avg) / normal_std
        if z > 3.0:
            return "IZOLIRANI_SPIKE"

    # Drift / out-of-band
    if normal_std is not None and normal_std > 0 and normal_avg is not None:
        z = abs(block_avg - normal_avg) / normal_std
        if z > 2.0:
            return "DRIFT"

    return "NEZNANA_ANOMALIJA"


# ─────────────────────────────────────────────
# Block extraction
# ─────────────────────────────────────────────

def extract_blocks(
    df: pd.DataFrame,
    anomaly_col: str = "anomaly_pred",
    max_gap_h: int = 2,
) -> List[AnomalyBlock]:
    """
    Groups consecutive True rows (with optional gap tolerance) into AnomalyBlock list.
    max_gap_h: gap hours to still consider part of same block.
    """
    if anomaly_col not in df.columns or df.empty:
        return []

    blocks: List[AnomalyBlock] = []
    meter_id = int(df["meter_id"].iloc[0])

    # Build list of anomaly indices
    anom_mask = df[anomaly_col].fillna(False).astype(bool)
    anom_indices = anom_mask[anom_mask].index.tolist()

    if not anom_indices:
        return []

    # Group indices into contiguous runs (respecting max_gap_h)
    runs: List[List[int]] = []
    current_run = [anom_indices[0]]
    for prev, curr in zip(anom_indices, anom_indices[1:]):
        # Gap in terms of rows (1 row = 1 hour)
        if (curr - prev) <= max_gap_h:
            current_run.append(curr)
        else:
            runs.append(current_run)
            current_run = [curr]
    runs.append(current_run)

    for run in runs:
        start_idx = run[0]
        end_idx = run[-1]
        block_df = df.loc[start_idx:end_idx]

        # Reference: 48 hours before block and 48 hours after
        before_start = max(df.index[0], start_idx - 48)
        after_end = min(df.index[-1], end_idx + 48)
        normal_before = df.loc[before_start : start_idx - 1]
        normal_after = df.loc[end_idx + 1 : after_end]
        normal_df = pd.concat([normal_before, normal_after])
        # Remove anomalous rows from reference
        if anomaly_col in normal_df.columns:
            normal_df = normal_df[~normal_df[anomaly_col].fillna(False).astype(bool)]

        atype = classify_block(block_df, normal_df, full_df=df)
        duration = max(1, end_idx - start_idx + 1)

        blocks.append(
            AnomalyBlock(
                meter_id=meter_id,
                start=df.loc[start_idx, "timestamp"],
                end=df.loc[end_idx, "timestamp"],
                duration_h=duration,
                anomaly_type=atype,
                severity=_severity(atype, duration),
                avg_value=round(float(block_df["value"].mean()), 3),
                normal_avg=round(float(normal_df["value"].mean()), 3)
                if not normal_df.empty
                else 0.0,
            )
        )

    return blocks
