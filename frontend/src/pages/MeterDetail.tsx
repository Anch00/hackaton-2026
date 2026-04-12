import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getMeterDetail } from '../api/client'
import AnomalyBadge from '../components/AnomalyBadge'
import TimelineChart from '../components/TimelineChart'
import type { FolderKey, MeterDetail as MeterDetailType } from '../types'
import { fmtTimestamp } from '../utils/format'

export default function MeterDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const folder = (searchParams.get('folder') ?? 'vsi_podatki') as FolderKey

  const [detail, setDetail] = useState<MeterDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getMeterDetail(Number(id), folder)
      .then(setDetail)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Napaka.'))
      .finally(() => setLoading(false))
  }, [id, folder])

  if (loading)
    return (
      <div className="text-center py-20 text-gray-500 animate-pulse">
        Nalagam merilnik {id}...
      </div>
    )

  if (error)
    return (
      <div className="card border-red-800 text-red-400 text-sm">
        {error}
        <button className="ml-4 text-gray-400 underline" onClick={() => navigate(-1)}>Nazaj</button>
      </div>
    )

  if (!detail) return null

  const anomalyPct = detail.total_readings
    ? ((detail.anomaly_count / detail.total_readings) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button className="btn-secondary text-sm" onClick={() => navigate(-1)}>← Nazaj</button>
        <h1 className="text-2xl font-bold text-white">Merilnik #{id}</h1>
        <a
          href={`/api/export/csv?folder=${folder}`}
          className="btn-secondary text-sm ml-auto"
          download
        >
          ⬇ Izvozi CSV
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Skupaj meritev', value: detail.total_readings },
          { label: 'Anomalij', value: `${detail.anomaly_count} (${anomalyPct}%)` },
          { label: 'Povprečna vrednost', value: `${detail.value_avg.toFixed(2)} W` },
          { label: 'Std. odklon', value: `${detail.value_std.toFixed(2)} W` },
        ].map((s) => (
          <div key={s.label} className="card">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="text-xl font-bold text-white mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-400 mb-3">Časovni potek meritev</h2>
        <TimelineChart readings={detail.readings} height={360} />
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Normalna vrednost
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> Anomalija
          </span>
        </div>
      </div>

      {/* Anomaly blocks */}
      {detail.anomaly_blocks.length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-300 mb-3">
            Bloki anomalij ({detail.anomaly_blocks.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-gray-400">Začetek</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-400">Konec</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-400">Trajanje (h)</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-400">Tip</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-400">Resnost</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-400">Povp. vrednost</th>
                  <th className="text-left px-3 py-2 text-xs text-gray-400">Normalna povp.</th>
                </tr>
              </thead>
              <tbody>
                {detail.anomaly_blocks.map((b, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{fmtTimestamp(b.start)}</td>
                    <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{fmtTimestamp(b.end)}</td>
                    <td className="px-3 py-2 text-gray-300">{b.duration_h}</td>
                    <td className="px-3 py-2"><AnomalyBadge type={b.type} /></td>
                    <td className="px-3 py-2">
                      <span className={`badge ${b.severity === 'HIGH' ? 'bg-red-900 text-red-300' :
                          b.severity === 'MEDIUM' ? 'bg-yellow-900 text-yellow-300' :
                            'bg-blue-900 text-blue-300'
                        }`}>{b.severity}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-400">{b.avg_value.toFixed(2)}</td>
                    <td className="px-3 py-2 text-gray-400">{b.normal_avg.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detail.anomaly_blocks.length === 0 && (
        <div className="card text-center py-8 text-green-400">
          ✓ Ni zaznaih anomalij pri tem merilniku.
        </div>
      )}
    </div>
  )
}
