"""Quick API test - just the analyze endpoint with real data."""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import main
main.ALLOWED_FOLDERS['ovrednoteni'] = Path(r"c:\Hackaton2026\GridSense\podatki\podatki\ovrednoteni_podatki")

from fastapi.testclient import TestClient
client = TestClient(main.app)

print("Testing /api/analyze with ovrednoteni data...")
r = client.post('/api/analyze?folder=ovrednoteni')
print(f"Status: {r.status_code}")
data = r.json()
print(f"Meters: {data['total_meters']}")
print(f"SAIDI: {data['saidi']}, SAIFI: {data['saifi']}")
print(f"Events: {len(data['events'])}")
print(f"Anomalous meters: {data['meters_with_anomalies']}")
print(f"Type breakdown: {data['anomaly_type_breakdown']}")
print(f"Systematic events: {len(data.get('systematic_events', []))}")

# Show first 5 events
for ev in data['events'][:5]:
    print(f"  Event {ev['event_id']}: meter={ev['affected_meters']}, {ev['type']}, {ev['duration_h']}h, sev={ev['severity']}")

print("\nTesting /api/meters/8...")
r2 = client.get('/api/meters/8?folder=ovrednoteni')
d2 = r2.json()
print(f"  Readings: {d2['total_readings']}, Anomalies: {d2['anomaly_count']}")
print(f"  Blocks: {[b['type'] for b in d2['anomaly_blocks']]}")
print("\nAll API tests PASSED")
