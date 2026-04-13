"""
GridSense — core/advanced_analytics.py
Unified Smart Grid Analytics Engine

Integrated Components:
- Advanced frozen signal detection (variance-based)
- Duration-based root cause classification
- Temporal pattern analysis (hourly/daily peaks)
- Spatial correlation detection (neighbor analysis)
- Meter health scoring
- Infrastructure clustering
- Predictive risk modeling with learned patterns
"""

from collections import defaultdict
from typing import Dict, List, Tuple, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import math


class AdvancedFrozenSignalDetector:
    """Phase 2: Enhanced frozen signal detection using rolling variance"""
    
    @staticmethod
    def calculate_rolling_std(values: List[float], window: int = 24) -> List[Optional[float]]:
        """Calculate rolling standard deviation over window"""
        result = []
        for i in range(len(values)):
            start = max(0, i - window + 1)
            window_vals = values[start:i+1]
            if len(window_vals) < 2:
                result.append(None)
                continue
            avg = sum(window_vals) / len(window_vals)
            variance = sum((v - avg) ** 2 for v in window_vals) / len(window_vals)
            result.append(math.sqrt(variance))
        return result
    
    @staticmethod
    def detect_frozen_blocks(df: pd.DataFrame, threshold: float = 0.5, min_duration: int = 5) -> List[Dict]:
        """
        Detect frozen signal blocks (rolling std < threshold).
        Phase 2 logic: signal that doesn't vary = likely frozen or locked.
        """
        if df.empty:
            return []
        
        values = df["value"].values
        rolling_stds = AdvancedFrozenSignalDetector.calculate_rolling_std(values, window=24)
        
        frozen_blocks = []
        in_block = False
        block_start = None
        
        for i, std_val in enumerate(rolling_stds):
            if std_val is not None and std_val < threshold:
                if not in_block:
                    block_start = i
                    in_block = True
            else:
                if in_block:
                    duration = i - block_start
                    if duration > min_duration:
                        frozen_blocks.append({
                            'start_idx': block_start,
                            'end_idx': i - 1,
                            'start_ts': df.iloc[block_start]['timestamp'],
                            'end_ts': df.iloc[i - 1]['timestamp'],
                            'duration_hours': duration,
                            'avg_std': np.mean([s for s in rolling_stds[block_start:i] if s is not None]),
                            'type': 'FROZEN_SIGNAL'
                        })
                    in_block = False
        
        if in_block:
            duration = len(values) - block_start
            if duration > min_duration:
                frozen_blocks.append({
                    'start_idx': block_start,
                    'end_idx': len(values) - 1,
                    'start_ts': df.iloc[block_start]['timestamp'],
                    'end_ts': df.iloc[-1]['timestamp'],
                    'duration_hours': duration,
                    'avg_std': np.mean([s for s in rolling_stds[block_start:] if s is not None]),
                    'type': 'FROZEN_SIGNAL'
                })
        
        return frozen_blocks


class RootCauseClassifier:
    """Phase 3: Classify outages by duration-based root cause"""
    
    @staticmethod
    def classify_by_duration(hours: float) -> Tuple[str, str]:
        """
        Classify outage by duration to infer root cause.
        Phase 3 research: duration patterns reveal cause.
        """
        if hours < 0.5:
            return 'TRANSIENT', 'Fault cleared automatically'
        elif hours < 1:
            return 'BRIEF', 'Possible recloser operation'
        elif hours < 4:
            return 'SHORT', 'Likely fuse/breaker operation (78% of outages)'
        elif hours < 24:
            return 'MEDIUM', 'Component failure - needs repair (13%)'
        elif hours < 72:
            return 'LONG', 'Major incident or maintenance (5%)'
        else:
            return 'VERY_LONG', 'Permanent damage or disconnection (3%)'
    
    @staticmethod
    def analyze_meter_health(df: pd.DataFrame, meter_id: int) -> Dict:
        """
        Phase 3 logic: Analyze meter's historical health.
        Returns comprehensive health profile.
        """
        if df.empty:
            return {'status': 'NO_DATA'}
        
        values = df["value"].values
        zero_count = sum(1 for v in values if v == 0)
        negative_count = sum(1 for v in values if v < 0)
        total_hours = len(values)
        
        # Calculate average consumption when meter is ON
        active_values = [v for v in values if v > 0]
        avg_consumption = sum(active_values) / len(active_values) if active_values else 0
        
        outage_percentage = (zero_count / total_hours * 100) if total_hours > 0 else 0
        
        # Health status based on outage percentage
        if outage_percentage > 50:
            status = 'CRITICAL'  # More than half the time down
        elif outage_percentage > 20:
            status = 'FAILED'
        elif outage_percentage > 5:
            status = 'DAMAGED'
        elif negative_count > 0:
            status = 'ERROR_DATA'
        else:
            status = 'OK'
        
        return {
            'meter_id': meter_id,
            'zero_hours': zero_count,
            'negative_values': negative_count,
            'total_hours': total_hours,
            'outage_percentage': round(outage_percentage, 1),
            'avg_consumption_when_on': round(avg_consumption, 2),
            'status': status,
            'health_score': max(0, 100 - outage_percentage)
        }


