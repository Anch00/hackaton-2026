# GridSense

Aplikacija za zaznavanje anomalij pametnih merilnikov za Hackathon Elektro Maribor 2026.

## Hiter začetek

### Namestitev — backend

```bash
cd backend
pip install -r requirements.txt
```

### Namestitev — frontend

```bash
cd frontend
npm install
```

### Namestitev — root (za `npm start`)

```bash
npm install
```

### Zagon

```bash
# Oboje naenkrat (priporočeno)
npm start

# Samo backend
npm run backend

# Samo frontend
npm run frontend
```

Backend teče na http://localhost:8000 · Frontend na http://localhost:5173 · API dokumentacija na http://localhost:8000/docs

Backend ima `--reload` — pri vsaki spremembi `.py` datoteke se **samodejno restarta**. Frontenda ni treba restartati — Vite ima hot reload.

## Podatki

CSV datoteke kopiraj v:

- `data/vsi_podatki/` — produkcijski dataset brez label
- `data/ovrednoteni/` — labelirani dataset z anomaly stolpcem (za razvoj in testiranje)
- `data/uploads/` — datoteke naložene prek spletnega vmesnika

Podatki **niso vključeni** v repozitorij — pridobi jih ločeno.

## Funkcionalnosti

- Avtomatsko zaznavanje anomalij: zamrznjen signal, izoliran izpad, daljši izpad, spike, negativna vrednost, drift
- Izračun SAIDI in SAIFI
- Medsebojna korelacija merilnikov — zaznavanje sistemskih izpadov
- Interaktivni grafi (Recharts), heatmapa, tortni diagram
- Izvoz v CSV in JSON
- Nalaganje datotek z vleci-in-spusti

## Tehnološki sklad

- **Backend**: Python 3.10+, FastAPI, pandas, scikit-learn (Isolation Forest)
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Recharts, React Router v6

## Struktura projekta

```
GridSense/
├── backend/
│   ├── main.py               ← FastAPI aplikacija — vsi REST endpointi
│   ├── requirements.txt
│   ├── core/                 ← Poslovna logika (čist Python, brez HTTP)
│   │   ├── parser.py
│   │   ├── detector.py
│   │   ├── classifier.py
│   │   └── metrics.py
│   ├── models/               ← ML model in skripta za trening
│   │   ├── train.py
│   │   └── isolation_forest.pkl
│   └── tests/                ← Ročni integracijski skripti
│       ├── test_pipeline.py
│       ├── test_e2e.py
│       ├── test_api.py
│       ├── test_api2.py
│       ├── run_vsi.py
│       └── debug_m0.py
├── frontend/
│   └── src/
│       ├── api/              ← Axios klient in tipizirni API klici
│       ├── components/       ← Ponovno uporabne UI komponente
│       ├── pages/            ← Strani (route-level komponente)
│       ├── types/            ← Skupni TypeScript tipi
│       └── utils/            ← Skupni pomočniki (formatiranje časovnih žigov itd.)
└── data/
    ├── ovrednoteni/          ← Labelirani CSV-ji (anomaly stolpec prisoten)
    ├── vsi_podatki/          ← Nelabelirani CSV-ji (produkcijski dataset)
    └── uploads/              ← Datoteke naložene prek spletnega vmesnika
```

---

## Backend — podrobno

### `backend/main.py`

Vstopna točka FastAPI aplikacije. Definira vse REST endpointe:

| Metoda | Pot                | Opis                                          |
| ------ | ------------------ | --------------------------------------------- |
| GET    | `/api/health`      | Preverjanje dostopnosti                       |
| GET    | `/api/model-info`  | Status in metapodatki Isolation Forest modela |
| POST   | `/api/upload`      | Nalaganje CSV datotek ali ZIP arhiva          |
| POST   | `/api/analyze`     | Zagon celotnega pipeline-a nad izbrano mapo   |
| GET    | `/api/meters`      | Seznam vseh merilnikov s povzetkom statistike |
| GET    | `/api/meters/{id}` | Vse meritve in anomalija bloki za en merilnik |
| GET    | `/api/events`      | Vse zaznane anomalije                         |
| GET    | `/api/metrics`     | SAIDI, SAIFI in ostali KPI-ji                 |
| GET    | `/api/export/csv`  | Prenos rezultatov kot CSV                     |
| GET    | `/api/export/json` | Prenos rezultatov kot JSON                    |

Rezultati so predpomnjeni v pomnilniku po mapi. Predpomnilnik se razveljavi ob nalaganju ali ponovni analizi.

---

### `backend/core/`

Čista poslovna logika — brez FastAPI odvisnosti. Vsak modul je mogoče uvoziti in testirati neodvisno.

#### `parser.py`

Bere CSV datoteke pametnih merilnikov (brez glave, format: `meter_id, DD.MM HH:MM, vrednost, anomalija`).

