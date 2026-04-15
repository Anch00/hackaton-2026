import React from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { AnalysisProvider } from './context/AnalysisContext'
import Analysis from './pages/Analysis'
import AnalyticsAdv from './pages/AnalyticsAdv'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import MeterDetail from './pages/MeterDetail'
import Meters from './pages/Meters'

const NAV = [
  { to: '/', label: '🏠 Dashboard', exact: true },
  { to: '/meters', label: '📟 Merilniki' },
  { to: '/events', label: '⚡ Dogodki' },
  { to: '/analysis', label: '📊 Analiza' },
  { to: '/analytics-adv', label: '🔬 Napredna Analitika' },
]

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top navigation */}
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-6 overflow-x-auto">
        <span className="font-bold text-blue-400 text-lg tracking-wide">⚡ GridSense</span>
        <div className="flex gap-1">
          {NAV.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>

      <footer className="border-t border-gray-800 py-3 px-6 text-center text-xs text-gray-700">
        GridSense • Elektro Maribor Hackathon 2026 • 100% lokalno • Phase 1-4 Analytics Integrated
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <AnalysisProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/meters" element={<Meters />} />
            <Route path="/meters/:id" element={<MeterDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/analytics-adv" element={<AnalyticsAdv />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AnalysisProvider>
  )
}
