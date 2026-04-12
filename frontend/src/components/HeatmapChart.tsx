import { useMemo } from 'react'
import { Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { MeterSummary } from '../types'
import { ANOMALY_COLORS } from '../types'

interface Props {
  meters: MeterSummary[]
}

/**
 * Simple heatmap-like scatter chart.
 * X = anomaly_pct (0-100), Y = meter_id, color = dominant anomaly type or status.
 * Full D3 heatmap would need canvas; this recharts version works well for demo.
 */
export default function HeatmapChart({ meters }: Props) {
  const data = useMemo(
    () =>
      meters
        .filter((m) => m.anomaly_count > 0)
        .map((m) => ({
          x: m.anomaly_pct,
          y: m.meter_id,
          type: m.anomaly_types[0] ?? 'NEZNANA_ANOMALIJA',
          label: `m${m.meter_id}: ${m.anomaly_pct}% anomal.`,
        })),
    [meters]
  )

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">Heatmap anomalij — merilniki</h3>
      {data.length === 0 ? (
        <div className="text-gray-600 text-sm py-8 text-center">Ni anomalnih merilnikov.</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <XAxis
              dataKey="x"
              name="Anomalije %"
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              label={{ value: 'Anomalije (%)', position: 'insideBottom', fill: '#6b7280', fontSize: 11, dy: 10 }}
            />
            <YAxis
              dataKey="y"
              name="Merilnik ID"
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={45}
              label={{ value: 'ID', angle: -90, position: 'insideLeft', fill: '#6b7280', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              formatter={(_: unknown, name: string, props: { payload?: { label?: string } }) => [
                props.payload?.label ?? '',
                '',
              ]}
              labelFormatter={() => ''}
            />
            <Scatter data={data} isAnimationActive={false}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={ANOMALY_COLORS[entry.type] ?? '#6b7280'}
                  fillOpacity={0.8}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
