# 🚀 Quick Start: Advanced Analytics

## 5-Minute Setup

### 1. Already Installed?
```bash
cd /home/np/Projects/Hackathon/Git\ pull/hackaton-2026
npm start
```

This starts:
- Backend: http://localhost:8000 (FastAPI)
- Frontend: http://localhost:5173 (React)

### 2. Access Analytics

Open browser → http://localhost:5173

Click: **🔬 Napredna Analitika** (Advanced Analytics)


---

## What You'll See

### Tab 1: Event Reconstruction
**Question**: "What major outages happened?"

**You'll see**:
- 839 reconstructed network events
- March 29: 110 meters went down simultaneously (impact: 1,353)
- Sorted by impact score
- CSV export ready

**Action**: Investigate critical events, find patterns

---

### Tab 2: Geographic Clustering
**Question**: "Which infrastructure sections are failing?"

**You'll see**:
- 20 geographic clusters
- Cluster C0: Only 69.6% reliable (CRITICAL priority)
- Cluster C1: 79.6% reliable (CRITICAL priority)
- Reliability % for each cluster

**Action**: Schedule repairs in C0 & C1 first

---

### Tab 3: Hourly Risk Model
**Question**: "When are outages most likely?"

**You'll see**:
- 24-hour heatmap (color-coded)
- Red hours: 12, 13, 14 (lunch peak)
- Red hours: 21, 23 (evening peak)
- Green hours: 2-6 AM (safe to work)

**Action**: 
- Schedule maintenance in green hours
- Increase crew during red hours
- Pre-position resources before 12:00

---

### Tab 4: Infrastructure Roadmap
**Question**: "How do we fix this?"

**You'll see**:
- **Phase 1**: Replace C0 & C1 (20 meters) → 30% improvement
- **Phase 2**: Replace C2 & C9 (20 meters) → 50% total
- **Phase 3**: Replace 4 more (40 meters) → 81% total

**Action**: 
- Month 1-3: Fix top 2 clusters (biggest ROI)
- Month 4-6: Continue with next priority
- Month 7-12: Preventive maintenance

---

## Dataset Selector

Top left corner: **Choose your data**

```
[Production (vsi_podatki) ▼]
```

Options:
- `vsi_podatki` - Full production dataset (200 meters)
- `ovrednoteni` - Labeled training dataset
- `uploads` - Your uploaded files

Change it → All analytics update instantly!


---

## Advanced Features

### Export Data
- Each table has export icons
- Format: CSV or JSON
- Download to Excel/PowerPoint

### Copy Insights
- Hover over values for tooltips
- Click to copy to clipboard
- Share specific URLs

### Filter & Sort
- Tables are sortable
- Click column headers to sort
- Export filtered results


---

## Common Questions

**Q: My data isn't loading?**
A: Make sure you ran `/api/analyze` on the Dashboard first

**Q: Can I upload my own data?**
A: Yes! Dashboard → File Upload → Choose file → Click Analyze

**Q: How do I share results with my team?**
A: Export tab → Download CSV/JSON → Email or share file

**Q: What's the difference between tabs?**
A:
- **Events** = What happened (past)
- **Clustering** = Where problems are (spatial)
- **Risk Model** = When problems occur (temporal)
- **Roadmap** = How to fix it (strategy)

**Q: Can I update data live?**
A: Currently: Manual upload. Future: WebSocket real-time updates


---

## API Reference

If you want to build your own frontend or integrate with other tools:

```bash
# Events
curl http://localhost:8000/api/analytics/events?folder=vsi_podatki

# Clustering
curl http://localhost:8000/api/analytics/clustering?folder=vsi_podatki

# Hourly Risk
curl http://localhost:8000/api/analytics/predictive/hourly-risk?folder=vsi_podatki

# MTTR
curl http://localhost:8000/api/analytics/predictive/mttr?folder=vsi_podatki

# Roadmap
curl http://localhost:8000/api/analytics/infrastructure-roadmap?folder=vsi_podatki

# Summary (all 4 combined)
curl http://localhost:8000/api/analytics/summary?folder=vsi_podatki
```

All return JSON. Full docs: http://localhost:8000/docs


---

## Performance Notes

- Event reconstruction: ~500ms
- Clustering: ~100ms  
- Risk model: ~2s
- Roadmap: ~1s
- Results cached (subsequent queries instant)

If slow: Your dataset is large! Load in background.


---

## Troubleshooting

**Analytics page shows "Loading..."**
- Wait 10 seconds (processing large dataset)
- Check browser console (Ctrl+Shift+I)
- Restart if stuck: `npm start`

**No data appearing**
- Dashboard first: Click folder → Run Analysis
- Then go to Analytics tab

**Backend won't start**
- Kill existing process: `pkill -f uvicorn`
- Restart: `npm start`

**Frontend won't load**
- Clear cache: Ctrl+Shift+Delete
- Refresh: Ctrl+Shift+R
- Check http://localhost:5173

---

## Next Steps

1. **Explore the data**
   - Click through all tabs
   - Change datasets
   - Export findings

2. **Understand patterns**
   - Which hours risky?
   - Which clusters critical?
   - What's the top event?

3. **Take action**
   - Use roadmap for planning
   - Schedule maintenance in safe hours
   - Prioritize cluster repairs

4. **Share insights**
   - Export data
   - Create presentations
   - Show team the heatmap


---

## Tips & Tricks

**Tip 1**: Green hours (2-6 AM) = best for maintenance

**Tip 2**: C0 & C1 are critical = fix first (30% improvement)

**Tip 3**: 14:00 peak = need extra crew or redundancy

**Tip 4**: Hover heatmap = see exact stats for each hour

**Tip 5**: Sort tables by "Reliability %" = easy priority

**Tip 6**: Export roadmap = show management the plan

**Tip 7**: Risk model = explain why maintenance is needed


---

## Key Statistics (Your Data)

- **Total Meters**: 200
- **Total Events**: 839
- **Critical Events**: 30+
- **Affected Meters**: 163 (81.5%)

- **Current SAIDI**: 262 hours/customer (VERY HIGH)
- **After Phase 1**: 183 hours (-30%)
- **After Phase 3**: 50 hours (-81%) ← GOAL

- **Peak Hours**: 12-14, 21-23
- **Safe Hours**: 02-06
- **Worst Cluster**: C0 (69.6% reliability)


---

## Remember

✨ You now have a **production-grade analytics platform** ✨

- Not just research reports
- But actionable intelligence
- Visualized and interactive
- Ready for team decisions
- Ready for management presentations

**Use it.** 🚀

