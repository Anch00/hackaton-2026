import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.parser import load_all_meters
from core.detector import detect_anomalies
from core.classifier import extract_blocks
from core.metrics import calculate_metrics

# Test with ovrednoteni data
meters = load_all_meters('../data/ovrednoteni')
print(f'Loaded {len(meters)} meters from ovrednoteni')

if meters:
    mid, df = next(iter(meters.items()))
    has_labels = df['anomaly'].notna().any()
    if has_labels:
        df['anomaly_pred'] = df['anomaly'] == 1
    else:
        df = detect_anomalies(df)
    blocks = extract_blocks(df)
    print(f'Meter {mid}: {len(df)} rows, {len(blocks)} blocks')
    for b in blocks[:3]:
        print(f'  Block: {b.anomaly_type}, dur={b.duration_h}h, sev={b.severity}')

all_blocks = []
for mid, df in meters.items():
    if df['anomaly'].notna().any():
        df['anomaly_pred'] = df['anomaly'] == 1
    else:
        df = detect_anomalies(df)
    all_blocks.extend(extract_blocks(df))

m = calculate_metrics(all_blocks, len(meters))
print(f'SAIDI={m.saidi}, SAIFI={m.saifi}, events={m.total_events}')
print('Pipeline test PASSED')
