import { useCallback, useEffect, useState } from 'react'
import { getEvents } from '../api/client'
import EventTable from '../components/EventTable'
import type { Event, FolderKey } from '../types'

export default function Events() {
  const [folder, setFolder] = useState<FolderKey>('vsi_podatki')
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getEvents(folder)
      setEvents(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Napaka.')
    } finally {
      setLoading(false)
    }
  }, [folder])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Dogodki</h1>
        <div className="flex items-center gap-2">
          <select
            className="bg-gray-800 text-sm text-gray-200 rounded px-3 py-2 border border-gray-700"
            value={folder}
            onChange={(e) => setFolder(e.target.value as FolderKey)}
          >
            <option value="vsi_podatki">Vsi podatki</option>
            <option value="ovrednoteni">Ovrednoteni</option>
            <option value="uploads">Naloženi</option>
          </select>
          <button className="btn-primary text-sm" onClick={load} disabled={loading}>
            {loading ? '⏳' : '🔄 Osveži'}
          </button>
          <a href={`/api/export/csv?folder=${folder}`} className="btn-secondary text-sm" download>
            ⬇ CSV
          </a>
        </div>
      </div>

      {error && <div className="card border-red-800 text-red-400 text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-gray-500 animate-pulse">Nalagam...</div>
      ) : (
        <EventTable events={events} />
      )}
    </div>
  )
}
