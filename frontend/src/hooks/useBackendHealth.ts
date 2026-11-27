import { useCallback, useEffect, useState } from 'react'
import { sentraApi } from '@/api/client'
import type { HealthResponse } from '@/types/sentra'

export type BackendConnectionState = 'checking' | 'connected' | 'disconnected'

export interface BackendHealthResult {
  state: BackendConnectionState
  health: HealthResponse | null
  lastChecked: Date | null
  error: string | null
  refresh: () => Promise<void>
}

export function useBackendHealth(pollIntervalMs = 10000): BackendHealthResult {
  const [state, setState] = useState<BackendConnectionState>('checking')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await sentraApi.getHealth()
      setHealth(data)
      setState(data.status === 'ok' ? 'connected' : 'disconnected')
      setError(null)
    } catch (err) {
      setHealth(null)
      setState('disconnected')
      setError(err instanceof Error ? err.message : 'Unable to reach SENTRA_api')
    } finally {
      setLastChecked(new Date())
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, pollIntervalMs)
    return () => window.clearInterval(timer)
  }, [pollIntervalMs, refresh])

  return { state, health, lastChecked, error, refresh }
}