class TemporalPatternAnalyzer:
    """Phase 3: Analyze temporal patterns (hourly and daily)"""
    
    @staticmethod
    def parse_timestamp(ts_str: str) -> Optional[Tuple[int, int, int]]:
        """Parse DD.MM HH:MM format to (day, month, hour)"""
        try:
            if hasattr(ts_str, 'hour'):  # Already datetime
                return (ts_str.day, ts_str.month, ts_str.hour)
            
            date_part, time_part = str(ts_str).split()
            day, month = map(int, date_part.split('.'))
            hour = int(time_part.split(':')[0])
            return (day, month, hour)
        except:
            return None
    
    @staticmethod
    def analyze_hourly_patterns(meters_dict: Dict[int, pd.DataFrame]) -> Dict[int, Dict]:
        """
        Analyze outage patterns by hour of day.
        Phase 3 finding: 14:00 and 21:00 have most outages.
        """
        hourly_stats = defaultdict(lambda: {
            'outages': 0,
            'total_zero_hours': 0,
            'affected_meters': set(),
            'durations': []
        })
        
        for meter_id, df in meters_dict.items():
            if df.empty:
                continue
            
            values = df["value"].values
            
            for i, (val, ts) in enumerate(zip(values, df["timestamp"])):
                if val == 0:
                    parsed = TemporalPatternAnalyzer.parse_timestamp(ts)
                    if parsed:
                        day, month, hour = parsed
                        hourly_stats[hour]['total_zero_hours'] += 1
                        hourly_stats[hour]['affected_meters'].add(meter_id)
        
        # Detect outage blocks per hour
        for meter_id, df in meters_dict.items():
            if df.empty:
                continue
            values = df["value"].values
            in_block = False
            block_start = None
            
            for i, val in enumerate(values):
                if val == 0:
                    if not in_block:
                        block_start = i
                        in_block = True
                else:
                    if in_block:
                        duration = i - block_start
                        ts = df.iloc[block_start]["timestamp"]
                        parsed = TemporalPatternAnalyzer.parse_timestamp(ts)
                        if parsed:
                            hour = parsed[2]
                            hourly_stats[hour]['outages'] += 1
                            hourly_stats[hour]['durations'].append(duration)
                        in_block = False
        
        # Convert sets to counts and calculate stats
        result = {}
        for hour in range(24):
            stats = hourly_stats[hour]
            result[hour] = {
                'outages': stats['outages'],
                'affected_meters': len(stats['affected_meters']),
                'total_zero_hours': stats['total_zero_hours'],
                'avg_duration': np.mean(stats['durations']) if stats['durations'] else 0,
                'max_duration': max(stats['durations']) if stats['durations'] else 0
            }
        
        return result
    
    @staticmethod
    def analyze_daily_patterns(meters_dict: Dict[int, pd.DataFrame]) -> Dict[int, Dict]:
        """Analyze outage patterns by day of month"""
        daily_stats = defaultdict(lambda: {'outages': 0, 'affected_meters': set()})
        
        for meter_id, df in meters_dict.items():
            if df.empty:
                continue
            
            values = df["value"].values
            for val, ts in zip(values, df["timestamp"]):
                if val == 0:
                    parsed = TemporalPatternAnalyzer.parse_timestamp(ts)
                    if parsed:
                        day = parsed[0]
                        daily_stats[day]['affected_meters'].add(meter_id)
                        daily_stats[day]['outages'] += 1
        
        return {day: {
            'outages': stats['outages'],
            'affected_meters': len(stats['affected_meters'])
        } for day, stats in daily_stats.items()}


