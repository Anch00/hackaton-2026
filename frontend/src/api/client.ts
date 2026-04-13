import axios from 'axios'
import type {
  AnalysisResult,
  Event,
  FolderKey,
  GridMetricsResponse,
  MeterDetail,
  MeterSummary,
  UploadResponse,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 120_000, // 2 min for heavy analysis
})

// ── Upload ────────────────────────────────────────────────────────────────

export async function uploadFiles(files: File[]): Promise<UploadResponse> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const { data } = await api.post<UploadResponse>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// ── Analyze ───────────────────────────────────────────────────────────────

export async function analyzeFolder(folder: FolderKey): Promise<AnalysisResult> {
  const { data } = await api.post<AnalysisResult>('/analyze', null, {
    params: { folder },
  })
  return data
}

// ── Meters ────────────────────────────────────────────────────────────────

export async function getMeters(folder: FolderKey = 'vsi_podatki'): Promise<MeterSummary[]> {
  const { data } = await api.get<MeterSummary[]>('/meters', { params: { folder } })
  return data
}

export async function getMeterDetail(
  meterId: number,
  folder: FolderKey = 'vsi_podatki'
): Promise<MeterDetail> {
  const { data } = await api.get<MeterDetail>(`/meters/${meterId}`, { params: { folder } })
  return data
}

// ── Events ────────────────────────────────────────────────────────────────

export async function getEvents(folder: FolderKey = 'vsi_podatki'): Promise<Event[]> {
  const { data } = await api.get<Event[]>('/events', { params: { folder } })
  return data
}

// ── Metrics ───────────────────────────────────────────────────────────────

export async function getMetrics(folder: FolderKey = 'vsi_podatki'): Promise<GridMetricsResponse> {
  const { data } = await api.get<GridMetricsResponse>('/metrics', { params: { folder } })
  return data
}

// ── Export ────────────────────────────────────────────────────────────────

export function exportCsvUrl(folder: FolderKey = 'vsi_podatki') {
  return `/api/export/csv?folder=${folder}`
}

export function exportJsonUrl(folder: FolderKey = 'vsi_podatki') {
  return `/api/export/json?folder=${folder}`
}

// ── Advanced Analytics (Phase 3 & 4) ──────────────────────────────────────

export async function getAnalytics(folder: FolderKey = 'vsi_podatki'): Promise<any> {
  const { data } = await api.get(`/analytics/summary`, { params: { folder } })
  return data
}

export async function getReconstructedEvents(folder: FolderKey = 'vsi_podatki'): Promise<any> {
  const { data } = await api.get(`/analytics/events`, { params: { folder } })
  return data
}

export async function getGeographicClusters(folder: FolderKey = 'vsi_podatki'): Promise<any> {
  const { data } = await api.get(`/analytics/clustering`, { params: { folder } })
  return data
}

export async function getHourlyRisk(folder: FolderKey = 'vsi_podatki'): Promise<any> {
  const { data } = await api.get(`/analytics/predictive/hourly-risk`, { params: { folder } })
  return data
}

export async function getMTTR(folder: FolderKey = 'vsi_podatki'): Promise<any> {
  const { data } = await api.get(`/analytics/predictive/mttr`, { params: { folder } })
  return data
}

export async function getInfrastructureRoadmap(folder: FolderKey = 'vsi_podatki'): Promise<any> {
  const { data } = await api.get(`/analytics/infrastructure-roadmap`, { params: { folder } })
  return data
}
