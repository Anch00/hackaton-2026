import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMeters } from '../api/client'
import AnomalyBadge from '../components/AnomalyBadge'
import type { FolderKey, MeterStatus, MeterSummary } from '../types'
import { ANOMALY_LABELS, STATUS_COLORS, STATUS_LABELS } from '../types'

export default function Meters() {
  const navigate = useNavigate()
  const [folder, setFolder] = useState<FolderKey>('vsi_podatki')
  const [meters, setMeters] = useState<MeterSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'ALL' | MeterStatus>('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMeters(folder)
      setMeters(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Napaka.')
    } finally {
      setLoading(false)
    }
  }, [folder])

  useEffect(() => { load() }, [load])

  const allTypes = ['ALL', ...Array.from(new Set(meters.flatMap((m) => m.anomaly_types)))]

  const filtered = meters
    .filter((m) => filterStatus === 'ALL' || m.status === filterStatus)
    .filter((m) => filterType === 'ALL' || m.anomaly_types.includes(filterType as any))
    .filter((m) => search === '' || String(m.meter_id).includes(search) || m.filename.includes(search))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Merilniki</h1>
        <div className="flex items-center gap-2">
          <select
            className="bg-gray-800 text-sm text-gray-200 rounded px-3 py-2 border border-gray-700"
            value={folder}
            onChange={(e) => setFolder(e.target.value as FolderKey)}
          >
            <option value="vsi_podatki">Vsi podatki</option>
            <option value="ovrednoteni">Ovrednoteni</option>
            <option value="uploads">Naloženi</option>
          </select>
          <button className="btn-primary text-sm" onClick={load} disabled={loading}>
            {loading ? '⏳' : '🔄 Osveži'}
          </button>
        </div>
      </div>

      {error && <div className="card border-red-800 text-red-400 text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Išči po ID / imenu..."
          className="bg-gray-800 text-sm text-gray-200 rounded px-3 py-1.5 border border-gray-700 w-48"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="bg-gray-800 text-sm text-gray-200 rounded px-2 py-1.5 border border-gray-700"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="ALL">Vsi statusi</option>
          <option value="critical">Kritični</option>
          <option value="anomaly">Anomalija</option>
          <option value="normal">Normalni</option>
        </select>
        <select
          className="bg-gray-800 text-sm text-gray-200 rounded px-2 py-1.5 border border-gray-700"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          {allTypes.map((t) => (
            <option key={t} value={t}>{t === 'ALL' ? 'Vsi tipi' : (ANOMALY_LABELS[t] ?? t)}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{filtered.length} merilnikov</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-gray-400">ID</th>
                <th className="text-left px-3 py-2 text-xs text-gray-400">Datoteka</th>
                <th className="text-left px-3 py-2 text-xs text-gray-400">Meritev</th>
                <th className="text-left px-3 py-2 text-xs text-gray-400">Anomalije</th>
                <th className="text-left px-3 py-2 text-xs text-gray-400">%</th>
                <th className="text-left px-3 py-2 text-xs text-gray-400">Tipi</th>
                <th className="text-left px-3 py-2 text-xs text-gray-400">Povp.</th>
                <th className="text-left px-3 py-2 text-xs text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr
                  key={m.meter_id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer"
                  onClick={() => navigate(`/meters/${m.meter_id}?folder=${folder}`)}
                >
                  <td className="px-3 py-2 font-mono text-blue-400">{m.meter_id}</td>
                  <td className="px-3 py-2 text-gray-400">{m.filename}</td>
                  <td className="px-3 py-2 text-gray-300">{m.total_readings}</td>
                  <td className="px-3 py-2 text-gray-300">{m.anomaly_count}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min(m.anomaly_pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-400 text-xs">{m.anomaly_pct}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {m.anomaly_types.slice(0, 2).map((t) => <AnomalyBadge key={t} type={t} />)}
                      {m.anomaly_types.length > 2 && (
                        <span className="text-gray-600 text-xs">+{m.anomaly_types.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-400">{m.value_avg.toFixed(1)}</td>
                  <td className="px-3 py-2">
                    <span className={`badge ${STATUS_COLORS[m.status]}`}>
                      {STATUS_LABELS[m.status]}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-gray-600">
                    Ni merilnikov za prikaz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
