import { useEffect, useState } from 'react'
import {
  CartesianGrid, Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis, YAxis,
} from 'recharts'
import { getMeterDetail, getMeters } from '../api/client'
import type { FolderKey, MeterDetail, MeterSummary } from '../types'
import { fmtTimestampShort } from '../utils/format'

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

const fmtTs = fmtTimestampShort

export default function Analysis() {
  const [folder, setFolder] = useState<FolderKey>('vsi_podatki')
  const [meters, setMeters] = useState<MeterSummary[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [details, setDetails] = useState<Record<number, MeterDetail>>({})
  const [loadingMeters, setLoadingMeters] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    setLoadingMeters(true)
    getMeters(folder)
      .then(setMeters)
      .finally(() => setLoadingMeters(false))
  }, [folder])

  const toggleMeter = async (meterId: number) => {
    if (selected.includes(meterId)) {
      setSelected((p) => p.filter((id) => id !== meterId))
      return
    }
    if (selected.length >= 5) return  // max 5 for readability
    setSelected((p) => [...p, meterId])
    if (!details[meterId]) {
      setLoadingDetail(true)
      try {
        const d = await getMeterDetail(meterId, folder)
        setDetails((p) => ({ ...p, [meterId]: d }))
      } finally {
        setLoadingDetail(false)
      }
    }
  }

  // Build unified timeline from selected meters
  const chartData: Record<string, Record<string, number>> = {}
  for (const mid of selected) {
    const d = details[mid]
    if (!d) continue
    for (const r of d.readings) {
      if (!chartData[r.timestamp]) chartData[r.timestamp] = {}
      chartData[r.timestamp][`m${mid}`] = r.value
    }
  }
  const chartArr = Object.entries(chartData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ts, vals]) => ({ ts, ...vals }))

  // Downsample
  const step = Math.ceil(chartArr.length / 2000)
  const downsampled = chartArr.filter((_, i) => i % step === 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Primerjalna analiza</h1>
        <select
          className="bg-gray-800 text-sm text-gray-200 rounded px-3 py-2 border border-gray-700"
          value={folder}
          onChange={(e) => { setFolder(e.target.value as FolderKey); setSelected([]); setDetails({}) }}
        >
          <option value="vsi_podatki">Vsi podatki</option>
          <option value="ovrednoteni">Ovrednoteni</option>
          <option value="uploads">Naloženi</option>
        </select>
      </div>

      <p className="text-sm text-gray-500">Izberi do 5 merilnikov za primerjavo (klikni na tabelo).</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Meter picker */}
        <div className="card overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-400 mb-2">Merilniki</h2>
          {loadingMeters ? (
            <div className="text-gray-600 text-sm py-4 animate-pulse">Nalagam...</div>
          ) : (
            <div className="overflow-y-auto max-h-96">
              {meters.slice(0, 100).map((m) => {
                const isSelected = selected.includes(m.meter_id)
                return (
                  <div
                    key={m.meter_id}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg mb-1 transition-colors ${isSelected ? 'bg-blue-900/40 text-blue-300' : 'hover:bg-gray-800 text-gray-300'
                      }`}
                    onClick={() => toggleMeter(m.meter_id)}
                  >
                    <span className="font-mono text-sm">m{m.meter_id}</span>
                    <span className="text-xs text-gray-500">{m.anomaly_pct}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Chart */}
        <div className="card col-span-2">
          <h2 className="text-sm font-semibold text-gray-400 mb-3">Primerjava vrednosti</h2>
          {selected.length === 0 ? (
            <div className="text-gray-600 text-sm text-center py-16">Izberi merilnike za primerjavo.</div>
          ) : loadingDetail ? (
            <div className="text-gray-500 text-sm text-center py-16 animate-pulse">Nalagam podatke...</div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={downsampled} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="ts"
                  tickFormatter={fmtTs}
                  tick={{ fill: '#9ca3af', fontSize: 10 }}
                  minTickGap={60}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} width={55} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelFormatter={fmtTs}
                  formatter={(v: number) => [v?.toFixed(2) ?? '–', '']}
                />
                <Legend formatter={(val) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{val}</span>} />
                {selected.map((mid, i) => (
                  <Line
                    key={mid}
                    type="monotone"
                    dataKey={`m${mid}`}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