- `parse_csv(filepath)` → DataFrame s kolonami `meter_id, timestamp, value, anomaly, filename`
- `load_all_meters(folder)` → `dict[meter_id, DataFrame]` za vse CSV-je v mapi
- `get_meter_filepath(folder, meter_id)` → poišče pot do `m{id}.csv`

Leto ni prisotno v podatkih (format je samo DD.MM HH:MM). Interno se za parsanje pandas datetime uporablja fiksno referenčno leto (2000) — v vmesniku se leto nikoli ne prikaže.

#### `detector.py`

Zaznavanje anomalij — izvede 4 neodvisne metode in združi rezultate z večinskim glasovanjem.

| Metoda           | Logika                                                            | Zaznava                           |
| ---------------- | ----------------------------------------------------------------- | --------------------------------- |
| Rolling z-score  | `\|vrednost − rolling_mean\| / rolling_std > 3.0` (7-dnevno okno) | Spike-i, nenadne spremembe nivoja |
| Rolling varianca | `rolling_std_24h < 3 % globalnega std`                            | Zamrznjen / zaklenjen signal      |
| Absolutni prag   | `vrednost ≤ 0`                                                    | Ničelne ali negativne meritve     |
| Isolation Forest | ML model naučen na normalnih vrsticah                             | Naučeni vzorci anomalij           |

**Glasovanje**: `anomaly_score = Σ(zastavice metod) / n_metod`. Anomalija je zaznana, če `score ≥ 0.5` (vsaj polovica metod se strinja). Ničelne in negativne vrednosti vedno preglasijo rezultat glasovanja v `True`.

Če `isolation_forest.pkl` ne obstaja, sistem brez napake deluje samo s 3 metodami.

Izpostavlja tudi `extract_features(df)` — ekstrakcija 6 značilk, ki jo deli z `models/train.py`:
`value_norm, z_score, rolling_std_24h, zero_flag, hour_sin, hour_cos`

#### `classifier.py`

Združuje zaporedne anomalne vrstice v objekte `AnomalyBlock` in klasificira tip vsakega bloka.

`extract_blocks(df)` — združi vrstice v bloke (toleranca do 2-urne vrzeli), nato pokliče `classify_block()` za vsakega.

`classify_block()` uveljavlja prioritetna pravila po vrstnem redu:

| Tip                  | Pogoj                                                        |
| -------------------- | ------------------------------------------------------------ |
| `NEGATIVNA_VREDNOST` | Katerakoli vrednost < 0                                      |
| `DALJSI_IZPAD`       | Vse vrednosti == 0, trajanje > 2 uri                         |
| `IZOLIRAN_IZPAD`     | Vse vrednosti == 0, trajanje ≤ 2 uri                         |
| `DELNI_IZPAD`        | Nekatere vrednosti == 0                                      |
| `ZAMRZNJEN_SIGNAL`   | Std bloka < 5 % normalnega std (signal stoji)                |
| `IZOLIRANI_SPIKE`    | Kratek blok, z-score > 3σ glede na okoliško normalno periodo |
| `DRIFT`              | Povprečje bloka > 2σ od okoliškega normalnega povprečja      |
| `NEZNANA_ANOMALIJA`  | Nobeno od zgornjega                                          |

Referenca ("normalno") je vzeta iz 48 ur pred in po bloku. Za merilnike, kjer je celotna datoteka anomalna (npr. popolnoma zamrznjen), se kot rezervna referenca uporabi celoten DataFrame merilnika.

Resnost se določi za vsak blok: `HIGH` (izpad > 6 ur ali zamrznjen signal), `MEDIUM` (> 2 uri), `LOW` (ostalo).

#### `metrics.py`

Izračunava kazalnike zanesljivosti in zazna sistemske izpade v mreži.

**SAIDI** (povprečno trajanje prekinitev na odjemalca):

$$SAIDI = \frac{\sum trajanje\_ur}{skupaj\_merilnikov}$$

**SAIFI** (povprečno število prekinitev na odjemalca):

$$SAIFI = \frac{\sum dogodki\_izpada}{skupaj\_merilnikov}$$

Upoštevajo se samo dejanske prekinitve napajanja: `DALJSI_IZPAD`, `IZOLIRAN_IZPAD`, `DELNI_IZPAD`.
`ZAMRZNJEN_SIGNAL` je napaka merilnika ali komunikacije — iz SAIDI/SAIFI je izključen.

**Zaznavanje sistemskih izpadov**: zgradi urno mapo `{časovni_žig → množica merilnikov v izpadu}`. Ure, ko je hkrati brez napajanja > 20 % vseh merilnikov, se združijo v event `SISTEMSKI_IZPAD` (verjetna okvara transformatorja ali omrežja, ne posamezne naprave).

---

### `backend/models/`

#### `train.py`

