# GRIDSENSE — Ultimativen prompt za AI agent

> Kopiraj vse spodaj in daj AI agentu (Claude Code, Cursor, Windsurf ali podobno).

---

## KONTEKST PROJEKTA

Gradimo spletno aplikacijo **GridSense** za analizo pametnih števcev v elektrodistribucijskem omrežju. Aplikacija je namenjena hackatonu, ki ga organizira Elektro Maribor. Cilj je na podlagi zgodovinskih podatkov pametnih števcev avtomatsko zaznati anomalije, jih klasificirati po tipu, določiti začetek in konec vsake motnje, ter izračunati standardna kazalnika kakovosti oskrbe z električno energijo: **SAIDI** in **SAIFI**.

Aplikacija mora delovati **100% lokalno**, brez internetne povezave, brez cloud storitev, brez baze podatkov. Vsi podatki so CSV datoteke na lokalnem disku.

---

## STRUKTURA PODATKOV — natančen opis

### Format CSV datotek

Vsaka CSV datoteka predstavlja **en pametni merilnik** (eno gospodinjstvo ali objekt). Datoteke nimajo headerja. Vsaka vrstica ima strukturo:

```
<meter_id>,<timestamp>,<value>[,<anomaly>]
```

**Stolpci:**

- `meter_id` — celo število, ID merilnika (npr. 0, 2, 3, 8, 22, 66, 134, 187...)
- `timestamp` — format `DD.MM HH:MM` (dan.mesec ura:minuta), interval je točno 1 ura, leto ni podano (privzeto 2024)
- `value` — decimalno število, meritev (aktivna moč v W ali podobna električna veličina). Vrednosti se med merilniki zelo razlikujejo — nekateri merijo 1–10, drugi 100–500, tretji 300–600. Enota je pri vseh merilnikih enaka, razlike so posledica velikosti gospodinjstva/objekta.
- `anomaly` — **opcijsko**, prisotno samo v ovrednotenih datotekah. Vrednost 0 = normalno, 1 = anomalija.

**Primer vrstice brez labela (neovrednotena datoteka):**

```
8,01.03 07:00,379.220
```

**Primer vrstice z labelom (ovrednotena datoteka):**

```
8,08.03 12:00,486.089,1
```

### Dve mapi podatkov

```
data/
  ovrednoteni/     ← ~200 CSV datotek Z labelom anomalije (0/1)
                      Namenjene učenju in razvoju algoritmov.
  vsi_podatki/     ← ~200 CSV datotek BREZ labela
                      To je dejanska naloga — tukaj mora app sam zaznati anomalije.
```

Datoteke v obeh mapah imajo enaka imena (npr. m2.csv, m8.csv...) in enake vrednosti — razlika je samo v prisotnosti 4. stolpca (labela).

### Časovni obseg

Podatki pokrivajo obdobje od 1.3. do konca septembra (pribl. 4400–5200 vrstic na datoteko pri neovrednotenih, pribl. 241 vrstic pri nekaterih krajših ovrednotenih).

### Primeri realnih vrednosti

| Merilnik | Tipične vrednosti     | Opis                                             |
| -------- | --------------------- | ------------------------------------------------ |
| m0.csv   | ~27.68 (konstanta)    | Zamrznjen merilnik — cela datoteka anomalija     |
| m8.csv   | 334–528, nato 481–486 | Normalen profil, potem zamrznitev od vrstice 181 |
| m22.csv  | 99–367                | Zdrav merilnik z dnevnim ritmom                  |
| m66.csv  | 1.4–9.2               | Majhen objekt, zdrav                             |
| m187.csv | 130–216, ena ura 0.0  | Izoliran izpad ene ure                           |

---

## TIPI ANOMALIJ

Aplikacija mora prepoznati naslednje tipe anomalij:

### 1. ZAMRZNJEN_SIGNAL

Signal se "zatakne" na konstantni vrednosti. Ni več dnevnega ritma. Rolling std v oknu 24h pade pod ~2.0, medtem ko je normalna std merilnika bistveno višja (>5).

- Primer: m8.csv — od 8.3 12:00 dalje vrednost stoji na ~484, čeprav prej niha med 334 in 528.
- Zazna se: rolling_std(24h okno) < 2.0 AND normalna_std > 5

### 2. IZOLIRAN_IZPAD

Vrednost pade na 0.0 za 1–2 zaporedni uri, potem se vrne v normalo. Verjetno komunikacijska napaka ali kratkotrajni izpad.