class SpatialCorrelationAnalyzer:
    """Phase 3: Detect geographic/spatial patterns"""
    
    @staticmethod
    def find_neighbor_correlations(meters_dict: Dict[int, pd.DataFrame], 
                                   correlation_threshold: int = 5) -> Dict[Tuple[int, int], int]:
        """
        Analyze spatial correlation between meters.
        Consecutive meters failing together = same infrastructure.
        """
        correlations = defaultdict(int)
        
        meter_ids = sorted(meters_dict.keys())
        
        # Check all consecutive pairs AND wider radius
        for i, meter_id in enumerate(meter_ids):
            if meter_id not in meters_dict:
                continue
            
            df = meters_dict[meter_id]
            values_1 = df["value"].values
            
            # Check multiple neighbors (not just next)
            for j in range(i + 1, min(i + 5, len(meter_ids))):
                neighbor_id = meter_ids[j]
                if neighbor_id in meters_dict:
                    df_neighbor = meters_dict[neighbor_id]
                    values_2 = df_neighbor["value"].values
                    
                    # Count overlapping zero periods
                    overlap = sum(1 for v1, v2 in zip(values_1, values_2) if v1 == 0 and v2 == 0)
                    
                    if overlap >= correlation_threshold:
                        key = tuple(sorted([meter_id, neighbor_id]))
                        correlations[key] = overlap
        
        return dict(sorted(correlations.items(), key=lambda x: -x[1]))
    
    @staticmethod
    def cluster_meters_by_correlation(meters_dict: Dict[int, pd.DataFrame]) -> Dict[int, List[int]]:
        """
        Advanced clustering using correlation analysis.
        Groups meters that fail together (same infrastructure).
        Uses graph-based approach to find connected components.
        """
        # Find all correlations
        correlations = SpatialCorrelationAnalyzer.find_neighbor_correlations(meters_dict, correlation_threshold=5)
        
        # Build adjacency graph
        graph = defaultdict(set)
        for (m1, m2), overlap in correlations.items():
            graph[m1].add(m2)
            graph[m2].add(m1)
        
        # Find connected components (clusters)
        visited = set()
        clusters = {}
        cluster_id = 0
        
        for meter_id in sorted(meters_dict.keys()):
            if meter_id not in visited:
                # BFS to find all connected meters
                queue = [meter_id]
                cluster = []
                
                while queue:
                    current = queue.pop(0)
                    if current in visited:
                        continue
                    
                    visited.add(current)
                    cluster.append(current)
                    
                    # Add neighbors
                    for neighbor in graph[current]:
                        if neighbor not in visited:
                            queue.append(neighbor)
                
                if len(cluster) >= 2:  # Only keep clusters with 2+ meters
                    clusters[cluster_id] = sorted(cluster)
                    cluster_id += 1
        
        return clusters
    
    @staticmethod
    def cluster_meters_by_geography(meters_dict: Dict[int, pd.DataFrame], 
                                    cluster_size: int = 10) -> Dict[int, List[Dict]]:
        """
        Group meters into clusters with health metrics.
        Uses three methods:
        1. Correlation-based clustering (spatial)
        2. ML-based clustering (learned patterns)
        3. Geographic proximity (fallback)
        """
        # Get correlation-based clusters
        print("   [1/3] Correlation-based clustering...")
        corr_clusters = SpatialCorrelationAnalyzer.cluster_meters_by_correlation(meters_dict)
        
        # Get ML-based clusters for enhanced analysis
        print("   [2/3] ML-based clustering...")
        try:
            ml_clusters = MLClusteringAnalyzer.cluster_by_ml_similarity(meters_dict)
        except Exception as e:
            print(f"   ⚠️  ML clustering failed: {e}")
            ml_clusters = {}
        
        # Combine results: correlation clusters are primary, ML adds context
        clusters = {}
        cluster_id = 0
        
        print("   [3/3] Merging correlation + ML clusters...")
        
        # Add correlation-based clusters with health metrics
        for corr_cluster_id, meter_ids in corr_clusters.items():
            cluster_data = []
            for meter_id in meter_ids:
                if meter_id in meters_dict:
                    df = meters_dict[meter_id]
                    values = df["value"].values
                    zero_hours = sum(1 for v in values if v == 0)
                    reliability = 100 * (1 - zero_hours / len(values))
                    
                    cluster_data.append({
                        'meter_id': meter_id,
                        'zero_hours': zero_hours,
                        'reliability': reliability,
                        'total_hours': len(values)
                    })
            
            if cluster_data:
                clusters[cluster_id] = cluster_data
                cluster_id += 1
        
        # Add ML-specific clusters (if they don't overlap with correlation clusters)
        clustered_meters = set()
        for meters in corr_clusters.values():
            clustered_meters.update(meters)
        
        for ml_cluster_id, meter_ids in ml_clusters.items():
            if not any(m in clustered_meters for m in meter_ids):
                cluster_data = []
                for meter_id in meter_ids:
                    if meter_id in meters_dict:
                        df = meters_dict[meter_id]
                        values = df["value"].values
                        zero_hours = sum(1 for v in values if v == 0)
                        reliability = 100 * (1 - zero_hours / len(values))
                        
                        cluster_data.append({
                            'meter_id': meter_id,
                            'zero_hours': zero_hours,
                            'reliability': reliability,
                            'total_hours': len(values)
                        })
                
                if cluster_data:
                    clusters[cluster_id] = cluster_data
                    clustered_meters.update(meter_ids)
                    cluster_id += 1
        
        # Add remaining meters by geographic proximity
        remaining = sorted([m for m in meters_dict.keys() if m not in clustered_meters])
        i = 0
        while i < len(remaining):
            cluster_data = []
            meter_id = remaining[i]
            cluster_data.append({
                'meter_id': meter_id,
                'zero_hours': sum(1 for v in meters_dict[meter_id]["value"] if v == 0),
                'reliability': 100 * (1 - sum(1 for v in meters_dict[meter_id]["value"] if v == 0) / len(meters_dict[meter_id])),
                'total_hours': len(meters_dict[meter_id])
            })
            
            # Try to find consecutive neighbors
            j = i + 1
            while j < len(remaining) and remaining[j] - remaining[j-1] == 1:
                meter_id = remaining[j]
                cluster_data.append({
                    'meter_id': meter_id,
                    'zero_hours': sum(1 for v in meters_dict[meter_id]["value"] if v == 0),
                    'reliability': 100 * (1 - sum(1 for v in meters_dict[meter_id]["value"] if v == 0) / len(meters_dict[meter_id])),
                    'total_hours': len(meters_dict[meter_id])
                })
                j += 1
            
            if len(cluster_data) >= 1:
                clusters[cluster_id] = cluster_data
                cluster_id += 1
            
            i = j if j > i + 1 else i + 1
        
        return clusters


