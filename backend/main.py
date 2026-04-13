"""
GridSense — main.py
FastAPI application: all REST endpoints.
Security: CORS restricted to localhost, file paths validated, no path traversal.
"""

import io
import csv
import json
import shutil
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from core.parser import load_all_meters, parse_csv, get_meter_filepath
from core.detector import detect_anomalies, _load_model
from core.classifier import extract_blocks, AnomalyBlock
from core.metrics import calculate_metrics
from core.analytics import EventReconstructor, GeographicAnalyzer, PredictiveAnalyzer, InfrastructureOptimizer


# ─── App setup ───────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent.parent / "data"
ALLOWED_FOLDERS = {
    "uploads": BASE_DIR / "uploads",
    "ovrednoteni": BASE_DIR / "ovrednoteni",
    "vsi_podatki": BASE_DIR / "vsi_podatki",
}

app = FastAPI(
    title="GridSense API",
    description="Smart meter anomaly detection for Elektro Maribor hackathon.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# In-memory result cache (session-scoped, no persistent state)
_cache: Dict[str, Any] = {}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _resolve_folder(folder: str) -> Path:
    """Validates and resolves a folder key. Prevents path traversal."""
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(400, f"Mapa '{folder}' ni dovoljena. Dovoljene: {list(ALLOWED_FOLDERS)}")
    return ALLOWED_FOLDERS[folder]


def _get_or_analyze(folder: str) -> Dict[str, Any]:
    """Returns cached result for a folder, running analysis if cache is stale."""
    if "last_result" in _cache and _cache.get("last_folder") == folder:
        return _cache["last_result"]
    folder_path = _resolve_folder(folder)
    result = _analyze_folder(folder_path)
    _cache["last_result"] = result
    _cache["last_folder"] = folder
    return result


def _analyze_folder(folder_path: Path) -> Dict[str, Any]:
    """Core analysis pipeline: parse → detect → classify → metrics."""
    meters_raw = load_all_meters(str(folder_path))
    if not meters_raw:
        raise HTTPException(404, "V mapi ni CSV datotek.")

    all_blocks: List[AnomalyBlock] = []
    meter_results = []

    for meter_id, df in meters_raw.items():
        has_labels = df["anomaly"].notna().any()

        if has_labels:
            df["anomaly_pred"] = df["anomaly"] == 1
        else:
            df = detect_anomalies(df)

        blocks = extract_blocks(df)
        all_blocks.extend(blocks)

        anom_mask = df["anomaly_pred"].fillna(False)
        anom_count = int(anom_mask.sum())
        total = len(df)

        anom_pct = round(anom_count / total * 100, 1) if total else 0.0
        if anom_pct > 25 or any(b.anomaly_type in ("ZAMRZNJEN_SIGNAL", "DALJSI_IZPAD") for b in blocks):
            status = "critical"
        elif anom_count > 0:
            status = "anomaly"
        else:
            status = "normal"

        meter_results.append(
            {
                "meter_id": meter_id,
                "filename": str(df["filename"].iloc[0]),
                "total_readings": total,
                "anomaly_count": anom_count,
                "anomaly_pct": anom_pct,
                "anomaly_types": list({b.anomaly_type for b in blocks}),
                "value_avg": round(float(df["value"].mean()), 2),
                "value_std": round(float(df["value"].std()), 2),
                "status": status,
            }
        )

    metrics = calculate_metrics(all_blocks, len(meters_raw))

    events = [
        {
            "event_id": i + 1,
            "start": b.start.isoformat(),
            "end": b.end.isoformat(),
            "duration_h": b.duration_h,
            "affected_meters": [b.meter_id],
            "affected_count": 1,
            "type": b.anomaly_type,
            "severity": b.severity,
            "is_grid_outage": False,
            "avg_value": b.avg_value,
            "normal_avg": b.normal_avg,
        }
        for i, b in enumerate(all_blocks)
    ]

    # Mark events that overlap with systematic outage windows
    systematic_starts = {e["start"] for e in metrics.systematic_events}
    for ev in events:
        if ev["start"] in systematic_starts:
            ev["is_grid_outage"] = True

    return {
        "meters": sorted(meter_results, key=lambda m: m["meter_id"]),
        "events": events,
        "saidi": metrics.saidi,
        "saifi": metrics.saifi,
        "total_meters": metrics.total_meters,
        "meters_with_anomalies": sum(1 for m in meter_results if m["status"] != "normal"),
        "anomaly_type_breakdown": metrics.anomaly_type_breakdown,
        "systematic_events": metrics.systematic_events,
        "grid_outages": metrics.grid_outages,
        "total_anomaly_hours": metrics.total_anomaly_hours,
        "total_events": metrics.total_events,
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/model-info")
def model_info():
    """Returns Isolation Forest model metadata, or None if not trained yet."""
    m = _load_model()
    if m is None:
        return {"model_loaded": False, "message": "Model not found. Run backend/models/train.py to train it."}
    return {
        "model_loaded": True,
        "contamination": m["contamination"],
        "n_training_rows": m["n_training_rows"],
        "n_estimators": m["model"].n_estimators,
        "feature_names": m["feature_names"],
    }


# ── Upload ──────────────────────────────────────────────────────────────────

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """
    Accepts individual CSV files or a single ZIP archive.
    Saves to data/uploads/. Returns list of saved filenames.
    Security: validates extensions, rejects path traversal in filenames.
    """
    upload_dir = ALLOWED_FOLDERS["uploads"]
    upload_dir.mkdir(parents=True, exist_ok=True)

    ALLOWED_EXT = {".csv", ".zip"}
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB per file

    saved: List[str] = []

    for upload in files:
        # Sanitize filename — strip any directory components
        safe_name = Path(upload.filename or "unknown").name
        ext = Path(safe_name).suffix.lower()

        if ext not in ALLOWED_EXT:
            raise HTTPException(400, f"Nepodprta končnica: {ext}. Dovoljeni: .csv, .zip")

        content = await upload.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(413, f"Datoteka {safe_name} je prevelika (max 50 MB).")

        if ext == ".zip":
            # Extract CSVs from ZIP
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    for member in zf.namelist():
                        member_name = Path(member).name
                        if not member_name or Path(member_name).suffix.lower() != ".csv":
                            continue
                        # Prevent zip slip
                        target = upload_dir / member_name
                        if not str(target.resolve()).startswith(str(upload_dir.resolve())):
                            continue
                        with zf.open(member) as src, open(target, "wb") as dst:
                            shutil.copyfileobj(src, dst)
                        saved.append(member_name)
            except zipfile.BadZipFile:
                raise HTTPException(400, "Neveljaven ZIP arhiv.")
        else:
            target = upload_dir / safe_name
            target.write_bytes(content)
            saved.append(safe_name)

    # Invalidate cache
    _cache.pop("last_result", None)

    return {"uploaded": saved, "count": len(saved)}


# ── Analyze ─────────────────────────────────────────────────────────────────

@app.post("/api/analyze")
def analyze(folder: str = Query(default="vsi_podatki")):
    """Runs the full anomaly detection pipeline on a folder."""
    folder_path = _resolve_folder(folder)
    result = _analyze_folder(folder_path)
    _cache["last_result"] = result
    _cache["last_folder"] = folder
    return result


# ── Meters ──────────────────────────────────────────────────────────────────

@app.get("/api/meters")
def get_meters(folder: str = Query(default="vsi_podatki")):
    """Returns summary list of all meters in a folder."""
    return _get_or_analyze(folder)["meters"]


@app.get("/api/meters/{meter_id}")
def get_meter(
    meter_id: int,
    folder: str = Query(default="vsi_podatki"),
):
    """Returns all readings and anomaly blocks for a single meter."""
    if meter_id < 0:
        raise HTTPException(400, "Neveljaven meter_id")

    folder_path = _resolve_folder(folder)
    filepath = get_meter_filepath(str(folder_path), meter_id)
    if filepath is None:
        raise HTTPException(404, f"Merilnik {meter_id} ne obstaja v mapi '{folder}'.")

    df = parse_csv(str(filepath))
    has_labels = df["anomaly"].notna().any()
    if has_labels:
        df["anomaly_pred"] = df["anomaly"] == 1
    else:
        df = detect_anomalies(df)

    blocks = extract_blocks(df)

    readings = []
    for _, row in df.iterrows():
        atype = None
        ts = row["timestamp"]
        if row.get("anomaly_pred"):
            matching = [b for b in blocks if b.start <= ts <= b.end]
            atype = matching[0].anomaly_type if matching else "NEZNANA_ANOMALIJA"
        readings.append(
            {
                "timestamp": ts.isoformat(),
                "value": round(float(row["value"]), 3),
                "anomaly": bool(row.get("anomaly_pred", False)),
                "anomaly_type": atype,
            }
        )

    anomaly_blocks = [
        {
            "start": b.start.isoformat(),
            "end": b.end.isoformat(),
            "duration_h": b.duration_h,
            "type": b.anomaly_type,
            "severity": b.severity,
            "avg_value": b.avg_value,
            "normal_avg": b.normal_avg,
        }
        for b in blocks
    ]

    return {
        "meter_id": meter_id,
        "readings": readings,
        "anomaly_blocks": anomaly_blocks,
        "total_readings": len(df),
        "anomaly_count": int(df["anomaly_pred"].fillna(False).sum()),
        "value_avg": round(float(df["value"].mean()), 2),
        "value_std": round(float(df["value"].std()), 2),
    }


# ── Events ──────────────────────────────────────────────────────────────────

@app.get("/api/events")
def get_events(folder: str = Query(default="vsi_podatki")):
    """Returns all detected anomaly events."""
    return _get_or_analyze(folder)["events"]


# ── Metrics ─────────────────────────────────────────────────────────────────

@app.get("/api/metrics")
def get_metrics(folder: str = Query(default="vsi_podatki")):
    """Returns SAIDI, SAIFI and other KPIs."""
    r = _get_or_analyze(folder)
    return {
        "saidi": r["saidi"],
        "saifi": r["saifi"],
        "total_meters": r["total_meters"],
        "total_anomaly_hours": r["total_anomaly_hours"],
        "total_events": r["total_events"],
        "grid_outages": r["grid_outages"],
        "meters_with_anomalies": r["meters_with_anomalies"],
        "anomaly_type_breakdown": r["anomaly_type_breakdown"],
        "systematic_events": r.get("systematic_events", []),
    }


# ── Export ───────────────────────────────────────────────────────────────────

@app.get("/api/export/csv")
def export_csv(folder: str = Query(default="vsi_podatki")):
    """Downloads all anomaly events as a CSV file."""
    events = _get_or_analyze(folder)["events"]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["event_id", "start", "end", "duration_h", "affected_meters",
                     "affected_count", "type", "severity", "is_grid_outage"])
    for ev in events:
        writer.writerow([
            ev["event_id"],
            ev["start"],
            ev["end"],
            ev["duration_h"],
            "|".join(str(m) for m in ev["affected_meters"]),
            ev["affected_count"],
            ev["type"],
            ev["severity"],
            ev["is_grid_outage"],
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gridsense_anomalies.csv"},
    )


@app.get("/api/export/json")
def export_json(folder: str = Query(default="vsi_podatki")):
    """Downloads full analysis result as a JSON file."""
    payload = json.dumps(_get_or_analyze(folder), ensure_ascii=False, indent=2)
    return StreamingResponse(
        iter([payload]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=gridsense_result.json"},
    )


# ── ADVANCED ANALYTICS (Phase 3 & 4 Integration) ────────────────────────────

@app.get("/api/analytics/events")
def get_reconstructed_events(folder: str = Query(default="vsi_podatki")):
    """Reconstruct network-wide events from individual meter outages (Phase 3)."""
    folder_path = _resolve_folder(folder)
    meters_dict = load_all_meters(folder_path)
    events = EventReconstructor.reconstruct_events(meters_dict)
    return {
        "total_events": len(events),
        "top_events": events[:20],  # Top 20 by impact
        "critical_events": [e for e in events if e['severity'] == 'CRITICAL'][:10]
    }


@app.get("/api/analytics/clustering")
def get_geographic_clusters(folder: str = Query(default="vsi_podatki")):
    """Analyze geographic meter clusters (Phase 3)."""
    folder_path = _resolve_folder(folder)
    meters_dict = load_all_meters(folder_path)
    clusters = GeographicAnalyzer.find_correlated_meters(meters_dict)
    
    cluster_details = {}
    for cluster_id, meter_ids in clusters.items():
        health = GeographicAnalyzer.calculate_cluster_health(meter_ids, meters_dict)
        cluster_details[cluster_id] = {
            "meter_ids": meter_ids,
            **health
        }
    
    # Sort by priority
    sorted_clusters = sorted(
        cluster_details.items(),
        key=lambda x: (x[1]['priority'] == 'CRITICAL', -x[1]['outage_events'])
    )
    
    return {
        "total_clusters": len(clusters),
        "critical_clusters": sum(1 for c in cluster_details.values() if c['priority'] == 'CRITICAL'),
        "high_priority_clusters": sum(1 for c in cluster_details.values() if c['priority'] in ['CRITICAL', 'HIGH']),
        "top_clusters": [
            {
                "cluster_id": c[0],
                "meters": c[1]["meter_ids"],
                **{k: v for k, v in c[1].items() if k != "meter_ids"}
            }
            for c in sorted_clusters[:15]
        ]
    }


@app.get("/api/analytics/predictive/hourly-risk")
def get_hourly_risk_model(folder: str = Query(default="vsi_podatki")):
    """Predictive model: outage risk by hour-of-day (Phase 4)."""
    folder_path = _resolve_folder(folder)
    meters_dict = load_all_meters(folder_path)
    risk_model = PredictiveAnalyzer.build_hourly_risk_model(meters_dict)
    
    # Convert dict to list for JSON serialization
    hours_data = [
        {
            "hour": hour,
            **risk_model[hour]
        }
        for hour in range(24)
    ]
    
    # Find peak risk hours
    critical_hours = [h for h in hours_data if h['risk_level'] == 'CRITICAL']
    high_hours = [h for h in hours_data if h['risk_level'] == 'HIGH']
    
    return {
        "hourly_breakdown": hours_data,
        "peak_risk_hours": [h['hour'] for h in sorted(critical_hours, key=lambda x: x['risk_score'], reverse=True)],
        "critical_hours_count": len(critical_hours),
        "high_risk_hours_count": len(high_hours)
    }


@app.get("/api/analytics/predictive/mttr")
def get_mttr_analysis(folder: str = Query(default="vsi_podatki")):
    """Mean Time To Restore analysis by hour (Phase 4)."""
    folder_path = _resolve_folder(folder)
    meters_dict = load_all_meters(folder_path)
    mttr_data = PredictiveAnalyzer.calculate_mttr(meters_dict)
    
    # Convert to list for JSON
    hours_data = [
        {
            "hour": hour,
            **mttr_data[hour]
        }
        for hour in range(24)
    ]
    
    # Find worst hours
    worst_hours = sorted(hours_data, key=lambda x: x['mttr_hours'], reverse=True)[:5]
    
    return {
        "mttr_by_hour": hours_data,
        "worst_hours": worst_hours,
        "average_mttr": round(sum(h['mttr_hours'] for h in hours_data) / 24, 2)
    }


@app.get("/api/analytics/infrastructure-roadmap")
def get_infrastructure_roadmap(folder: str = Query(default="vsi_podatki")):
    """3-phase infrastructure upgrade roadmap (Phase 4)."""
    folder_path = _resolve_folder(folder)
    meters_dict = load_all_meters(folder_path)
    clusters = GeographicAnalyzer.find_correlated_meters(meters_dict)
    
    roadmap = InfrastructureOptimizer.generate_upgrade_roadmap(clusters, meters_dict)
    return roadmap


@app.get("/api/analytics/summary")
def get_analytics_summary(folder: str = Query(default="vsi_podatki")):
    """Complete analytics summary (all phases)."""
    folder_path = _resolve_folder(folder)
    meters_dict = load_all_meters(folder_path)
    
    # Reconstruct events
    events = EventReconstructor.reconstruct_events(meters_dict)
    critical_events = [e for e in events if e['severity'] == 'CRITICAL']
    
    # Geographic analysis
    clusters = GeographicAnalyzer.find_correlated_meters(meters_dict)
    critical_clusters = sum(1 for cluster_id, meter_ids in clusters.items()
                          if GeographicAnalyzer.calculate_cluster_health(meter_ids, meters_dict)['priority'] == 'CRITICAL')
    
    # Predictive analysis
    risk_model = PredictiveAnalyzer.build_hourly_risk_model(meters_dict)
    peak_hours = [h for h in range(24) if risk_model[h]['risk_level'] == 'CRITICAL']
    
    return {
        "event_reconstruction": {
            "total_events": len(events),
            "critical_events": len(critical_events),
            "event_distribution": "Phase 3 - Reconstructed events from simultaneous meter outages"
        },
        "geographic_analysis": {
            "total_clusters": len(clusters),
            "critical_clusters": critical_clusters,
            "analysis": "Phase 3 - Meter clustering and correlated failures"
        },
        "predictive_modeling": {
            "peak_risk_hours": peak_hours,
            "critical_hours": len([h for h in range(24) if risk_model[h]['risk_level'] == 'CRITICAL']),
            "analysis": "Phase 4 - Hourly outage risk and MTTR"
        },
        "infrastructure": {
            "roadmap_status": "Available via /api/analytics/infrastructure-roadmap",
            "analysis": "Phase 4 - 3-phase upgrade strategy"
        }
    }