- Primer: m187.csv — 9.3 ob 21:00 vrednost = 0.0, ob 22:00 spet 176.

### 3. DALJI_IZPAD

Vrednost = 0.0 za 3 ali več zaporednih ur. Verjetno pravi izpad napajanja ali daljša okvara.

- Primer: m2.csv — 1558 zaporednih ničel.

### 4. IZOLIRANI_SPIKE

Nenadni skok ali padec vrednosti za 1–3 ure, potem vrnitev v normalo. Z-score > 3.5 glede na lokalni kontekst.

### 5. NEGATIVNA_VREDNOST

Vrednost pade pod 0. Fizikalno nemogoče pri merjenju porabe — napaka merilnika.

### 6. DRIFT

Postopna sprememba nivoja vrednosti skozi čas — povprečje druge polovice datoteke se razlikuje od prve za >15%.

### 7. DELNI_IZPAD

Blok anomalij vsebuje mešanico — nekatere ure imajo vrednost 0, druge ne.

---

## DETEKCIJSKA LOGIKA — algoritem

### Za ovrednotene podatke (učenje)

Labeli v 4. stolpcu so primarna resnica. Za vsak blok zaporednih vrstic z labelom=1:

1. Poglej vrednosti v bloku
2. Primerjaj z normalnimi vrednostmi pred in po bloku (referenčni okni po 48 ur)
3. Klasificiraj tip glede na kriterije zgoraj

### Za neovrednotene podatke (produkcija)

Brez labelov — tri metode vzporedno, rezultati se kombinirajo:

**Metoda 1 — Rolling Z-score:**

```python
# Za vsako vrstico i:
window = vrednosti[max(0, i-168):i]  # zadnjih 7 dni
local_avg = mean(window)
local_std = std(window)
z_score = abs(value[i] - local_avg) / local_std
# anomalija če z_score > 3.0
```

**Metoda 2 — Rolling variance (zamrznitev):**

```python
# Za vsako vrstico i:
window_std = std(vrednosti[max(0, i-24):i+1])
# anomalija če window_std < 2.0 AND globalna_std > 10
```

**Metoda 3 — Absolutni prag:**

```python
# anomalija če value == 0.0
# anomalija če value < 0
```

**Kombinacija:**

- Vsaka metoda da score 0 ali 1
- Skupni score = vsota / 3
- Anomalija če score > 0.5 (vsaj 2 od 3 metod se strinjata)

### SAIDI in SAIFI izračun

Po detekciji anomalij grupiramo zaporedne anomalije v "dogodke":

- Maksimalni gap znotraj istega dogodka: 2 uri
- Minimum trajanja da šteje kot pravi izpad: 1 ura

```
SAIDI = Σ(trajanje_dogodka_h × število_prizadetih_merilnikov) / skupno_število_merilnikov

SAIFI = Σ(število_prizadetih_merilnikov per dogodek) / skupno_število_merilnikov
```

Skupinski izpad (>5% merilnikov z anomalijo v isti uri) = pravi izpad omrežja.
Anomalija samo pri enem merilniku = lokalna napaka / komunikacijska napaka.

---

## TECH STACK

### Backend

- **Python 3.10+**
- **FastAPI** — REST API strežnik
- **pandas** — obdelava CSV podatkov in časovnih vrst
- **numpy** — numerični izračuni
- **scikit-learn** — Isolation Forest model (sekundarna metoda detekcije)
- **uvicorn** — ASGI strežnik za FastAPI
- **python-multipart** — za file upload
- **pydantic** — validacija podatkov

### Frontend

- **React 18** z **Vite** (ne Create React App)
- **TypeScript**
- **Recharts** — grafi (časovne vrste, heatmap)
- **TailwindCSS** — styling
- **React Router v6** — navigacija med pogledi
- **axios** — HTTP klic na FastAPI
- **date-fns** — formatiranje datumov

### Projektna struktura