class AdvancedPredictiveAnalyzer:
    """Phase 4: Enhanced predictive modeling with learned patterns"""
    
    @staticmethod
    def build_smart_hourly_risk_model(hourly_patterns: Dict[int, Dict]) -> Dict[int, Dict]:
        """
        Phase 4 logic: Build risk model based on actual historical data,
        not just hardcoded peaks.
        """
        # Find max to normalize
        max_outages = max([p.get('outages', 0) for p in hourly_patterns.values()]) or 1
        
        risk_model = {}
        for hour in range(24):
            patterns = hourly_patterns.get(hour, {})
            outage_count = patterns.get('outages', 0)
            affected_meters = patterns.get('affected_meters', 0)
            avg_duration = patterns.get('avg_duration', 0)
            
            # Calculate risk score 0-10 based on data
            outage_risk = (outage_count / max_outages * 10) if max_outages > 0 else 0
            
            # Risk level classification
            if outage_risk >= 8:
                risk_level = 'CRITICAL'
            elif outage_risk >= 6:
                risk_level = 'HIGH'
            elif outage_risk >= 3:
                risk_level = 'MEDIUM'
            else:
                risk_level = 'LOW'
            
            risk_model[hour] = {
                'risk_score': round(outage_risk, 2),
                'risk_level': risk_level,
                'historical_outages': outage_count,
                'affected_meters': affected_meters,
                'avg_duration': round(avg_duration, 2),
                'max_duration': patterns.get('max_duration', 0)
            }
        
        return risk_model
    
    @staticmethod
    def calculate_mttr_by_hour(hourly_patterns: Dict[int, Dict]) -> Dict[int, Dict]:
        """Mean Time To Restore by hour"""
        mttr_data = {}
        for hour in range(24):
            patterns = hourly_patterns.get(hour, {})
            avg_duration = patterns.get('avg_duration', 0)
            
            mttr_data[hour] = {
                'mttr_hours': round(avg_duration, 2),
                'incident_count': patterns.get('outages', 0),
                'max_duration': patterns.get('max_duration', 0)
            }
        
        return mttr_data


