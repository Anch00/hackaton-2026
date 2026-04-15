"""
GridSense — core/analytics.py
Unified System Integration Layer
Orchestrates all analytics components into cohesive insights
"""

from collections import defaultdict
from typing import Dict, List, Tuple, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Import unified analytics engine
from core.advanced_analytics import (
    AdvancedFrozenSignalDetector,
    RootCauseClassifier,
    TemporalPatternAnalyzer,
    SpatialCorrelationAnalyzer,
    AdvancedPredictiveAnalyzer,
    InfrastructureOptimizationV2
)


class EventReconstructor:
    """Reconstruct network events from individual meter outages
    Includes root cause classification and impact analysis"""
    
    @staticmethod
    def detect_outages(df: pd.DataFrame) -> List[Dict]:
        """
        Detect anomaly blocks using the full 4-method detection pipeline
        (z-score, rolling variance, zero-flag, Isolation Forest) and the
        classifier that distinguishes DALJSI_IZPAD, ZAMRZNJEN_SIGNAL, DRIFT, etc.

        Falls back to zero-only scanning if the detector import fails so the
        rest of the system keeps working in minimal environments.
        """
        if df.empty:
            return []

        try:
            from core.detector import detect_anomalies
            from core.classifier import extract_blocks

            df_detected = detect_anomalies(df)
            blocks = extract_blocks(df_detected)

            outages = []
            for block in blocks:
                outages.append({
                    'start_ts': block.start,
                    'end_ts': block.end,
                    'duration_hours': block.duration_h,
                    'root_cause': block.anomaly_type,
                    'cause_reason': f"{block.anomaly_type} | severity={block.severity}",
                })
            return outages

        except Exception:
            # Fallback: zero-only scan with duration-based classification
            values = df["value"].values
            outages = []
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
                        root_cause_type, root_cause_reason = RootCauseClassifier.classify_by_duration(duration)
                        outages.append({
                            'start_ts': df.iloc[block_start]['timestamp'],
                            'end_ts': df.iloc[i - 1]['timestamp'],
                            'duration_hours': duration,
                            'root_cause': root_cause_type,
                            'cause_reason': root_cause_reason,
                        })
                        in_block = False

            if in_block:
                duration = len(values) - block_start
                root_cause_type, root_cause_reason = RootCauseClassifier.classify_by_duration(duration)
                outages.append({
                    'start_ts': df.iloc[block_start]['timestamp'],
                    'end_ts': df.iloc[-1]['timestamp'],
                    'duration_hours': duration,
                    'root_cause': root_cause_type,
                    'cause_reason': root_cause_reason,
                })

            return outages
    
    @staticmethod
    def reconstruct_events(meters_dict: Dict[int, pd.DataFrame]) -> List[Dict]:
        """
        Reconstruct network events from individual meter outages.
        Groups simultaneous outages into single events with root cause analysis.
        """
        # Collect all outages keyed by hour
        hourly_events = defaultdict(lambda: {'meters': [], 'durations': [], 'root_causes': []})
        
        for meter_id, df in meters_dict.items():
            outages = EventReconstructor.detect_outages(df)
            for outage in outages:
                ts = outage['start_ts']
                hour_key = ts.strftime('%Y-%m-%d %H:00') if hasattr(ts, 'strftime') else str(ts)[:13]
                hourly_events[hour_key]['meters'].append(meter_id)
                hourly_events[hour_key]['durations'].append(outage['duration_hours'])
                hourly_events[hour_key]['root_causes'].append(outage['root_cause'])
        
        # Convert to event list
        events = []
        for hour_key, data in sorted(hourly_events.items()):
            unique_meters = list(set(data['meters']))
            avg_duration = np.mean(data['durations'])
            
            # Determine most common root cause
            root_cause_counts = defaultdict(int)
            for cause in data['root_causes']:
                root_cause_counts[cause] += 1
            most_common_cause = max(root_cause_counts, key=root_cause_counts.get) if root_cause_counts else 'UNKNOWN'
            
            events.append({
                'timestamp': hour_key,
                'affected_meters': unique_meters,
                'affected_count': len(unique_meters),
                'avg_duration_hours': round(avg_duration, 2),
                'total_impact': len(unique_meters) * avg_duration,
                'severity': EventReconstructor._classify_severity(len(unique_meters), avg_duration),
                'root_cause': most_common_cause
            })
        
        sorted_events = sorted(events, key=lambda x: x['total_impact'], reverse=True)
        return sorted_events
    
    @staticmethod
    def _classify_severity(meter_count: int, duration_hours: float) -> str:
        """Classify event severity by affected meters and duration"""
        impact_score = meter_count * duration_hours
        if impact_score > 500:
            return 'CRITICAL'
        elif impact_score > 100:
            return 'HIGH'
        else:
            return 'MEDIUM'


