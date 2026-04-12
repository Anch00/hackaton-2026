import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from core.parser import load_all_meters
from core.detector import detect_anomalies
from core.classifier import extract_blocks
from core.metrics import calculate_metrics
import time

t0 = time.time()
DATA = r"c:\Hackaton2026\GridSense\data\vsi_podatki"
meters = load_all_meters(DATA)
print(f"Loaded {len(meters)} meters in {time.time()-t0:.1f}s")

t1 = time.time()
all_blocks = []
for mid, df in meters.items():
    df2 = detect_anomalies(df)
    blocks = extract_blocks(df2)
    all_blocks.extend(blocks)

print(f"Detection done in {time.time()-t1:.1f}s, {len(all_blocks)} total blocks")
m = calculate_metrics(all_blocks, len(meters))
print(f"SAIDI={m.saidi}")
print(f"SAIFI={m.saifi}")
print(f"Events={m.total_events}")
print(f"Grid outages={m.grid_outages}")
print(f"Type breakdown={m.anomaly_type_breakdown}")
print(f"Total anomaly hours={m.total_anomaly_hours}")
print("DONE")
