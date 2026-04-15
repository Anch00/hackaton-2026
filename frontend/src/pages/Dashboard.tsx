import { useCallback, useEffect, useState } from 'react'
import { analyzeFolder } from '../api/client'
import AnomalyPieChart from '../components/AnomalyPieChart'
import FileUpload from '../components/FileUpload'
import HeatmapChart from '../components/HeatmapChart'
import KpiCard from '../components/KpiCard'
import { useAnalysis } from '../context/AnalysisContext'
import type { AnalysisResult, FolderKey } from '../types'

const FOLDER_OPTIONS: { key: FolderKey; label: string; icon: string; description: string }[] = [
  { key: 'vsi_podatki', label: 'Vsi podatki', icon: '📁', description: 'Celoten nabor merilnikov' },
  { key: 'ovrednoteni', label: 'Ovrednoteni', icon: '✓', description: 'Označeni testni podatki' },
  { key: 'uploads', label: 'Naloženi', icon: '⬆', description: 'Tvoje naložene datoteke' },
]

export default function Dashboard() {
  const {
    currentFolder,
    setCurrentFolder,
    getResult,
    setResult,
    preloadAllData,
    clearAllData,
  } = useAnalysis()

  const [folder, setFolderState] = useState<FolderKey>(currentFolder)
  const [result, setLocalResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  // Sync folder with context
  useEffect(() => {
    setFolderState(currentFolder)
  }, [currentFolder])

  // Load result from context on mount
  useEffect(() => {
    const cachedResult = getResult(currentFolder)
    if (cachedResult) {
      setLocalResult(cachedResult)
    }
  }, [currentFolder, getResult])

  const setFolder = useCallback((newFolder: FolderKey) => {
    setFolderState(newFolder)
    setCurrentFolder(newFolder)
    const cached = getResult(newFolder)
    setLocalResult(cached)
    if (!cached) {
      setError(null)
      setProgress(0)
    }
  }, [setCurrentFolder, getResult])

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    setProgress(0)

    // Simuliraj progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 1000)

    try {
      const data = await analyzeFolder(folder)
      setLocalResult(data)
      setResult(folder, data)
      setProgress(100)
      // Preload all other data for this folder in background
      preloadAllData(folder)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Napaka pri analizi.'
      setError(msg)
    } finally {
      clearInterval(progressInterval)
      setLoading(false)
    }
  }, [folder, setResult, preloadAllData])

  const handleClearAll = useCallback(() => {
    clearAllData()
    setLocalResult(null)
    setError(null)
    setProgress(0)
  }, [clearAllData])

  const currentOption = FOLDER_OPTIONS.find(o => o.key === folder)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">GridSense Dashboard</h1>
          <p className="text-sm text-gray-500">Analiza pametnih merilnikov — Elektro Maribor Hackathon</p>
        </div>
      </div>

      {/* Data Source Selection */}
      <div className="card">
        <h2 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wide">Izberi vir podatkov</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FOLDER_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setFolder(option.key)}
              className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${folder === option.key
                ? 'border-blue-500 bg-blue-900/20 shadow-lg shadow-blue-900/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
                }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{option.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold ${folder === option.key ? 'text-blue-400' : 'text-gray-200'}`}>
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{option.description}</div>
                </div>
                {folder === option.key && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500"></div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Upload Section - only for uploads */}
      {folder === 'uploads' && (
        <FileUpload onUploaded={() => setFolder('uploads')} />
      )}

      {/* Analysis Button - only for vsi_podatki and ovrednoteni */}
      {(folder === 'vsi_podatki' || folder === 'ovrednoteni') && !result && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-200">
                {currentOption?.icon} {currentOption?.label}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Analiza {folder === 'vsi_podatki' ? 'vseh 200' : 'označenih'} merilnikov (~15-30 sekund)
              </p>
            </div>
            <button
              className="btn-primary min-w-[160px]"
              onClick={runAnalysis}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  <span>Analiziram...</span>
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>⚡</span>
                  <span>Začni analizo</span>
                </span>
              )}
            </button>
          </div>

          {/* Loading Bar */}
          {loading && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Obdelava merilnikov...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Zaznavam anomalije, računam SAIDI/SAIFI, iščem sistemske izpade...
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="card border-red-800 bg-red-950/40 text-red-400 text-sm">{error}</div>
      )}

      {/* Results Header */}
      {result && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-200">
            {currentOption?.icon} Rezultati analize: {currentOption?.label}
          </h2>
          <button
            onClick={handleClearAll}
            className="btn-secondary text-sm"
          >
            🔄 Nova analiza
          </button>
        </div>
      )}

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

            <a href={`/api/export/submission?folder=${folder}`}
              className="btn-secondary text-sm"
              download
            >
              ⬇ Izvozi submission CSV
            </a>
          </div>
        </>
      )}

      {/* Empty state for uploads without analysis yet */}
      {folder === 'uploads' && !result && (
        <div className="card text-center py-12 text-gray-600">
          <div className="text-4xl mb-3">⬆</div>
          <p className="text-base">Naloži CSV ali ZIP datoteke za analizo</p>
          <p className="text-sm mt-2 text-gray-500">Po uspešnem nalaganju se bo prikazal gumb za analizo</p>
        </div>
      )}
    </div>
  )
}