```
gridsense/
├── backend/
│   ├── main.py              # FastAPI app, vsi endpointi
│   ├── parser.py            # CSV bralec, normalizacija
│   ├── detector.py          # anomaly detection logika
│   ├── classifier.py        # grupiranje v dogodke, tipizacija
│   ├── metrics.py           # SAIDI/SAIFI kalkulator
│   ├── models/
│   │   └── isolation_forest.pkl  # naučen model (generira train.py)
│   ├── train.py             # enkratno učenje modela
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # KPI + overview
│   │   │   ├── Meters.tsx         # seznam merilnikov
│   │   │   ├── MeterDetail.tsx    # detajl enega merilnika z grafom
│   │   │   ├── Events.tsx         # tabela dogodkov
│   │   │   └── Analysis.tsx       # primerjava merilnikov
│   │   ├── components/
│   │   │   ├── TimelineChart.tsx  # Recharts graf vrednosti
│   │   │   ├── AnomalyBadge.tsx   # barvni badge za tip anomalije
│   │   │   ├── EventTable.tsx     # tabela z dogodki
│   │   │   ├── HeatmapChart.tsx   # heatmap anomalij
│   │   │   ├── KpiCard.tsx        # SAIDI/SAIFI kartica
│   │   │   └── FileUpload.tsx     # drag & drop upload
│   │   ├── api/
│   │   │   └── client.ts          # axios instance + typed API calls
│   │   └── types/
│   │       └── index.ts           # TypeScript tipi
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── data/
│   ├── ovrednoteni/          # sem dam ovrednotene CSV-je
│   └── vsi_podatki/          # sem dam vse CSV-je
└── README.md
```

---

## BACKEND — FastAPI endpointi

### POST /api/upload

Sprejme ZIP arhiv ali posamezne CSV datoteke. Shrani jih v `data/uploads/`. Vrne seznam naloženih datotek.

```json
Response: {
  "uploaded": ["m2.csv", "m8.csv", ...],
  "count": 42
}
```

### POST /api/analyze

Požene celotno analizo na naloženih datotekah. To je glavni endpoint ki kliče parser → detector → classifier → metrics.

```json
Request: {
  "folder": "uploads",  // ali "ovrednoteni" ali "vsi_podatki"
  "mode": "auto"        // "labeled" za ovrednotene, "auto" za neovrednotene
}

Response: {
  "meters": [...],      // seznam merilnikov z rezultati
  "events": [...],      // seznam zaznanih dogodkov
  "saidi": 2.34,
  "saifi": 1.12,
  "total_meters": 200,
  "meters_with_anomalies": 47
}
```

### GET /api/meters

Vrne seznam vseh merilnikov z osnovnimi statistikami.

```json
Response: [
  {
    "meter_id": 8,
    "filename": "m8.csv",
    "total_readings": 241,
    "anomaly_count": 61,
    "anomaly_pct": 25.3,
    "anomaly_types": ["ZAMRZNJEN_SIGNAL"],
    "value_avg": 431.63,
    "value_std": 64.93,
    "status": "anomaly"  // "normal" | "anomaly" | "critical"
  }
]
```

### GET /api/meters/{meter_id}

Vrne vse meritve za en merilnik z anomalija flagom.

```json
Response: {
  "meter_id": 8,
  "readings": [
    {"timestamp": "2024-03-01T00:00:00", "value": 354.448, "anomaly": 0, "anomaly_type": null},
    {"timestamp": "2024-03-08T12:00:00", "value": 486.089, "anomaly": 1, "anomaly_type": "ZAMRZNJEN_SIGNAL"}
  ],
  "anomaly_blocks": [
    {"start": "2024-03-08T12:00:00", "end": "2024-03-11T00:00:00", "duration_h": 61, "type": "ZAMRZNJEN_SIGNAL"}
  ]
}
```

### GET /api/events

Vrne seznam vseh zaznanih dogodkov (grupirane anomalije).

```json
Response: [
  {
    "event_id": 1,
    "start": "2024-03-08T12:00:00",
    "end": "2024-03-11T00:00:00",
    "duration_h": 61,
    "affected_meters": [8],
    "affected_count": 1,
    "type": "ZAMRZNJEN_SIGNAL",
    "severity": "HIGH",
    "is_grid_outage": false
  }
]
```

### GET /api/metrics

Vrne SAIDI, SAIFI in ostale KPI.

```json
Response: {
  "saidi": 2.34,
  "saifi": 1.12,
  "total_meters": 200,
  "total_anomaly_hours": 4521,
  "total_events": 89,
  "grid_outages": 3,
  "anomaly_type_breakdown": {
    "ZAMRZNJEN_SIGNAL": 12,
    "IZOLIRAN_IZPAD": 45,
    "DALJI_IZPAD": 8,
    "IZOLIRANI_SPIKE": 24
  }
}
```