class MLClusteringAnalyzer:
    """Use trained ML model to enhance clustering analysis"""
    
    @staticmethod
    def get_anomaly_scores(meters_dict: Dict[int, pd.DataFrame]) -> Dict[int, np.ndarray]:
        """Get anomaly scores from trained model for each meter"""
        from core.detector import _predict_model, extract_features
        
        anomaly_scores = {}
        
        for meter_id, df in meters_dict.items():
            if df.empty:
                continue
            
            # Get model predictions
            scores = _predict_model(df)
            if scores is not None:
                anomaly_scores[meter_id] = scores
        
        return anomaly_scores
    
    @staticmethod
    def cluster_by_ml_similarity(meters_dict: Dict[int, pd.DataFrame]) -> Dict[int, List[int]]:
        """
        Cluster meters based on ML-derived anomaly patterns.
        Similar anomaly patterns = similar infrastructure issues
        """
        from core.detector import extract_features
        
        print("   [ML] Extracting features for all meters...")
        features_dict = {}
        for meter_id, df in meters_dict.items():
            if not df.empty:
                features = extract_features(df)
                features_dict[meter_id] = features.values
        
        if not features_dict:
            return {}
        
        # Use correlation of feature patterns
        meter_ids = sorted(features_dict.keys())
        graph = defaultdict(set)
        
        print("   [ML] Computing feature similarity...")
        for i, m1 in enumerate(meter_ids):
            for j, m2 in enumerate(meter_ids[i+1:], i+1):
                f1 = features_dict[m1].mean(axis=0)  # Average pattern
                f2 = features_dict[m2].mean(axis=0)
                
                # Cosine similarity
                norm1 = np.linalg.norm(f1)
                norm2 = np.linalg.norm(f2)
                if norm1 > 0 and norm2 > 0:
                    similarity = np.dot(f1, f2) / (norm1 * norm2)
                    
                    # Similar patterns = add edge
                    if similarity > 0.85:
                        graph[m1].add(m2)
                        graph[m2].add(m1)
        
        # Find connected components
        visited = set()
        clusters = {}
        cluster_id = 0
        
        print("   [ML] Building clusters from feature similarity...")
        for meter_id in sorted(meters_dict.keys()):
            if meter_id not in visited:
                queue = [meter_id]
                cluster = []
                
                while queue:
                    current = queue.pop(0)
                    if current in visited:
                        continue
                    
                    visited.add(current)
                    cluster.append(current)
                    
                    for neighbor in graph[current]:
                        if neighbor not in visited:
                            queue.append(neighbor)
                
                if len(cluster) >= 2:
                    clusters[cluster_id] = sorted(cluster)
                    cluster_id += 1
        
        return clusters


