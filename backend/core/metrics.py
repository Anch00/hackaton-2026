"""
GridSense — metrics.py
Calculates SAIDI, SAIFI, and cross-meter correlation (systematic outages).
Only IZPAD types count as real interruptions for SAIDI/SAIFI.
ZAMRZNJEN_SIGNAL = meter/communication fault, excluded from SAIDI/SAIFI.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any
from collections import defaultdict
import pandas as pd


# Anomaly types that count as real power interruptions
OUTAGE_TYPES = {"DALJSI_IZPAD", "IZOLIRAN_IZPAD", "DELNI_IZPAD"}
OUTAGE_THRESHOLD_PCT = 0.20   # 20 % of meters → systematic grid outage


@dataclass
class GridMetrics:
    saidi: float
    saifi: float
    total_meters: int
    total_events: int
    total_anomaly_hours: int
    grid_outages: int
    anomaly_type_breakdown: Dict[str, int]
    systematic_events: List[Dict[str, Any]] = field(default_factory=list)


def calculate_metrics(all_blocks: list, total_meters: int) -> GridMetrics:
    """
    Computes SAIDI and SAIFI from AnomalyBlock objects.

    SAIDI = Σ(duration_h × affected_meters) / total_meters
    SAIFI = Σ(affected_meters per outage event) / total_meters

    Also detects systematic grid outages via cross-meter timestamp correlation.
    """
    if total_meters == 0:
        return GridMetrics(
            saidi=0.0,
            saifi=0.0,
            total_meters=0,
            total_events=0,
            total_anomaly_hours=0,
            grid_outages=0,
            anomaly_type_breakdown={},
        )

    saidi_sum = 0.0
    saifi_sum = 0.0
    total_anomaly_hours = 0
    type_counts: Dict[str, int] = {}

    # Hour-level outage map: timestamp → set of meter_ids in outage
    hour_outage_map: Dict[pd.Timestamp, set] = defaultdict(set)

    for block in all_blocks:
        atype = block.anomaly_type
        type_counts[atype] = type_counts.get(atype, 0) + 1
        total_anomaly_hours += block.duration_h

        if atype in OUTAGE_TYPES:
            saidi_sum += block.duration_h  # 1 meter per block
            saifi_sum += 1

            # Fill hour-level map for cross-meter correlation
            try:
                hour_range = pd.date_range(
                    start=block.start,
                    periods=block.duration_h,
                    freq="h",
                )
                for ts in hour_range:
                    hour_outage_map[ts].add(block.meter_id)
            except Exception:
                pass

    saidi = saidi_sum / total_meters
    saifi = saifi_sum / total_meters

    # ── Cross-meter correlation: find systematic outages ──────────────────
    systematic_events: List[Dict[str, Any]] = []
    threshold = max(2, int(total_meters * OUTAGE_THRESHOLD_PCT))

    # Sort hours and group consecutive hours with >threshold meters
    sorted_hours = sorted(hour_outage_map.keys())
    system_runs: List[List[pd.Timestamp]] = []
    current: List[pd.Timestamp] = []

    for i, ts in enumerate(sorted_hours):
        meters_at_ts = hour_outage_map[ts]
        if len(meters_at_ts) >= threshold:
            if current and (ts - current[-1]).total_seconds() > 3600:
                system_runs.append(current)
                current = []
            current.append(ts)
        else:
            if current:
                system_runs.append(current)
                current = []
    if current:
        system_runs.append(current)

    grid_outages = 0
    for run in system_runs:
        if not run:
            continue
        affected = set()
        for ts in run:
            affected |= hour_outage_map[ts]
        systematic_events.append(
            {
                "start": run[0].isoformat(),
                "end": run[-1].isoformat(),
                "duration_h": len(run),
                "affected_meters": sorted(affected),
                "affected_count": len(affected),
                "type": "SISTEMSKI_IZPAD",
                "label": "TP okvara" if len(affected) >= threshold else "Lokalna okvara",
            }
        )
        grid_outages += 1

    return GridMetrics(
        saidi=round(saidi, 4),
        saifi=round(saifi, 4),
        total_meters=total_meters,
        total_events=len(all_blocks),
        total_anomaly_hours=total_anomaly_hours,
        grid_outages=grid_outages,
        anomaly_type_breakdown=type_counts,
        systematic_events=systematic_events,
    )