### GET /api/export/csv

Vrne CSV z vsemi anomalijami (za oddajo hackatona).

### GET /api/export/json

Vrne JSON z vsemi dogodki in metrikami.

---

## FRONTEND — strani in komponente

### 1. Dashboard (/)

Naslovna stran. Prikazuje:

- 4 velike KPI kartice: SAIDI, SAIFI, Število anomalnih merilnikov, Skupaj ur motenj
- Heatmap: x-os = čas (dnevi), y-os = merilnik ID, barva = tip anomalije (zelena=OK, rumena=spike, oranžna=izpad, rdeča=zamrznitev)
- Pie chart: razdelitev tipov anomalij
- Gumb "Zaženi analizo" ki pokliče POST /api/analyze

### 2. Merilniki (/meters)

Tabela vseh merilnikov:

- Stolpci: ID, Datoteka, Število meritev, Anomalije (%), Tip, Status badge
- Filtriranje po tipu anomalije in statusu
- Klik na vrstico → odpre MeterDetail

### 3. Detajl merilnika (/meters/:id)

- Recharts LineChart: vrednosti skozi čas
- Anomalije označene z rdečimi pikami ali obarvanim ozadjem
- Pod grafom: tabela blokov anomalij (začetek, konec, trajanje, tip)
- Gumb za izvoz tega merilnika v CSV

### 4. Dogodki (/events)

Tabela vseh zaznanih dogodkov:

- Stolpci: ID, Začetek, Konec, Trajanje (h), Prizadeti merilniki, Tip, Resnost, Mrežni izpad (da/ne)
- Filtriranje po tipu in resnosti
- Sortiranje po trajanju ali začetku

### 5. Analiza (/analysis)

- Multi-select merilnikov za primerjavo
- Recharts s prekrivajočimi se linijami različnih barv
- Marker na časovni osi kjer je bil skupinski izpad

---

## USER FLOW — kako aplikacija deluje

```
1. Uporabnik odpre app v brskalniku (http://localhost:5173)

2. SETUP (enkratno):
   - Klikne "Naloži podatke"
   - Drag & drop ZIP arhiva s CSV datotekami ALI izbere mapo
   - App naloži datoteke na backend (POST /api/upload)
   - Prikaže "Naloženih X datotek"

3. ANALIZA:
   - Klikne "Zaženi analizo"
   - Backend požene celoten pipeline (parse → detect → classify → metrics)
   - Loading spinner med analizo (lahko traja 10–30 sekund za 200 datotek)
   - Ko konča, prikaže Dashboard z rezultati

4. PREGLED:
   - Na Dashboardu vidi KPI in heatmap
   - Klikne na merilnik v heatmapu → odpre MeterDetail z grafom
   - Na strani Dogodki vidi vse zaznane motnje
   - Filtrira po tipu ali resnosti

5. IZVOZ:
   - Klikne "Izvozi CSV" ali "Izvozi JSON"
   - Browser prenese datoteko z rezultati
```

---

## BACKEND IMPLEMENTACIJA — ključne funkcije

### parser.py

### backend/parser.py — Robustno nalaganje

- Samodejno zaznaj separator (vejica, podpičje ali presledek) — `sep=None`.
- **Normalizacija enot:** Če so vrednosti v datoteki konstantno majhne (npr. max < 10), predpostavi enoto kW in interno pretvori v W (pomnoži s 1000) za poenoteno procesiranje, ALI pa prilagodi pragove rolling_std dinamiki posameznega merilnika.
- Obravnavaj manjkajoče ure v časovni vrsti (reindex na 1h interval in označi kot MISSING_DATA anomalijo).

