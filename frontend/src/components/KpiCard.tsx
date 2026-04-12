import React from 'react'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  color?: string   // Tailwind text color class, e.g. 'text-blue-400'
  trend?: string
}

export default function KpiCard({ title, value, subtitle, icon, color = 'text-blue-400', trend }: Props) {
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{title}</span>
        {icon && <span className={`text-xl ${color}`}>{icon}</span>}
      </div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
      {trend && <div className="text-xs text-gray-400 mt-1">{trend}</div>}
    </div>
  )
}