Enkratna skripta za trening Isolation Forest modela. Poženi jo enkrat, ko imaš labelirane podatke v `data/ovrednoteni/`.

```bash
cd backend
python models/train.py
```

Koraki:

1. Naloži vse labelirane CSV-je iz `data/ovrednoteni/`
2. Izvleče 6 značilk prek `core.detector.extract_features()`
3. Fitira `StandardScaler` samo na **normalnih vrsticah** (`anomaly == 0`)
4. Trenira `IsolationForest(n_estimators=200, contamination=auto)` samo na normalnih vrsticah
5. Evaluira na celotnem labeliranem setu (classification report + ROC-AUC)
6. Shrani `{model, scaler, feature_names, contamination, n_training_rows}` v `isolation_forest.pkl`

Model se nauči, kako izgleda normalno, in pri inferenci označi odstopanja — za trening ne potrebuje labeliranih anomalij, samo normalne vrstice.

#### `isolation_forest.pkl`

Generirana datoteka — ne urejaj ročno. `detector.py` jo naloži lenobno ob prvem zahtevku. Status modela preveri prek `GET /api/model-info`.

---

### `backend/tests/`

Ročni integracijski skripti — **se ne zaganjajo samodejno**. Poženi jih ročno po potrebi med razvojem.

| Skripta            | Kdaj jo poženeš                                                                       |
| ------------------ | ------------------------------------------------------------------------------------- |
| `test_pipeline.py` | Po spremembi kateregakoli modula `core/` — hiter smoke test celotnega pipeline-a      |
| `test_e2e.py`      | Po večjih backendnih spremembah — testira parse → detect → classify → metrics → API   |
| `test_api.py`      | Hiter check da vsi API endpointi pravilno odgovarjajo                                 |
| `test_api2.py`     | Globlja preveritev formata API odgovora z realnimi ovrednotenmi podatki               |
| `run_vsi.py`       | Zmogljivostni benchmark na celotnem datasetu `vsi_podatki` (počasno, ~30–60 s)        |
| `debug_m0.py`      | Debug skripta za popolnoma zamrznjene merilnike (zgodovinska, ohranjena za referenco) |

Vse skripte samodejno dodajo `backend/` v `sys.path` — poženeš jih iz katerekoli mape:

```bash
cd backend
python tests/test_pipeline.py
```

---

## Razvoj in workflow

### Setup po `git clone`

```bash
# Backend (enkrat)
cd backend
pip install -r requirements.txt

# Frontend (enkrat)
cd frontend
npm install

# Root (enkrat) — za npm start
cd ..
npm install
```

> **Podatki niso v repozitoriju.** Pridobi CSV datoteke in jih kopiraj v:
>
> - `data/vsi_podatki/` — produkcijski dataset (brez label)
> - `data/ovrednoteni/` — labelirani dataset (za testiranje in trening modela)

### Model (Isolation Forest)

`isolation_forest.pkl` je že committan — **treniranja po klonu ni potrebno**. Backend ga naloži avtomatsko.

Retreniraš samo kadar:

- imaš nove labelirane podatke v `data/ovrednoteni/`
- si spremenil ekstrakcijo značilk v `core/detector.py`

```bash
cd backend
python models/train.py
```

### Git workflow

Nikoli ne delaš direktno na `main`. Za vsako spremembo odpri lasten branch:

```bash
git checkout -b feature/ime-spremembe
# ... delaj ...
git add .
git commit -m "feat: kratek opis"
git push origin feature/ime-spremembe
# → odpri pull request v GitHubu
```

**Konvencija commit sporočil:**

| Predpona    | Kdaj                                   |
| ----------- | -------------------------------------- |
| `feat:`     | nova funkcionalnost                    |
| `fix:`      | popravek buga                          |
| `refactor:` | čiščenje kode brez spremembe obnašanja |
| `docs:`     | sprememba dokumentacije                |

### Ko spreminjaš backend logiko

Po vsaki spremembi modulov `core/` poženi smoke test preden pushaš:

```bash
cd backend
python tests/test_pipeline.py   # hiter (< 5 s)
python tests/test_e2e.py        # za večje spremembe
```

### Ko dodajaš nov tip anomalije

Sprememba mora biti na **treh mestih hkrati** — TypeScript bo javil napako, če katerokoli manjka:

1. `backend/core/classifier.py` — dodaj pogoj v `classify_block()`
2. `backend/core/metrics.py` — dodaj v `OUTAGE_TYPES`, če gre za pravi izpad
3. `frontend/src/types/index.ts` — dodaj v `AnomalyType`, `ANOMALY_COLORS`, `ANOMALY_LABELS`

### Kaj nikoli ne commitaš

- `data/**/*.csv` — podatki niso del repozitorija
- `backend/__pycache__/`, `frontend/dist/` — generirane datoteke
- `.env` datoteke — lokalna konfiguracija
