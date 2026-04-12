import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ANOMALY_COLORS, ANOMALY_LABELS } from '../types'

interface Props {
  breakdown: Partial<Record<string, number>>
}

export default function AnomalyPieChart({ breakdown }: Props) {
  const data = Object.entries(breakdown)
    .filter(([, v]) => v && v > 0)
    .map(([type, count]) => ({
      name: ANOMALY_LABELS[type] ?? type,
      value: count as number,
      color: ANOMALY_COLORS[type] ?? '#6b7280',
    }))

  if (data.length === 0) return (
    <div className="card text-gray-600 text-sm text-center py-8">Ni podatkov.</div>
  )

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">Tipi anomalij</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} opacity={0.9} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
            formatter={(v: number) => [v, 'Dogodkov']}
          />
          <Legend
            iconSize={10}
            iconType="circle"
            formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