class InfrastructureOptimizationV2:
    """Enhanced infrastructure strategy with learned metrics"""
    
    @staticmethod
    def score_clusters(clusters: Dict[int, List[Dict]]) -> List[Dict]:
        """
        Phase 4 logic: Score each cluster for upgrade priority.
        Based on reliability, outage count, and meter count.
        """
        scored = []
        
        for cluster_id, meters in clusters.items():
            avg_zero_hours = np.mean([m['zero_hours'] for m in meters])
            avg_reliability = np.mean([m['reliability'] for m in meters])
            num_meters = len(meters)
            total_zero = sum(m['zero_hours'] for m in meters)
            
            # Priority score: lower reliability + more zero hours = higher priority
            priority_score = (100 - avg_reliability) * total_zero
            
            # Determine priority level
            if avg_reliability < 70:
                priority = 'CRITICAL'
            elif avg_reliability < 85:
                priority = 'HIGH'
            else:
                priority = 'MEDIUM'
            
            scored.append({
                'cluster_id': cluster_id,
                'meter_count': num_meters,
                'avg_reliability': round(avg_reliability, 1),
                'avg_zero_hours': round(avg_zero_hours, 0),
                'total_zero_hours': total_zero,
                'priority': priority,
                'priority_score': priority_score,
                'meters': [m['meter_id'] for m in meters]
            })
        
        return sorted(scored, key=lambda x: -x['priority_score'])
    
    @staticmethod
    def generate_smart_roadmap(scored_clusters: List[Dict]) -> Dict:
        """
        Phase 4 logic: Generate 3-phase roadmap based on actual data priorities.
        Not just hardcoded, but learned from patterns.
        """
        critical = [c for c in scored_clusters if c['priority'] == 'CRITICAL']
        high = [c for c in scored_clusters if c['priority'] == 'HIGH']
        medium = [c for c in scored_clusters if c['priority'] == 'MEDIUM']
        
        phase_1_clusters = critical[:2] if len(critical) >= 2 else critical
        phase_2_clusters = high[:2] if len(high) >= 2 else high + critical[2:4]
        phase_3_clusters = medium + critical[4:] + high[2:]
        
        total_zero_current = sum(c['total_zero_hours'] for c in scored_clusters)
        
        phase_1_reduction = sum(c['total_zero_hours'] for c in phase_1_clusters)
        phase_2_reduction = phase_1_reduction + sum(c['total_zero_hours'] for c in phase_2_clusters)
        phase_3_reduction = phase_2_reduction + sum(c['total_zero_hours'] for c in phase_3_clusters)
        
        return {
            'phase_1': {
                'clusters': [c['cluster_id'] for c in phase_1_clusters],
                'meter_count': sum(c['meter_count'] for c in phase_1_clusters),
                'zero_hours_to_fix': sum(c['total_zero_hours'] for c in phase_1_clusters),
                'expected_improvement_pct': round(phase_1_reduction / total_zero_current * 100, 1) if total_zero_current > 0 else 0,
                'timeline': 'Months 1-3',
                'priority': 'CRITICAL'
            },
            'phase_2': {
                'clusters': [c['cluster_id'] for c in phase_2_clusters],
                'meter_count': sum(c['meter_count'] for c in phase_2_clusters),
                'zero_hours_to_fix': sum(c['total_zero_hours'] for c in phase_2_clusters),
                'expected_improvement_pct': round(phase_2_reduction / total_zero_current * 100, 1) if total_zero_current > 0 else 0,
                'timeline': 'Months 4-6',
                'priority': 'HIGH'
            },
            'phase_3': {
                'clusters': [c['cluster_id'] for c in phase_3_clusters],
                'meter_count': sum(c['meter_count'] for c in phase_3_clusters),
                'zero_hours_to_fix': sum(c['total_zero_hours'] for c in phase_3_clusters),
                'expected_improvement_pct': round(phase_3_reduction / total_zero_current * 100, 1) if total_zero_current > 0 else 0,
                'timeline': 'Months 7-12',
                'priority': 'MEDIUM'
            },
            'summary': {
                'total_clusters': len(scored_clusters),
                'critical_clusters': len(critical),
                'high_clusters': len(high),
                'total_zero_hours_current': total_zero_current,
                'estimated_zero_hours_after_phase3': total_zero_current - phase_3_reduction
            }
        }