class GeographicAnalyzer:
    """Analyze geographic patterns and meter clustering
    Identifies which infrastructure sections fail together"""
    
    @staticmethod
    def find_correlated_meters(meters_dict: Dict[int, pd.DataFrame]) -> Dict[str, List[int]]:
        """
        Detect geographic clusters using correlation-based graph clustering.
        Finds meters that fail together (same infrastructure).
        Uses advanced algorithm, not just consecutive grouping.
        """
        # Use correlation-based clustering from SpatialCorrelationAnalyzer
        clusters = SpatialCorrelationAnalyzer.cluster_meters_by_correlation(meters_dict)
        
        # Convert to string keys for backwards compatibility
        return {f'C{cid}': meter_list for cid, meter_list in clusters.items()}
    
    @staticmethod
    def calculate_cluster_health(cluster: List[int], meters_dict: Dict[int, pd.DataFrame]) -> Dict:
        """Calculate health metrics for a geographic cluster"""
        total_zero_hours = 0
        total_hours = 0
        outage_counts = 0
        critical_meters = 0
        
        for meter_id in cluster:
            if meter_id in meters_dict:
                df = meters_dict[meter_id]
                
                # Analyze meter health
                health = RootCauseClassifier.analyze_meter_health(df, meter_id)
                
                zero_hours = health['zero_hours']
                total_zero_hours += zero_hours
                total_hours += health['total_hours']
                
                if health['status'] in ['CRITICAL', 'FAILED']:
                    critical_meters += 1
                
                outage_counts += len(EventReconstructor.detect_outages(df))
        
        total_hours = max(total_hours, 1)  # Avoid division by zero
        reliability = 100 * (1 - total_zero_hours / total_hours)
        
        return {
            'meter_count': len(cluster),
            'total_zero_hours': total_zero_hours,
            'reliability_pct': round(reliability, 1),
            'outage_events': outage_counts,
            'critical_meters_in_cluster': critical_meters,
            'priority': GeographicAnalyzer._get_priority(reliability, outage_counts)
        }
    
    @staticmethod
    def _get_priority(reliability: float, outage_count: int) -> str:
        """Determine upgrade priority"""
        if reliability < 70 or outage_count > 50:
            return 'CRITICAL'
        elif reliability < 85 or outage_count > 20:
            return 'HIGH'
        else:
            return 'MEDIUM'


class PredictiveAnalyzer:
    """Predictive modeling by hour-of-day and MTTR calculation (Phase 4)"""
    
    @staticmethod
    def build_hourly_risk_model(meters_dict: Dict[int, pd.DataFrame]) -> Dict[int, Dict]:
        """
        Build predictive model: outage risk by hour-of-day.
        Returns risk score (0-10) for each hour.
        """
        hourly_stats = defaultdict(lambda: {'outages': 0, 'affected_meters': set(), 'durations': []})
        
        for meter_id, df in meters_dict.items():
            if df.empty:
                continue
            
            outages = EventReconstructor.detect_outages(df)
            for outage in outages:
                ts = outage['start_ts']
                hour = ts.hour if hasattr(ts, 'hour') else int(str(ts).split()[1].split(':')[0])
                hourly_stats[hour]['outages'] += 1
                hourly_stats[hour]['affected_meters'].add(meter_id)
                hourly_stats[hour]['durations'].append(outage['duration_hours'])
        
        # Normalize to 0-10 scale
        max_outages = max([s['outages'] for s in hourly_stats.values()]) if hourly_stats else 1
        
        risk_model = {}
        for hour in range(24):
            stats = hourly_stats[hour]
            outage_count = stats['outages']
            risk_score = (outage_count / max_outages * 10) if max_outages > 0 else 0
            
            risk_model[hour] = {
                'risk_score': round(risk_score, 2),
                'historical_outages': outage_count,
                'affected_meters': len(stats['affected_meters']),
                'avg_duration': round(np.mean(stats['durations']), 2) if stats['durations'] else 0,
                'risk_level': PredictiveAnalyzer._risk_level(risk_score)
            }
        
        return risk_model
    
    @staticmethod
    def calculate_mttr(meters_dict: Dict[int, pd.DataFrame]) -> Dict[int, Dict]:
        """
        Calculate Mean Time To Restore (MTTR) by hour.
        Shows average restoration time when outages occur in each hour.
        """
        hourly_mttr = defaultdict(lambda: {'durations': [], 'count': 0})
        
        for meter_id, df in meters_dict.items():
            if df.empty:
                continue
            
            outages = EventReconstructor.detect_outages(df)
            for outage in outages:
                ts = outage['start_ts']
                hour = ts.hour if hasattr(ts, 'hour') else int(str(ts).split()[1].split(':')[0])
                hourly_mttr[hour]['durations'].append(outage['duration_hours'])
                hourly_mttr[hour]['count'] += 1
        
        mttr_result = {}
        for hour in range(24):
            data = hourly_mttr[hour]
            mttr_result[hour] = {
                'mttr_hours': round(np.mean(data['durations']), 2) if data['durations'] else 0,
                'incident_count': data['count'],
                'max_duration': max(data['durations']) if data['durations'] else 0,
                'min_duration': min(data['durations']) if data['durations'] else 0
            }
        
        return mttr_result
    
    @staticmethod
    def _risk_level(score: float) -> str:
        """Convert risk score to level"""
        if score >= 8:
            return 'CRITICAL'
        elif score >= 6:
            return 'HIGH'
        elif score >= 3:
            return 'MEDIUM'
        else:
            return 'LOW'