```python
import pandas as pd
from pathlib import Path
from typing import Optional

def parse_csv(filepath: str) -> pd.DataFrame:
    """
    Prebere CSV datoteko merilnika. Brez headerja.
    Stolpci: meter_id, timestamp_raw, value, anomaly (opcijsko)
    Vrne DataFrame z kolonami: meter_id, timestamp, value, anomaly
    """
    rows = []
    with open(filepath, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(',')
            if len(parts) < 3:
                continue
            try:
                meter_id = int(parts[0])
                ts_raw = parts[1].strip()  # "DD.MM HH:MM"
                value = float(parts[2])
                anomaly = int(parts[3]) if len(parts) > 3 else None
                rows.append({
                    'meter_id': meter_id,
                    'timestamp_raw': ts_raw,
                    'value': value,
                    'anomaly': anomaly
                })
            except (ValueError, IndexError):
                continue

    df = pd.DataFrame(rows)
    # Parsiraj timestamp — dodaj leto 2024
    df['timestamp'] = pd.to_datetime(
        '2024.' + df['timestamp_raw'],
        format='%Y.%d.%m %H:%M',
        errors='coerce'
    )
    df = df.dropna(subset=['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    return df

def load_all_meters(folder: str) -> dict[int, pd.DataFrame]:
    """Naloži vse CSV datoteke iz mape. Vrne dict {meter_id: DataFrame}."""
    folder = Path(folder)
    meters = {}
    for filepath in sorted(folder.glob('*.csv')):
        df = parse_csv(str(filepath))
        if not df.empty:
            meter_id = df['meter_id'].iloc[0]
            df['filename'] = filepath.name
            meters[meter_id] = df
    return meters
```

### detector.py

```python
import pandas as pd
import numpy as np
from typing import Optional

def rolling_zscore(series: pd.Series, window: int = 168) -> pd.Series:
    """Z-score glede na drseče povprečje in std zadnjih `window` ur."""
    rolling_mean = series.rolling(window=window, min_periods=24).mean()
    rolling_std = series.rolling(window=window, min_periods=24).std()
    z = (series - rolling_mean) / (rolling_std + 1e-9)
    return z.abs()

def rolling_variance_flag(series: pd.Series, window: int = 24, threshold: float = 2.0) -> pd.Series:
    """Zazna zamrznjen signal — nizka varianca v oknu."""
    global_std = series.std()
    if global_std < 5:  # merilnik z malo varianco je normalno miren
        return pd.Series(False, index=series.index)
    rolling_std = series.rolling(window=window, min_periods=6).std()
    return rolling_std < threshold

def detect_anomalies(df: pd.DataFrame) -> pd.DataFrame:
    """
    Za neovrednotene podatke: požene vse tri metode in kombinira.
    Doda kolone: z_score, frozen_flag, zero_flag, anomaly_score, anomaly_pred
    """
    df = df.copy()
    values = df['value']

    # Metoda 1: rolling z-score
    df['z_score'] = rolling_zscore(values)
    z_flag = df['z_score'] > 3.0

    # Metoda 2: zamrznjen signal
    df['frozen_flag'] = rolling_variance_flag(values)

    # Metoda 3: absolutni prag
    df['zero_flag'] = values <= 0.0

    # Kombinacija (glasovanje)
    df['anomaly_score'] = (z_flag.astype(int) + df['frozen_flag'].astype(int) + df['zero_flag'].astype(int)) / 3.0
    df['anomaly_pred'] = df['anomaly_score'] >= 0.34  # vsaj 1 od 3 metod

    # Za ničle je anomalija vedno
    df.loc[df['zero_flag'], 'anomaly_pred'] = True

    return df
```

### classifier.py

### backend/classifier.py — Logika klasifikacije

Pretvori detektirane anomalije v bloke (start, end) in jim dodeli tip:

- **IZOLIRAN_IZPAD**: Vrednost == 0.0 (1-2 zaporedni uri).
- **DALJI_IZPAD**: Vrednost == 0.0 (3+ zaporedne ure).
- **ZAMRZNJEN_SIGNAL**: rolling_std < prag AND normalna_std > prag_2 (vrednost stoji, a ni 0).
- **NEGATIVNA_VREDNOST**: Vrednost < 0.
- **SPIKE/DRIFT**: Po tvoji obstoječi logiki.

**POMEMBNO ZA INTERPRETACIJO:** Samo tipa `IZOLIRAN_IZPAD` in `DALJI_IZPAD` se upoštevata kot dejanska prekinitev napajanja. `ZAMRZNJEN_SIGNAL` se interpretira kot komunikacijska napaka in NE sme vplivati na SAIDI/SAIFI.

