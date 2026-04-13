import { useCallback, useState, useEffect } from 'react'
import { getAnalytics, getHourlyRisk, getMTTR, getInfrastructureRoadmap } from '../api/client'
import type { FolderKey } from '../types'

export default function AnalyticsAdv() {
  const [folder, setFolder] = useState<FolderKey>('vsi_podatki')
  const [activeTab, setActiveTab] = useState<'events' | 'clustering' | 'risk' | 'roadmap'>('events')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      let result = null
      if (activeTab === 'events') {
        result = await fetch(`http://localhost:8000/api/analytics/events?folder=${folder}`).then(r => r.json())
      } else if (activeTab === 'clustering') {
        result = await fetch(`http://localhost:8000/api/analytics/clustering?folder=${folder}`).then(r => r.json())
      } else if (activeTab === 'risk') {
        result = await fetch(`http://localhost:8000/api/analytics/predictive/hourly-risk?folder=${folder}`).then(r => r.json())
      } else if (activeTab === 'roadmap') {
        result = await fetch(`http://localhost:8000/api/analytics/infrastructure-roadmap?folder=${folder}`).then(r => r.json())
      }
      setData(result)
    } catch (e) {
      console.error('Error loading analytics:', e)
    } finally {
      setLoading(false)
    }
  }, [folder, activeTab])

  useEffect(() => {
    loadData()
  }, [loadData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Advanced Analytics</h1>
        <p className="text-sm text-gray-400 mt-2">Phase 3 & 4: Event Reconstruction, Geographic Clustering, Predictive Modeling</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'events'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          🔄 Event Reconstruction
        </button>
        <button
          onClick={() => setActiveTab('clustering')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'clustering'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          🗺️ Geographic Clustering
        </button>
        <button
          onClick={() => setActiveTab('risk')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'risk'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          🔮 Hourly Risk Model
        </button>
        <button
          onClick={() => setActiveTab('roadmap')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'roadmap'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          🏗️ Infrastructure Roadmap
        </button>
      </div>

      {/* Folder Selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-400">Dataset:</label>
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value as FolderKey)}
          className="bg-gray-800 text-gray-200 rounded px-3 py-2 border border-gray-700"
        >
          <option value="vsi_podatki">Production (vsi_podatki)</option>
          <option value="ovrednoteni">Labeled (ovrednoteni)</option>
          <option value="uploads">Uploads</option>
        </select>
      </div>

      {loading && <div className="text-center text-gray-400 py-8">Loading...</div>}

      {data && !loading && (
        <>
          {activeTab === 'events' && (
            <EventsTab data={data} />
          )}
          {activeTab === 'clustering' && (
            <ClusteringTab data={data} />
          )}
          {activeTab === 'risk' && (
            <RiskTab data={data} />
          )}
          {activeTab === 'roadmap' && (
            <RoadmapTab data={data} />
          )}
        </>
      )}
    </div>
  )
}

function EventsTab({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Total Events</p>
          <p className="text-3xl font-bold text-blue-400">{data.total_events}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Critical Events</p>
          <p className="text-3xl font-bold text-red-400">{data.critical_events?.length || 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Avg Meters/Event</p>
          <p className="text-3xl font-bold text-yellow-400">
            {data.top_events?.length > 0
              ? (
                  data.top_events.reduce((sum: number, e: any) => sum + e.affected_count, 0) /
                  data.top_events.length
                ).toFixed(1)
              : '-'}
          </p>
        </div>
      </div>

      {/* Top Events Table */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Top Events by Impact</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead className="border-b border-gray-600">
              <tr>
                <th className="text-left py-2">Timestamp</th>
                <th className="text-center py-2">Meters</th>
                <th className="text-center py-2">Duration (h)</th>
                <th className="text-right py-2">Impact Score</th>
                <th className="text-center py-2">Severity</th>
              </tr>
            </thead>
            <tbody>
              {data.top_events?.slice(0, 15).map((event: any, i: number) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="py-3">{event.timestamp}</td>
                  <td className="text-center">{event.affected_count}</td>
                  <td className="text-center">{event.avg_duration_hours}</td>
                  <td className="text-right font-bold">{event.total_impact.toFixed(0)}</td>
                  <td className="text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        event.severity === 'CRITICAL'
                          ? 'bg-red-900 text-red-200'
                          : event.severity === 'HIGH'
                          ? 'bg-yellow-900 text-yellow-200'
                          : 'bg-blue-900 text-blue-200'
                      }`}
                    >
                      {event.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ClusteringTab({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Total Clusters</p>
          <p className="text-3xl font-bold text-blue-400">{data.total_clusters}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Critical</p>
          <p className="text-3xl font-bold text-red-400">{data.critical_clusters}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">High Priority</p>
          <p className="text-3xl font-bold text-yellow-400">{data.high_priority_clusters}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Avg Reliability</p>
          <p className="text-3xl font-bold text-green-400">
            {data.top_clusters?.length > 0
              ? (
                  data.top_clusters.reduce((sum: number, c: any) => sum + c.reliability_pct, 0) /
                  data.top_clusters.length
                ).toFixed(1)
              : '-'}
            %
          </p>
        </div>
      </div>

      {/* Clusters Table */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Geographic Clusters (Priority Order)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead className="border-b border-gray-600">
              <tr>
                <th className="text-left py-2">Cluster</th>
                <th className="text-center py-2">Meters</th>
                <th className="text-center py-2">Zero Hours</th>
                <th className="text-center py-2">Reliability %</th>
                <th className="text-center py-2">Events</th>
                <th className="text-center py-2">Priority</th>
              </tr>
            </thead>
            <tbody>
              {data.top_clusters?.map((cluster: any, i: number) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="py-3 font-mono text-blue-400">{cluster.cluster_id}</td>
                  <td className="text-center">{cluster.meter_count}</td>
                  <td className="text-center">{cluster.total_zero_hours}h</td>
                  <td className="text-center">
                    <span
                      className={
                        cluster.reliability_pct > 85
                          ? 'text-green-400'
                          : cluster.reliability_pct > 70
                          ? 'text-yellow-400'
                          : 'text-red-400'
                      }
                    >
                      {cluster.reliability_pct}%
                    </span>
                  </td>
                  <td className="text-center">{cluster.outage_events}</td>
                  <td className="text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        cluster.priority === 'CRITICAL'
                          ? 'bg-red-900 text-red-200'
                          : cluster.priority === 'HIGH'
                          ? 'bg-yellow-900 text-yellow-200'
                          : 'bg-blue-900 text-blue-200'
                      }`}
                    >
                      {cluster.priority}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function RiskTab({ data }: { data: any }) {
  const hourlyData = data.hourly_breakdown || []
  const peakHours = data.peak_risk_hours || []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Critical Risk Hours</p>
          <p className="text-3xl font-bold text-red-400">{data.critical_hours_count}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">High Risk Hours</p>
          <p className="text-3xl font-bold text-yellow-400">{data.high_risk_hours_count}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400">Peak Hours</p>
          <p className="text-lg font-bold text-blue-400">{peakHours.slice(0, 3).join(', ')}</p>
        </div>
      </div>

      {/* Hourly Risk Heatmap */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Outage Risk by Hour (0-10 Scale)</h3>
        <div className="grid grid-cols-12 gap-2">
          {hourlyData.map((hour: any) => (
            <div
              key={hour.hour}
              className="flex flex-col items-center"
              title={`Hour ${hour.hour}: Risk ${hour.risk_score}/10 (${hour.historical_outages} outages, ${hour.affected_meters} meters)`}
            >
              <div
                className={`w-full h-16 rounded flex items-center justify-center font-bold text-sm cursor-pointer transition ${
                  hour.risk_level === 'CRITICAL'
                    ? 'bg-red-600 text-red-100'
                    : hour.risk_level === 'HIGH'
                    ? 'bg-yellow-600 text-yellow-100'
                    : hour.risk_level === 'MEDIUM'
                    ? 'bg-blue-600 text-blue-100'
                    : 'bg-green-600 text-green-100'
                }`}
              >
                {hour.risk_score}
              </div>
              <p className="text-xs text-gray-400 mt-1">{hour.hour}:00</p>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Table */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Detailed Risk Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-300">
            <thead className="border-b border-gray-600">
              <tr>
                <th className="text-left py-2">Hour</th>
                <th className="text-center py-2">Risk Score</th>
                <th className="text-center py-2">Historical Outages</th>
                <th className="text-center py-2">Affected Meters</th>
                <th className="text-center py-2">Avg Duration (h)</th>
                <th className="text-center py-2">Level</th>
              </tr>
            </thead>
            <tbody>
              {hourlyData.map((hour: any, i: number) => (
                <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/50">
                  <td className="py-2 font-mono">{hour.hour}:00</td>
                  <td className="text-center font-bold">{hour.risk_score}/10</td>
                  <td className="text-center">{hour.historical_outages}</td>
                  <td className="text-center">{hour.affected_meters}</td>
                  <td className="text-center">{hour.avg_duration}</td>
                  <td className="text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        hour.risk_level === 'CRITICAL'
                          ? 'bg-red-900 text-red-200'
                          : hour.risk_level === 'HIGH'
                          ? 'bg-yellow-900 text-yellow-200'
                          : hour.risk_level === 'MEDIUM'
                          ? 'bg-blue-900 text-blue-200'
                          : 'bg-green-900 text-green-200'
                      }`}
                    >
                      {hour.risk_level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function RoadmapTab({ data }: { data: any }) {
  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Infrastructure Status</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-400">Total Clusters</p>
            <p className="text-2xl font-bold text-blue-400">{data.summary?.total_clusters}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Critical Clusters</p>
            <p className="text-2xl font-bold text-red-400">{data.summary?.critical_clusters}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Current Zero Hours</p>
            <p className="text-2xl font-bold text-yellow-400">{(data.summary?.total_zero_hours_current / 1000).toFixed(1)}k</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">After Phase 3</p>
            <p className="text-2xl font-bold text-green-400">{(data.summary?.estimated_zero_hours_after_phase3 / 1000).toFixed(1)}k</p>
          </div>
        </div>
      </div>

      {/* Phase 1 */}
      <PhaseCard
        phase="PHASE 1"
        timeline={data.phase_1?.timeline}
        priority={data.phase_1?.priority}
        clusters={data.phase_1?.clusters}
        meters={data.phase_1?.meters_count}
        improvement={data.phase_1?.expected_improvement_pct}
        saidReduction={data.phase_1?.saidi_reduction}
      />

      {/* Phase 2 */}
      <PhaseCard
        phase="PHASE 2"
        timeline={data.phase_2?.timeline}
        priority={data.phase_2?.priority}
        clusters={data.phase_2?.clusters}
        meters={data.phase_2?.meters_count}
        improvement={data.phase_2?.expected_improvement_pct}
        saidReduction={data.phase_2?.saidi_reduction}
      />

      {/* Phase 3 */}
      <PhaseCard
        phase="PHASE 3"
        timeline={data.phase_3?.timeline}
        priority={data.phase_3?.priority}
        clusters={data.phase_3?.clusters}
        meters={data.phase_3?.meters_count}
        improvement={data.phase_3?.expected_improvement_pct}
        saidReduction={data.phase_3?.saidi_reduction}
      />
    </div>
  )
}

function PhaseCard({
  phase,
  timeline,
  priority,
  clusters,
  meters,
  improvement,
  saidReduction,
}: {
  phase: string
  timeline: string
  priority: string
  clusters: string[]
  meters: number
  improvement: number
  saidReduction: number
}) {
  const bgColor =
    priority === 'CRITICAL' ? 'bg-red-900/20 border-red-700' : priority === 'HIGH' ? 'bg-yellow-900/20 border-yellow-700' : 'bg-blue-900/20 border-blue-700'

  return (
    <div className={`${bgColor} border rounded-lg p-6`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{phase}</h3>
          <p className="text-sm text-gray-400">{timeline}</p>
        </div>
        <span
          className={`px-3 py-1 rounded text-xs font-bold ${
            priority === 'CRITICAL'
              ? 'bg-red-900 text-red-200'
              : priority === 'HIGH'
              ? 'bg-yellow-900 text-yellow-200'
              : 'bg-blue-900 text-blue-200'
          }`}
        >
          {priority}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400">Clusters</p>
          <p className="text-lg font-bold text-blue-400">{clusters?.join(', ')}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Meters to Upgrade</p>
          <p className="text-lg font-bold text-purple-400">{meters}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-400">Expected Improvement</p>
          <p className="text-lg font-bold text-green-400">+{improvement}%</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">SAIDI Reduction</p>
          <p className="text-lg font-bold text-orange-400">{saidReduction}h</p>
        </div>
      </div>
    </div>
  )
}
