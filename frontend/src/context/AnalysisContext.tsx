import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { AnalysisResult, Event, FolderKey, MeterSummary } from '../types'
import {
  analyzeFolder,
  getEvents,
  getGeographicClusters,
  getHourlyRisk,
  getInfrastructureRoadmap,
  getMeters,
  getReconstructedEvents,
} from '../api/client'

// Preloaded data cache for each page
interface PreloadedData {
  meters: MeterSummary[] | null
  events: Event[] | null
  analyticsAdv: {
    events: any | null
    clustering: any | null
    risk: any | null
    roadmap: any | null
  } | null
}

interface AnalysisCache {
  [folder: string]: {
    result: AnalysisResult | null
    preloaded: PreloadedData
    timestamp: number
  }
}

interface AnalysisContextType {
  // Current selections
  currentFolder: FolderKey
  setCurrentFolder: (folder: FolderKey) => void

  // Analysis results cache
  analysisCache: AnalysisCache

  // Get result for folder
  getResult: (folder: FolderKey) => AnalysisResult | null

  // Set result for folder
  setResult: (folder: FolderKey, result: AnalysisResult) => void

  // Preloaded data getters
  getPreloadedMeters: (folder: FolderKey) => MeterSummary[] | null
  getPreloadedEvents: (folder: FolderKey) => Event[] | null
  getPreloadedAnalytics: (folder: FolderKey, tab: 'events' | 'clustering' | 'risk' | 'roadmap') => any

  // Preload all data for a folder
  preloadAllData: (folder: FolderKey) => Promise<void>

  // Clear all data (new analysis)
  clearAllData: () => void

  // Check if has any data
  hasAnyData: () => boolean
}

const STORAGE_KEY = 'gridsense_analysis_cache_v1'

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined)

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [currentFolder, setCurrentFolderState] = useState<FolderKey>('vsi_podatki')
  const [analysisCache, setAnalysisCache] = useState<AnalysisCache>({})
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setAnalysisCache(parsed.cache || {})
        if (parsed.currentFolder) {
          setCurrentFolderState(parsed.currentFolder)
        }
      }
    } catch (e) {
      console.error('Failed to load analysis cache:', e)
    }
    setIsLoaded(true)
  }, [])

  // Save to localStorage whenever cache or folder changes
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          cache: analysisCache,
          currentFolder,
          timestamp: Date.now(),
        })
      )
    } catch (e) {
      console.error('Failed to save analysis cache:', e)
    }
  }, [analysisCache, currentFolder, isLoaded])

  const setCurrentFolder = useCallback((folder: FolderKey) => {
    setCurrentFolderState(folder)
  }, [])

  const getResult = useCallback(
    (folder: FolderKey) => {
      return analysisCache[folder]?.result || null
    },
    [analysisCache]
  )

  const setResult = useCallback((folder: FolderKey, result: AnalysisResult) => {
    setAnalysisCache((prev) => ({
      ...prev,
      [folder]: {
        ...prev[folder],
        result,
        preloaded: prev[folder]?.preloaded || {
          meters: null,
          events: null,
          analyticsAdv: null,
        },
        timestamp: Date.now(),
      },
    }))
  }, [])

  const getPreloadedMeters = useCallback(
    (folder: FolderKey) => {
      return analysisCache[folder]?.preloaded?.meters || null
    },
    [analysisCache]
  )

  const getPreloadedEvents = useCallback(
    (folder: FolderKey) => {
      return analysisCache[folder]?.preloaded?.events || null
    },
    [analysisCache]
  )

  const getPreloadedAnalytics = useCallback(
    (folder: FolderKey, tab: 'events' | 'clustering' | 'risk' | 'roadmap') => {
      const analytics = analysisCache[folder]?.preloaded?.analyticsAdv
      if (!analytics) return null
      return analytics[tab] || null
    },
    [analysisCache]
  )

  const preloadAllData = useCallback(async (folder: FolderKey) => {
    console.log('Preloading all data for folder:', folder)

    // Start all requests in parallel
    const [
      metersPromise,
      eventsPromise,
      reconstructedEventsPromise,
      clusteringPromise,
      riskPromise,
      roadmapPromise,
    ] = await Promise.allSettled([
      getMeters(folder),
      getEvents(folder),
      getReconstructedEvents(folder),
      getGeographicClusters(folder),
      getHourlyRisk(folder),
      getInfrastructureRoadmap(folder),
    ])

    const meters = metersPromise.status === 'fulfilled' ? metersPromise.value : null
    const events = eventsPromise.status === 'fulfilled' ? eventsPromise.value : null
    const reconstructedEvents = reconstructedEventsPromise.status === 'fulfilled' ? reconstructedEventsPromise.value : null
    const clustering = clusteringPromise.status === 'fulfilled' ? clusteringPromise.value : null
    const risk = riskPromise.status === 'fulfilled' ? riskPromise.value : null
    const roadmap = roadmapPromise.status === 'fulfilled' ? roadmapPromise.value : null

    setAnalysisCache((prev) => ({
      ...prev,
      [folder]: {
        ...prev[folder],
        preloaded: {
          meters,
          events,
          analyticsAdv: {
            events: reconstructedEvents,
            clustering,
            risk,
            roadmap,
          },
        },
        timestamp: Date.now(),
      },
    }))

    console.log('Preloading complete for folder:', folder)
  }, [])

  const clearAllData = useCallback(() => {
    setAnalysisCache({})
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const hasAnyData = useCallback(() => {
    return Object.keys(analysisCache).length > 0
  }, [analysisCache])

  if (!isLoaded) {
    return null // Or a loading spinner
  }

  return (
    <AnalysisContext.Provider
      value={{
        currentFolder,
        setCurrentFolder,
        analysisCache,
        getResult,
        setResult,
        getPreloadedMeters,
        getPreloadedEvents,
        getPreloadedAnalytics,
        preloadAllData,
        clearAllData,
        hasAnyData,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysis() {
  const context = useContext(AnalysisContext)
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider')
  }
  return context
}