```python
import pandas as pd
import numpy as np
from dataclasses import dataclass
from typing import Optional

@dataclass
class AnomalyBlock:
    meter_id: int
    start: pd.Timestamp
    end: pd.Timestamp
    duration_h: int
    anomaly_type: str
    severity: str  # LOW, MEDIUM, HIGH
    avg_value: float
    normal_avg: float

def classify_block(block_df: pd.DataFrame, normal_df: pd.DataFrame) -> str:
    """Klasificira tip anomalije za en blok vrstic z anomalijo."""
    values = block_df['value']
    duration = len(block_df)

    # Vrednosti = 0
    if (values == 0.0).all():
        return 'DALJI_IZPAD' if duration > 2 else 'IZOLIRAN_IZPAD'
    if (values == 0.0).any():
        return 'DELNI_IZPAD'
    # Negativne vrednosti
    if (values < 0).any():
        return 'NEGATIVNA_VREDNOST'

    # Primerjaj z normalo
    if not normal_df.empty:
        normal_std = normal_df['value'].std()
        block_std = values.std() if len(values) > 1 else 0
        normal_avg = normal_df['value'].mean()
        block_avg = values.mean()

        # Zamrznjen signal
        if block_std < 2.0 and normal_std > 5 and duration >= 6:
            return 'ZAMRZNJEN_SIGNAL'

        # Spike
        if duration <= 3 and normal_std > 0:
            z = abs(block_avg - normal_avg) / normal_std
            if z > 3:
                return 'IZOLIRANI_SPIKE'

        # Drift / izven pasu
        if normal_std > 0:
            z = abs(block_avg - normal_avg) / normal_std
            if z > 2:
                return 'IZVEN_NORMALNEGA_PASU'

    return 'NEZNANA_ANOMALIJA'

def extract_blocks(df: pd.DataFrame, anomaly_col: str = 'anomaly_pred', max_gap_h: int = 2) -> list[AnomalyBlock]:
    """Grupira zaporedne anomalije v bloke (dogodke)."""
    blocks = []
    in_block = False
    block_start_idx = None

    indices = df.index.tolist()
    anomalies = df[anomaly_col].tolist()

    for i, (idx, is_anom) in enumerate(zip(indices, anomalies)):
        if is_anom and not in_block:
            in_block = True
            block_start_idx = i
        elif not is_anom and in_block:
            # Preverimo ali je gap manjši od max_gap_h
            gap = i - (block_start_idx + (i - block_start_idx - 1))
            block_df = df.iloc[block_start_idx:i]
            normal_before = df.iloc[max(0, block_start_idx-48):block_start_idx]
            normal_after = df.iloc[i:i+48]
            normal_df = pd.concat([normal_before, normal_after])

            atype = classify_block(block_df, normal_df)
            duration = len(block_df)

            blocks.append(AnomalyBlock(
                meter_id=int(df['meter_id'].iloc[0]),
                start=df['timestamp'].iloc[block_start_idx],
                end=df['timestamp'].iloc[i-1],
                duration_h=duration,
                anomaly_type=atype,
                severity='HIGH' if duration > 6 or atype in ['DALJI_IZPAD', 'ZAMRZNJEN_SIGNAL'] else 'MEDIUM' if duration > 2 else 'LOW',
                avg_value=float(block_df['value'].mean()),
                normal_avg=float(normal_df['value'].mean()) if not normal_df.empty else 0
            ))
            in_block = False

    return blocks
```

### metrics.py

### backend/metrics.py — SAIDI/SAIFI in sistemska korelacija

Implementiraj izračun kazalnikov:

- **SAIFI**: (Suma vseh prekinitev napajanja pri vseh uporabnikih) / (Skupno število uporabnikov).
- **SAIDI**: (Suma trajanj vseh prekinitev v minutah/urah pri vseh uporabnikih) / (Skupno število uporabnikov).

**DODATNA ANALITIKA — Sistemski dogodki:**
Aplikacija mora izvesti "Cross-Meter Correlation":

1. Identificiraj časovna okna (timestamps), kjer ima več merilnikov hkrati status IZPAD.
2. Če je ob določeni uri > 20% vseh merilnikov v izpadu, to označi kot "SISTEMSKI IZPAD (TP okvara)".
3. Če ima izpad samo en merilnik, ga označi kot "LOKALNA OKVARA (Varovalka/Priključek)".
4. V poročilu/frontendu izpiši seznam teh skupnih dogodkov.

