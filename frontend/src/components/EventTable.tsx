import { useState } from 'react'
import type { Event } from '../types'
import { SEVERITY_COLORS } from '../types'
import { fmtTimestamp } from '../utils/format'
import AnomalyBadge from './AnomalyBadge'

interface Props {
  events: Event[]
}

type SortKey = 'start' | 'duration_h' | 'severity'

const SEV_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

export default function EventTable({ events }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('start')
  const [sortAsc, setSortAsc] = useState(false)
  const [filterType, setFilterType] = useState('ALL')
  const [filterSev, setFilterSev] = useState('ALL')

  const types = ['ALL', ...Array.from(new Set(events.map((e) => e.type)))]
  const severities = ['ALL', 'HIGH', 'MEDIUM', 'LOW']

  const sorted = [...events]
    .filter((e) => filterType === 'ALL' || e.type === filterType)
    .filter((e) => filterSev === 'ALL' || e.severity === filterSev)
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'start') cmp = a.start.localeCompare(b.start)
      else if (sortKey === 'duration_h') cmp = a.duration_h - b.duration_h
      else cmp = SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
      return sortAsc ? cmp : -cmp
    })

  const toggle = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p)
    else { setSortKey(key); setSortAsc(false) }
  }

  const Th = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="text-left px-3 py-2 text-xs text-gray-400 cursor-pointer select-none hover:text-gray-200"
      onClick={() => toggle(k)}
    >
      {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="card overflow-hidden">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Tip:</label>
          <select
            className="bg-gray-800 text-sm text-gray-200 rounded px-2 py-1 border border-gray-700"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Resnost:</label>
          <select
            className="bg-gray-800 text-sm text-gray-200 rounded px-2 py-1 border border-gray-700"
            value={filterSev}
            onChange={(e) => setFilterSev(e.target.value)}
          >
            {severities.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <span className="text-xs text-gray-500 self-center">{sorted.length} dogodkov</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-800">
            <tr>
              <th className="text-left px-3 py-2 text-xs text-gray-400">#</th>
              <Th label="Začetek" k="start" />
              <Th label="Trajanje (h)" k="duration_h" />
              <th className="text-left px-3 py-2 text-xs text-gray-400">Tip</th>
              <Th label="Resnost" k="severity" />
              <th className="text-left px-3 py-2 text-xs text-gray-400">Merilnik</th>
              <th className="text-left px-3 py-2 text-xs text-gray-400">Mrežni izpad</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ev) => (
              <tr key={ev.event_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-2 text-gray-500">{ev.event_id}</td>
                <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{fmtTimestamp(ev.start)}</td>
                <td className="px-3 py-2 text-gray-300">{ev.duration_h}</td>
                <td className="px-3 py-2"><AnomalyBadge type={ev.type} /></td>
                <td className="px-3 py-2">
                  <span className={`badge ${SEVERITY_COLORS[ev.severity]}`}>{ev.severity}</span>
                </td>
                <td className="px-3 py-2 text-gray-400">{ev.affected_meters.join(', ')}</td>
                <td className="px-3 py-2">
                  {ev.is_grid_outage
                    ? <span className="badge bg-red-900 text-red-300">DA</span>
                    : <span className="text-gray-600">–</span>}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-600">Ni dogodkov.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
