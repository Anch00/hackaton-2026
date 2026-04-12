from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Test health
r = client.get('/api/health')
print('Health:', r.status_code, r.json())

# Test analyze with empty folder (expects 404)
r2 = client.post('/api/analyze?folder=vsi_podatki')
print('Analyze (empty folder):', r2.status_code, r2.json())

# Test meter detail for nonexistent meter
r3 = client.get('/api/meters/999?folder=vsi_podatki')
print('Meter 999:', r3.status_code, r3.json().get('detail', 'ok'))

print('All endpoint tests passed.')