```python
from dataclasses import dataclass
from typing import List

@dataclass
class GridMetrics:
    saidi: float
    saifi: float
    total_meters: int
    total_events: int
    total_anomaly_hours: int
    grid_outages: int
    anomaly_type_breakdown: dict

def calculate_metrics(all_blocks: list, total_meters: int) -> GridMetrics:
    """
    Izračuna SAIDI in SAIFI iz liste AnomalyBlock objektov.

    SAIDI = System Average Interruption Duration Index
          = Σ(trajanje_h × prizadeti_merilniki) / skupaj_merilnikov

    SAIFI = System Average Interruption Frequency Index
          = Σ(prizadeti_merilniki per dogodek) / skupaj_merilnikov

    Upoštevamo samo prave izpade (DALJI_IZPAD, IZOLIRAN_IZPAD),
    ne zamrznjenih signalov (ti so napaka merilnika, ne izpad).
    """
    outage_types = {'DALJI_IZPAD', 'IZOLIRAN_IZPAD', 'DELNI_IZPAD'}

    saidi_sum = 0
    saifi_sum = 0
    total_anomaly_hours = 0
    grid_outages = 0
    type_counts = {}

    for block in all_blocks:
        atype = block.anomaly_type
        type_counts[atype] = type_counts.get(atype, 0) + 1
        total_anomaly_hours += block.duration_h

        if atype in outage_types:
            saidi_sum += block.duration_h * 1  # 1 merilnik
            saifi_sum += 1

    saidi = saidi_sum / total_meters if total_meters > 0 else 0
    saifi = saifi_sum / total_meters if total_meters > 0 else 0

    return GridMetrics(
        saidi=round(saidi, 4),
        saifi=round(saifi, 4),
        total_meters=total_meters,
        total_events=len(all_blocks),
        total_anomaly_hours=total_anomaly_hours,
        grid_outages=grid_outages,
        anomaly_type_breakdown=type_counts
    )
```

### main.py (FastAPI)

```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import os, json, io
from pathlib import Path

from parser import load_all_meters, parse_csv
from detector import detect_anomalies
from classifier import extract_blocks
from metrics import calculate_metrics

app = FastAPI(title="GridSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache rezultatov (za čas seje)
_cache = {}

@app.post("/api/analyze")
def analyze(folder: str = "data/vsi_podatki"):
    meters = load_all_meters(folder)
    all_blocks = []
    meter_results = []

    for meter_id, df in meters.items():
        has_labels = df['anomaly'].notna().any()

        if has_labels:
            # Ovrednoteni podatki — uporabi labele
            df['anomaly_pred'] = df['anomaly'] == 1
        else:
            # Neovrednoteni — poženi detekcijo
            df = detect_anomalies(df)

        blocks = extract_blocks(df)
        all_blocks.extend(blocks)

        anom_count = int(df['anomaly_pred'].sum()) if 'anomaly_pred' in df.columns else 0
        meter_results.append({
            "meter_id": meter_id,
            "filename": df['filename'].iloc[0],
            "total_readings": len(df),
            "anomaly_count": anom_count,
            "anomaly_pct": round(anom_count / len(df) * 100, 1),
            "anomaly_types": list(set(b.anomaly_type for b in blocks)),
            "status": "critical" if anom_count > len(df)*0.1 else "anomaly" if anom_count > 0 else "normal"
        })

    metrics = calculate_metrics(all_blocks, len(meters))
    events = [
        {
            "event_id": i+1,
            "start": b.start.isoformat(),
            "end": b.end.isoformat(),
            "duration_h": b.duration_h,
            "affected_meters": [b.meter_id],
            "affected_count": 1,
            "type": b.anomaly_type,
            "severity": b.severity,
        }
        for i, b in enumerate(all_blocks)
    ]

    result = {
        "meters": meter_results,
        "events": events,
        "saidi": metrics.saidi,
        "saifi": metrics.saifi,
        "total_meters": metrics.total_meters,
        "meters_with_anomalies": sum(1 for m in meter_results if m["status"] != "normal"),
        "anomaly_type_breakdown": metrics.anomaly_type_breakdown
    }
    _cache['last_result'] = result
    return result

@app.get("/api/meters/{meter_id}")
def get_meter(meter_id: int, folder: str = "data/vsi_podatki"):
    filepath = Path(folder) / f"m{meter_id}.csv"
    if not filepath.exists():
        raise HTTPException(404, f"Merilnik {meter_id} ne obstaja")
    df = parse_csv(str(filepath))
    df = detect_anomalies(df)
    return {
        "meter_id": meter_id,
        "readings": df[['timestamp', 'value', 'anomaly_pred']].rename(
            columns={'anomaly_pred': 'anomaly'}
        ).to_dict(orient='records')
    }
```

---

## FRONTEND — ključne komponente

### TypeScript tipi (types/index.ts)

