import { useCallback, useState } from 'react'
import { analyzeFolder } from '../api/client'
import AnomalyPieChart from '../components/AnomalyPieChart'
import FileUpload from '../components/FileUpload'
import HeatmapChart from '../components/HeatmapChart'
import KpiCard from '../components/KpiCard'
import type { AnalysisResult, FolderKey } from '../types'

export default function Dashboard() {
  const [folder, setFolder] = useState<FolderKey>('vsi_podatki')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await analyzeFolder(folder)
      setResult(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Napaka pri analizi.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [folder])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">GridSense Dashboard</h1>
          <p className="text-sm text-gray-500">Analiza pametnih merilnikov — Elektro Maribor Hackathon</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="bg-gray-800 text-sm text-gray-200 rounded px-3 py-2 border border-gray-700"
            value={folder}
            onChange={(e) => setFolder(e.target.value as FolderKey)}
          >
            <option value="vsi_podatki">Vsi podatki</option>
            <option value="ovrednoteni">Ovrednoteni</option>
            <option value="uploads">Naloženi</option>
          </select>
          <button
            className="btn-primary"
            onClick={runAnalysis}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span> Analiziram...
              </span>
            ) : (
              '⚡ Zaženi analizo'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="card border-red-800 bg-red-950/40 text-red-400 text-sm">{error}</div>
      )}

      {/* Upload section */}
      <FileUpload onUploaded={() => setFolder('uploads')} />

      {/* KPI Cards */}
      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="SAIDI"
              value={result.saidi.toFixed(2)}
              subtitle="Povp. trajanje prekinitev (h/uporabnik)"
              icon="⏱"
              color="text-blue-400"
            />
            <KpiCard
              title="SAIFI"
              value={result.saifi.toFixed(2)}
              subtitle="Povp. število prekinitev / uporabnik"
              icon="🔁"
              color="text-purple-400"
            />
            <KpiCard
              title="Anomalni merilniki"
              value={`${result.meters_with_anomalies} / ${result.total_meters}`}
              subtitle="Merilniki z vsaj eno anomalijo"
              icon="📟"
              color="text-yellow-400"
            />
            <KpiCard
              title="Skupaj ur motenj"
              value={result.total_anomaly_hours.toLocaleString()}
              subtitle={`${result.total_events} zaznanih dogodkov`}
              icon="⚠️"
              color="text-red-400"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HeatmapChart meters={result.meters} />
            <AnomalyPieChart breakdown={result.anomaly_type_breakdown} />
          </div>

          {/* Systematic events */}
          {result.systematic_events.length > 0 && (
            <div className="card border-red-800/50">
              <h2 className="text-base font-semibold text-red-400 mb-3">
                🔴 Sistemski izpadi ({result.systematic_events.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-800">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-gray-400">Začetek</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-400">Konec</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-400">Trajanje (h)</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-400">Prizadeti merilniki</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-400">Tip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.systematic_events.map((ev, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-3 py-2 text-gray-300">{ev.start.replace('T', ' ').slice(0, 16)}</td>
                        <td className="px-3 py-2 text-gray-300">{ev.end.replace('T', ' ').slice(0, 16)}</td>
                        <td className="px-3 py-2 text-gray-300">{ev.duration_h}</td>
                        <td className="px-3 py-2 text-gray-400">{ev.affected_count}</td>
                        <td className="px-3 py-2">
                          <span className="badge bg-red-900/60 text-red-300">{ev.label}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Export buttons */}
          <div className="flex gap-3">
            <a
              href={`/api/export/csv?folder=${folder}`}
              className="btn-secondary text-sm"
              download
            >
              ⬇ Izvozi CSV
            </a>
            <a
              href={`/api/export/json?folder=${folder}`}
              className="btn-secondary text-sm"
              download
            >
              ⬇ Izvozi JSON
            </a>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="card text-center py-16 text-gray-600">
          <div className="text-5xl mb-4">⚡</div>
          <p className="text-lg">Klikni "Zaženi analizo" za začetek.</p>
          <p className="text-sm mt-2">Analiza 200 merilnikov traja ~15–30 sekund.</p>
        </div>
      )}
    </div>
  )
}
