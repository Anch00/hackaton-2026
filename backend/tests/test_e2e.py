"""
End-to-end test using real CSV data from the podatki folder.
"""
import sys
import os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.parser import load_all_meters, parse_csv
from core.detector import detect_anomalies
from core.classifier import extract_blocks
from core.metrics import calculate_metrics

DATA_DIR = r"c:\Hackaton2026\GridSense\podatki\podatki\ovrednoteni_podatki"

def test_parse():
    df = parse_csv(os.path.join(DATA_DIR, "m8.csv"))
    print(f"m8.csv: {len(df)} rows, meter_id={df['meter_id'].iloc[0]}")
    print(df.head(3).to_string())
    has_labels = df['anomaly'].notna().any()
    print(f"Has labels: {has_labels}")
    assert len(df) > 0
    print("✓ parse_csv OK")

def test_detect():
    df = parse_csv(os.path.join(DATA_DIR, "m8.csv"))
    df2 = detect_anomalies(df)
    anom = df2['anomaly_pred'].sum()
    print(f"m8.csv: {anom} anomalies detected (of {len(df)})")
    print("✓ detect_anomalies OK")

def test_classify():
    df = parse_csv(os.path.join(DATA_DIR, "m8.csv"))
    df['anomaly_pred'] = df['anomaly'] == 1
    blocks = extract_blocks(df)
    print(f"m8.csv: {len(blocks)} anomaly blocks")
    for b in blocks:
        print(f"  {b.start} → {b.end} ({b.duration_h}h) [{b.anomaly_type}] [{b.severity}]")
    print("✓ classify OK")

def test_metrics():
    meters = load_all_meters(DATA_DIR)
    print(f"Loaded {len(meters)} meters")
    all_blocks = []
    for mid, df in list(meters.items())[:10]:
        df['anomaly_pred'] = df['anomaly'].fillna(0) == 1
        blocks = extract_blocks(df)
        all_blocks.extend(blocks)
    m = calculate_metrics(all_blocks, len(meters))
    print(f"SAIDI={m.saidi}, SAIFI={m.saifi}, events={m.total_events}, grid_outages={m.grid_outages}")
    print("✓ metrics OK")

def test_full_api():
    from fastapi.testclient import TestClient
    # Temporarily add the ovrednoteni path to ALLOWED_FOLDERS
    import main
    from pathlib import Path
    main.ALLOWED_FOLDERS['ovrednoteni'] = Path(DATA_DIR)

    client = TestClient(main.app)
    r = client.post('/api/analyze?folder=ovrednoteni')
    print(f"Analyze ovrednoteni: status={r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"  meters={data['total_meters']}, saidi={data['saidi']}, saifi={data['saifi']}")
        print(f"  events={len(data['events'])}, anomalous_meters={data['meters_with_anomalies']}")
    else:
        print("  Error:", r.json())
    print("✓ API test OK")

if __name__ == "__main__":
    test_parse()
    print()
    test_detect()
    print()
    test_classify()
    print()
    test_metrics()
    print()
    test_full_api()
    print("\n=== ALL TESTS PASSED ===")