```typescript
export interface MeterSummary {
  meter_id: number;
  filename: string;
  total_readings: number;
  anomaly_count: number;
  anomaly_pct: number;
  anomaly_types: AnomalyType[];
  status: "normal" | "anomaly" | "critical";
}

export type AnomalyType =
  | "ZAMRZNJEN_SIGNAL"
  | "IZOLIRAN_IZPAD"
  | "DALJI_IZPAD"
  | "IZOLIRANI_SPIKE"
  | "NEGATIVNA_VREDNOST"
  | "DRIFT"
  | "DELNI_IZPAD"
  | "NEZNANA_ANOMALIJA";

export interface Event {
  event_id: number;
  start: string;
  end: string;
  duration_h: number;
  affected_meters: number[];
  affected_count: number;
  type: AnomalyType;
  severity: "LOW" | "MEDIUM" | "HIGH";
  is_grid_outage: boolean;
}

export interface AnalysisResult {
  meters: MeterSummary[];
  events: Event[];
  saidi: number;
  saifi: number;
  total_meters: number;
  meters_with_anomalies: number;
  anomaly_type_breakdown: Record<AnomalyType, number>;
}

export interface MeterReading {
  timestamp: string;
  value: number;
  anomaly: boolean;
  anomaly_type?: AnomalyType;
}
```

### Barve za tipe anomalij (v Tailwind/CSS)

```typescript
export const ANOMALY_COLORS: Record<AnomalyType, string> = {
  ZAMRZNJEN_SIGNAL: "#ef4444", // rdeča
  DALJI_IZPAD: "#f97316", // oranžna
  IZOLIRAN_IZPAD: "#eab308", // rumena
  DELNI_IZPAD: "#f59e0b", // jantarna
  IZOLIRANI_SPIKE: "#8b5cf6", // vijolična
  NEGATIVNA_VREDNOST: "#ec4899", // roza
  DRIFT: "#06b6d4", // cyan
  NEZNANA_ANOMALIJA: "#6b7280", // siva
};
```

---

## KAKO ZAGNATI APLIKACIJO

### Backend

```bash
cd backend
pip install fastapi uvicorn pandas numpy scikit-learn python-multipart pydantic
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# odpre se na http://localhost:5173
```

### CORS

Backend dovoli requeste samo z `http://localhost:5173`. Frontend kliče `http://localhost:8000/api/...`.

---

## PRIORITETA IMPLEMENTACIJE

Zgradi v tem vrstnem redu:

1. **backend/parser.py** — branje CSV, normalizacija timestampov
2. **backend/detector.py** — detekcija anomalij (rolling z-score + variance + zero)
3. **backend/classifier.py** — grupiranje v bloke, klasifikacija tipov
4. **backend/metrics.py** — SAIDI/SAIFI
5. **backend/main.py** — FastAPI z /api/analyze in /api/meters/{id}
6. **frontend KpiCard + Dashboard** — najprej KPI kartice
7. **frontend TimelineChart** — Recharts graf za en merilnik
8. **frontend Meters + MeterDetail** — tabela in detajl
9. **frontend Events** — tabela dogodkov
10. **frontend FileUpload** — drag & drop (zadnje, ker ni kritično za demo)

---

## OPOMBE ZA IMPLEMENTACIJO

- Timestamp format v CSV je `DD.MM HH:MM` brez leta. Privzeto leto 2024. Parsiraj kot `pd.to_datetime('2024.' + ts, format='%Y.%d.%m %H:%M')`.
- Nekateri merilniki imajo ~241 vrstic (ovrednoteni, krajše obdobje), drugi ~5000+ vrstic (daljše obdobje). Obe dolžini morata delovati.
- Merilniki imajo zelo različne absolutne vrednosti (1–600). Detekcija mora biti relativna (z-score glede na ta merilnik), ne absolutna.
- Zamrznjen signal pri m0 je posebnost — cela datoteka je anomalija od prve vrstice. Rolling window nima normalnih referenčnih vrednosti pred anomalijo. V tem primeru primerjaj z globalnim povprečjem vseh merilnikov z enako magnitudo.
- SAIDI in SAIFI računamo samo za prave izpade (vrednost=0 ali komunikacijska napaka), ne za zamrznjene merilnike (ti so napaka merilnika, ne motnja v omrežju).
- Za hackaton je ključno da vizualizacija deluje — lepi grafi naredijo dober vtis. Vloži čas v Recharts komponente.
