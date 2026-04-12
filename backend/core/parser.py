"""
GridSense — parser.py
Reads smart meter CSV files, normalizes timestamps, returns DataFrames.
"""

import pandas as pd
from pathlib import Path
from typing import Optional


def parse_csv(filepath: str) -> pd.DataFrame:
    """
    Reads a meter CSV file (no header).
    Columns: meter_id, timestamp_raw (DD.MM HH:MM), value, anomaly (optional)
    Returns DataFrame with: meter_id, timestamp, value, anomaly, filename
    """
    rows = []
    filepath = Path(filepath)

    with open(filepath, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(",")
            if len(parts) < 3:
                continue
            try:
                meter_id = int(parts[0].strip())
                ts_raw = parts[1].strip()   # DD.MM HH:MM
                value = float(parts[2].strip())
                anomaly: Optional[int] = int(parts[3].strip()) if len(parts) > 3 else None
                rows.append(
                    {
                        "meter_id": meter_id,
                        "timestamp_raw": ts_raw,
                        "value": value,
                        "anomaly": anomaly,
                    }
                )
            except (ValueError, IndexError):
                continue

    if not rows:
        return pd.DataFrame(
            columns=["meter_id", "timestamp", "value", "anomaly", "filename"]
        )

    df = pd.DataFrame(rows)

    # Parse timestamp — year is not in the data, use a fixed reference year as placeholder
    df["timestamp"] = pd.to_datetime(
        "2000." + df["timestamp_raw"],
        format="%Y.%d.%m %H:%M",
        errors="coerce",
    )
    df = df.dropna(subset=["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)
    df["filename"] = filepath.name

    # Drop duplicate timestamps (keep first)
    df = df.drop_duplicates(subset=["timestamp"]).reset_index(drop=True)

    return df[["meter_id", "timestamp", "value", "anomaly", "filename"]]


def load_all_meters(folder: str) -> dict:
    """
    Loads all CSV files in a folder.
    Returns dict {meter_id: DataFrame}.
    If multiple files map to same meter_id, last one wins (should not happen).
    """
    folder_path = Path(folder)
    if not folder_path.exists():
        return {}

    meters: dict[int, pd.DataFrame] = {}
    for filepath in sorted(folder_path.glob("*.csv")):
        df = parse_csv(str(filepath))
        if df.empty:
            continue
        meter_id = int(df["meter_id"].iloc[0])
        meters[meter_id] = df

    return meters


def get_meter_filepath(folder: str, meter_id: int) -> Optional[Path]:
    """Returns Path to the meter CSV file if it exists."""
    p = Path(folder) / f"m{meter_id}.csv"
    return p if p.exists() else None
