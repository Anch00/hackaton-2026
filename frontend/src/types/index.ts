// GridSense — TypeScript types

export type AnomalyType =
  | 'ZAMRZNJEN_SIGNAL'
  | 'IZOLIRAN_IZPAD'
  | 'DALJSI_IZPAD'
  | 'IZOLIRANI_SPIKE'
  | 'NEGATIVNA_VREDNOST'
  | 'DRIFT'
  | 'DELNI_IZPAD'
  | 'NEZNANA_ANOMALIJA'
  | 'SISTEMSKI_IZPAD'
  | 'IZVEN_NORMALNEGA_PASU'

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type MeterStatus = 'normal' | 'anomaly' | 'critical'
export type FolderKey = 'uploads' | 'ovrednoteni' | 'vsi_podatki'

export interface MeterSummary {
  meter_id: number
  filename: string
  total_readings: number
  anomaly_count: number
  anomaly_pct: number
  anomaly_types: AnomalyType[]
  value_avg: number
  value_std: number
  status: MeterStatus
}

export interface AnomalyBlock {
  start: string
  end: string
  duration_h: number
  type: AnomalyType
  severity: SeverityLevel
  avg_value: number
  normal_avg: number
}

export interface MeterReading {
  timestamp: string
  value: number
  anomaly: boolean
  anomaly_type?: AnomalyType | null
}

export interface MeterDetail {
  meter_id: number
  readings: MeterReading[]
  anomaly_blocks: AnomalyBlock[]
  total_readings: number
  anomaly_count: number
  value_avg: number
  value_std: number
}

export interface Event {
  event_id: number
  start: string
  end: string
  duration_h: number
  affected_meters: number[]
  affected_count: number
  type: AnomalyType
  severity: SeverityLevel
  is_grid_outage: boolean
  avg_value: number
  normal_avg: number
}

export interface SystematicEvent {
  start: string
  end: string
  duration_h: number
  affected_meters: number[]
  affected_count: number
  type: string
  label: string
}

export interface AnalysisResult {
  meters: MeterSummary[]
  events: Event[]
  saidi: number
  saifi: number
  total_meters: number
  meters_with_anomalies: number
  anomaly_type_breakdown: Partial<Record<AnomalyType, number>>
  systematic_events: SystematicEvent[]
  grid_outages: number
  total_anomaly_hours: number
  total_events: number
}

export interface GridMetricsResponse {
  saidi: number
  saifi: number
  total_meters: number
  total_anomaly_hours: number
  total_events: number
  grid_outages: number
  meters_with_anomalies: number
  anomaly_type_breakdown: Partial<Record<AnomalyType, number>>
  systematic_events: SystematicEvent[]
}

export interface UploadResponse {
  uploaded: string[]
  count: number
}

// ── Display helpers ────────────────────────────────────────────────────────

export const ANOMALY_COLORS: Record<string, string> = {
  ZAMRZNJEN_SIGNAL: '#ef4444',
  DALJSI_IZPAD: '#f97316',
  IZOLIRAN_IZPAD: '#eab308',
  DELNI_IZPAD: '#f59e0b',
  IZOLIRANI_SPIKE: '#8b5cf6',
  NEGATIVNA_VREDNOST: '#ec4899',
  DRIFT: '#06b6d4',
  NEZNANA_ANOMALIJA: '#6b7280',
  SISTEMSKI_IZPAD: '#dc2626',
  IZVEN_NORMALNEGA_PASU: '#14b8a6',
}

export const ANOMALY_LABELS: Record<string, string> = {
  ZAMRZNJEN_SIGNAL: 'Zamrznjen signal',
  DALJSI_IZPAD: 'Daljši izpad',
  IZOLIRAN_IZPAD: 'Izoliran izpad',
  DELNI_IZPAD: 'Delni izpad',
  IZOLIRANI_SPIKE: 'Izolirani spike',
  NEGATIVNA_VREDNOST: 'Negativna vrednost',
  DRIFT: 'Drift',
  NEZNANA_ANOMALIJA: 'Neznana anomalija',
  SISTEMSKI_IZPAD: 'Sistemski izpad',
  IZVEN_NORMALNEGA_PASU: 'Izven pasu',
}

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  HIGH: 'bg-red-900 text-red-300',
  MEDIUM: 'bg-yellow-900 text-yellow-300',
  LOW: 'bg-blue-900 text-blue-300',
}

export const STATUS_COLORS: Record<MeterStatus, string> = {
  critical: 'bg-red-900 text-red-300',
  anomaly: 'bg-yellow-900 text-yellow-300',
  normal: 'bg-green-900 text-green-300',
}

export const STATUS_LABELS: Record<MeterStatus, string> = {
  critical: 'Kritično',
  anomaly: 'Anomalija',
  normal: 'Normalno',
}
