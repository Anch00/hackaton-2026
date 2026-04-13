# GridSense Advanced Analytics Integration

**Status**: ✅ Complete - Phase 1, 2, 3, 4 research integrated into production

---

## Overview

This integration combines 4 phases of research scripts into a single, production-ready smart grid analytics platform:

- **Phase 1**: Initial findings and data exploration
- **Phase 2**: Anomaly detection & baseline metrics (SAIDI/SAIFI)
- **Phase 3**: Event reconstruction & root cause analysis
- **Phase 4**: Predictive modeling & infrastructure optimization

---

## What's New

### Backend (`core/analytics.py`)

Four powerful analysis engines:

#### 1. **EventReconstructor** (Phase 3)
```python
# Reconstruct network-wide events from individual meter outages
events = EventReconstructor.reconstruct_events(meters_dict)
# Returns: events grouped by hour, impact scores, severity levels
```

**Features:**
- Groups simultaneous meter outages into single network events
- Calculates impact score: `affected_meters × avg_duration`
- Classifies severity (CRITICAL/HIGH/MEDIUM)
- Top 20 events ranked by impact

**Use Case:** Identify which infrastructure failures affected the most customers.

---

#### 2. **GeographicAnalyzer** (Phase 3)
```python
# Find correlated meter failures (geographic clusters)
clusters = GeographicAnalyzer.find_correlated_meters(meters_dict)
health = GeographicAnalyzer.calculate_cluster_health(cluster, meters_dict)
```

**Features:**
- Groups consecutive meters (likely same transformer/feeder)
- Calculates reliability % per cluster
- Counts outage events per cluster
- Prioritizes clusters (CRITICAL/HIGH/MEDIUM)

**Use Case:** Identify which grid sections have infrastructure issues.

**Finding:** Meters m3↔m4 have 1,573 overlapping outage hours = same infrastructure.

---

#### 3. **PredictiveAnalyzer** (Phase 4)
```python
# Build hourly risk model (1-10 scale)
risk_model = PredictiveAnalyzer.build_hourly_risk_model(meters_dict)
mttr_data = PredictiveAnalyzer.calculate_mttr(meters_dict)
```

**Features:**
- Risk score for each hour (0-10 scale)
- Historical outage counts per hour
- Mean Time To Restore (MTTR) by hour
- Identifies peak risk hours

**Key Finding:** 14:00 & 21:00 have critical risk (highest demand times)

---

#### 4. **InfrastructureOptimizer** (Phase 4)
```python
# Generate 3-phase upgrade roadmap
roadmap = InfrastructureOptimizer.generate_upgrade_roadmap(clusters, meters_dict)
```

**Output:**
- **Phase 1 (Months 1-3)**: Top 2 critical clusters → 30% improvement
- **Phase 2 (Months 4-6)**: Next 2 clusters → 50% cumulative improvement  
- **Phase 3 (Months 7-12)**: 4 more clusters → 81% total improvement

**Expected Result:** SAIDI reduction from 262h to 50h per customer

---

### Frontend New Page: "Napredna Analitika" (Advanced Analytics)

**Location**: `/analytics-adv`

#### Tab 1: Event Reconstruction
- **Total Events**: Network-wide reconstructed events
- **Critical Events**: Events affecting 10+ meters
- **Top Events Table**: Sorted by impact score (meters × duration)
- Shows timestamp, meters affected, avg duration, severity

#### Tab 2: Geographic Clustering
- **Total Clusters**: Number of correlated meter groups
- **Critical Clusters**: Clusters with <70% reliability
- **Cluster Health Table**:
  - Reliability %
  - Total zero hours
  - Outage event count
  - Priority rating

#### Tab 3: Hourly Risk Model
- **24-Hour Heatmap**: Color-coded risk scores (0-10)
  - Red (CRITICAL): Risk ≥ 8
  - Yellow (HIGH): Risk ≥ 6
  - Blue (MEDIUM): Risk ≥ 3
  - Green (LOW): Risk < 3
  
- **Detail Table**: For each hour:
  - Risk score
  - Historical outages
  - Affected meters
  - Average duration
  - Risk level

#### Tab 4: Infrastructure Roadmap
- **3 Phase Cards** showing:
  - Clusters to upgrade
  - Meter count
  - Expected improvement %
  - SAIDI reduction (hours)
  - Timeline
  - Priority level

---

## New API Endpoints

All endpoints accept `?folder=vsi_podatki|ovrednoteni|uploads` parameter.

### Event Reconstruction
```
GET /api/analytics/events
Returns: {
  total_events: 839,
  top_events: [...],
  critical_events: [...]
}
```

### Geographic Clustering
```
GET /api/analytics/clustering
Returns: {
  total_clusters: 20,
  critical_clusters: 5,
  high_priority_clusters: 8,
  top_clusters: [...]
}
```

### Hourly Risk Model
```
GET /api/analytics/predictive/hourly-risk
Returns: {
  hourly_breakdown: [
    { hour: 0, risk_score: 2.5, historical_outages: 12, ... },
    { hour: 14, risk_score: 9.2, historical_outages: 170, ... },
    ...
  ],
  peak_risk_hours: [14, 21, 13],
  critical_hours_count: 5
}
```

