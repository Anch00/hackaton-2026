"""Debug m0.csv classification to fix NEZNANA_ANOMALIJA on fully-frozen meters."""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.parser import parse_csv
from core.classifier import extract_blocks, classify_block

DATA_DIR = r"c:\Hackaton2026\GridSense\podatki\podatki\ovrednoteni_podatki"

df = parse_csv(os.path.join(DATA_DIR, "m0.csv"))
df['anomaly_pred'] = df['anomaly'] == 1
print("m0.csv:")
print(f"  rows={len(df)}, all anomaly={df['anomaly_pred'].all()}")
print(f"  value stats: mean={df['value'].mean():.3f}, std={df['value'].std():.6f}, unique={df['value'].nunique()}")
print(f"  value sample: {df['value'].head(5).tolist()}")

blocks = extract_blocks(df)
print(f"  blocks={len(blocks)}")
for b in blocks:
    print(f"    {b.start} → {b.end} | type={b.anomaly_type} | avg={b.avg_value:.3f} | normal_avg={b.normal_avg:.3f}")
    # Reproduce classification manually
    block_df = df.iloc[0:5]
    normal_before = df.iloc[0:0]  # empty
    normal_after = df.iloc[241:289]  # empty too
    import pandas as pd
    normal_df = pd.concat([normal_before, normal_after])
    print(f"    normal_df empty: {normal_df.empty}")