class InfrastructureOptimizer:
    """Infrastructure optimization roadmap (Phase 4)"""
    
    @staticmethod
    def generate_upgrade_roadmap(
        clusters: Dict[str, List[int]],
        meters_dict: Dict[int, pd.DataFrame]
    ) -> Dict:
        """
        Generate 3-phase infrastructure upgrade roadmap.
        Prioritizes clusters by reliability and outage frequency.
        """
        cluster_health = {}
        for cluster_id, meter_ids in clusters.items():
            health = GeographicAnalyzer.calculate_cluster_health(meter_ids, meters_dict)
            cluster_health[cluster_id] = health
        
        # Sort by priority (CRITICAL first, then by lowest reliability within each tier)
        priority_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2}
        sorted_clusters = sorted(
            cluster_health.items(),
            key=lambda x: (priority_order.get(x[1]['priority'], 3), x[1]['reliability_pct']),
        )

        # Group into phases
        phase1 = sorted_clusters[0:2]   # Top 2
        phase2 = sorted_clusters[2:4]   # Next 2
        phase3 = sorted_clusters[4:8]   # Next 4

        # --- Compute SAIDI figures from actual data, not hardcoded constants ---
        total_meters = max(sum(h[1]['meter_count'] for h in sorted_clusters), 1)
        total_zero_hours = sum(h[1]['total_zero_hours'] for h in sorted_clusters)

        def _phase_zero(phase_clusters):
            return sum(c[1]['total_zero_hours'] for c in phase_clusters)

        p1_zero = _phase_zero(phase1)
        p2_zero = _phase_zero(phase2)
        p3_zero = _phase_zero(phase3)

        # Cumulative SAIDI hours saved after each phase (zero_hours / total_meters)
        saidi_after_p1 = round(p1_zero / total_meters, 1)
        saidi_after_p2 = round((p1_zero + p2_zero) / total_meters, 1)
        saidi_after_p3 = round((p1_zero + p2_zero + p3_zero) / total_meters, 1)

        # Improvement % relative to total zero hours across all clusters
        def _improvement_pct(zero_h):
            return round(zero_h / total_zero_hours * 100, 1) if total_zero_hours > 0 else 0

        remaining_after_p3 = max(0, total_zero_hours - p1_zero - p2_zero - p3_zero)

        return {
            'phase_1': {
                'clusters': [c[0] for c in phase1],
                'meters_count': sum(c[1]['meter_count'] for c in phase1),
                'expected_improvement_pct': _improvement_pct(p1_zero),
                'saidi_reduction': saidi_after_p1,
                'timeline': 'Months 1-3',
                'priority': 'CRITICAL'
            },
            'phase_2': {
                'clusters': [c[0] for c in phase2],
                'meters_count': sum(c[1]['meter_count'] for c in phase2),
                'expected_improvement_pct': _improvement_pct(p1_zero + p2_zero),
                'saidi_reduction': saidi_after_p2,
                'timeline': 'Months 4-6',
                'priority': 'HIGH'
            },
            'phase_3': {
                'clusters': [c[0] for c in phase3],
                'meters_count': sum(c[1]['meter_count'] for c in phase3),
                'expected_improvement_pct': _improvement_pct(p1_zero + p2_zero + p3_zero),
                'saidi_reduction': saidi_after_p3,
                'timeline': 'Months 7-12',
                'priority': 'MEDIUM'
            },
            'summary': {
                'total_clusters': len(sorted_clusters),
                'critical_clusters': sum(1 for _, h in sorted_clusters if h['priority'] == 'CRITICAL'),
                'total_zero_hours_current': total_zero_hours,
                'estimated_zero_hours_after_phase3': round(remaining_after_p3, 0),
                'network_reliability_score': 'CRITICAL' if total_zero_hours > 10000 else 'POOR'
            }
        }