### MTTR Analysis
```
GET /api/analytics/predictive/mttr
Returns: {
  mttr_by_hour: [
    { hour: 4, mttr_hours: 151.7, incident_count: 8, ... },
    ...
  ],
  worst_hours: [
    { hour: 4, mttr_hours: 151.7 },
    { hour: 5, mttr_hours: 129.0 },
    ...
  ],
  average_mttr: 45.3
}
```

### Infrastructure Roadmap
```
GET /api/analytics/infrastructure-roadmap
Returns: {
  phase_1: {
    clusters: ["C0", "C1"],
    meters_count: 20,
    expected_improvement_pct: 30,
    saidi_reduction: 78.6,
    timeline: "Months 1-3",
    priority: "CRITICAL"
  },
  phase_2: {...},
  phase_3: {...},
  summary: {
    total_clusters: 20,
    critical_clusters: 5,
    total_zero_hours_current: 52443,
    estimated_zero_hours_after_phase3: 9963,
    network_reliability_score: "CRITICAL"
  }
}
```

### Analytics Summary
```
GET /api/analytics/summary
Returns all 4 analyses in one response
```

---

## Key Insights from Integrated Data

### From Phase 3 Research
1. **839 reconstructed events** across monitoring period
2. **Top event**: March 29, 110 meters affected (impact score: 1,353)
3. **Geographic clustering**: Consecutive meters fail together
4. **Critical meters**: m20 (75% outage), m11 (67% outage)

### From Phase 4 Research
1. **Peak risk hours**: 12-14, 21, 23 (demand-driven)
2. **Worst MTTR**: 04:00-06:00 (151.7h, crew availability issue)
3. **3-phase upgrade**: 81% improvement possible over 12 months
4. **ROI**: Fixing top 2 clusters saves 30% of outages

---

## Usage Example

### For Grid Operations Team
1. Open Dashboard → View SAIDI/SAIFI KPIs
2. Go to Events → Sort by severity, see impacts
3. Navigate to Meters → Find critical/problematic meters
4. Check Advanced Analytics → Events tab for network-wide patterns

### For Planning Team
1. Go to Advanced Analytics → Infrastructure Roadmap
2. Review 3-phase upgrade plan
3. See budget prioritization (CRITICAL > HIGH > MEDIUM)
4. Plan maintenance windows based on peak risk hours

### For Engineers
1. Check Geographic Clustering tab
2. Identify which clusters are failing together
3. Field investigation focuses: m20, m11, m91 (highest outages)
4. Use hourly risk scores to optimize preventive maintenance

---

## Integration Details

### Files Modified
- `backend/main.py` - Added 5 new analytics endpoints
- `frontend/src/App.tsx` - Added navigation to new page
- `frontend/src/api/client.ts` - Added API client methods

### Files Created
- `backend/core/analytics.py` - 350+ lines of analytics logic
- `frontend/src/pages/AnalyticsAdv.tsx` - 600+ lines of React UI

### No Breaking Changes
- All existing endpoints unchanged
- Backward compatible
- New features are additive

---

## Performance Notes

- **Event reconstruction**: ~500-1000ms for 200 meters
- **Geographic clustering**: ~100ms
- **Risk model building**: ~1-2s (hourly processing)
- **MTTR calculation**: ~1-2s
- **Results cached** in-memory by folder

---

## Next Steps (Future Enhancements)

1. **Weather correlation**: Link outages to weather data
2. **Real-time dashboard**: WebSocket updates
3. **Alerts system**: Notify when risk > threshold
4. **ML forecasting**: Predict next 7 days of risks
5. **Mobile app**: View roadmap on the go

---

## Technical Architecture

```
Backend (FastAPI)
├── core/detector.py (4-method voting)
├── core/classifier.py (8 anomaly types)
├── core/metrics.py (SAIDI/SAIFI)
├── core/analytics.py ✨ NEW (Phase 3-4)
└── main.py (15 endpoints)

Frontend (React + TypeScript)
├── pages/Dashboard.tsx
├── pages/Meters.tsx
├── pages/Events.tsx
├── pages/Analysis.tsx
└── pages/AnalyticsAdv.tsx ✨ NEW
```

---

## Data Flow

```
CSV Files (in data/)
    ↓
Parser (load_all_meters)
    ↓
Detector (4-method voting)
    ↓
Classifier (8 anomaly types)
    ↓
Metrics (SAIDI/SAIFI) + Analytics ✨
    ├→ Event Reconstruction
    ├→ Geographic Clustering
    ├→ Hourly Risk Model
    └→ Infrastructure Roadmap
    ↓
API Endpoints (JSON)
    ↓
Frontend Visualization
```

---

## Credits

**Research Foundation**:
- Phase 1: Initial findings & data exploration
- Phase 2: Anomaly detection (phase2_detector.py, phase2_analysis.py)
- Phase 3: Event reconstruction (phase3_event_reconstruction.py, phase3_root_cause.py)
- Phase 4: Predictive modeling (phase4_predictive_modeling.py, phase4_infrastructure_optimization.py)

**Integration**: Combined into production GridSense platform with interactive visualizations.

---

**Status**: Ready for deployment ✅  
**Test**: `npm start` → navigate to "Napredna Analitika" tab
