import type { AnomalyType } from '../types'
import { ANOMALY_COLORS, ANOMALY_LABELS } from '../types'

interface Props {
  type: AnomalyType | string
  className?: string
}

export default function AnomalyBadge({ type, className = '' }: Props) {
  const color = ANOMALY_COLORS[type] ?? '#6b7280'
  const label = ANOMALY_LABELS[type] ?? type

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${className}`}
      style={{ backgroundColor: color + '22', color }}
    >
      {label}
    </span>
  )
}
