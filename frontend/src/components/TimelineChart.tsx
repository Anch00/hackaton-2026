import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MeterReading } from '../types'
import { ANOMALY_COLORS } from '../types'
import { fmtTimestampShort } from '../utils/format'

interface Props {
  readings: MeterReading[]
  height?: number
}

const CustomDot = (props: {
  cx?: number
  cy?: number
  payload?: MeterReading
}) => {
  const { cx, cy, payload } = props
  if (!payload?.anomaly || cx == null || cy == null) return null
  const color = ANOMALY_COLORS[payload.anomaly_type ?? 'NEZNANA_ANOMALIJA'] ?? '#ef4444'
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="none" opacity={0.85} />
}

CustomDot.displayName = 'CustomDot'

export default function TimelineChart({ readings, height = 320 }: Props) {
  // Downsample if > 2000 points for performance
  const data = useMemo(() => {
    if (readings.length <= 2000) return readings
    const step = Math.ceil(readings.length / 2000)
    return readings.filter((_, i) => i % step === 0)
  }, [readings])

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={fmtTimestampShort}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          minTickGap={60}
        />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          width={60}
        />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#d1d5db', fontSize: 12 }}
          labelFormatter={fmtTimestampShort}
          formatter={(value: number) => [value.toFixed(2), 'Vrednost']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={<CustomDot />}
          activeDot={{ r: 5, fill: '#60a5fa' }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
