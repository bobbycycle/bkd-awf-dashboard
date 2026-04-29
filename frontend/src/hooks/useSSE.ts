import { useEffect, useRef, useState, useCallback } from 'react'
import type { LogEvent } from '../types.ts'

const MAX_EVENTS = 1000

export function useSSE(maxEvents = MAX_EVENTS) {
  const [events, setEvents] = useState<LogEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [paused, setPaused] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const pausedRef = useRef(false)
  const bufferRef = useRef<LogEvent[]>([])

  useEffect(() => {
    const es = new EventSource('/api/v1/events/live')
    esRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as LogEvent
        if (event.final_action === 'xdp_stats') return // handled separately

        if (pausedRef.current) {
          bufferRef.current.push(event)
          if (bufferRef.current.length > 200) bufferRef.current.shift()
          return
        }

        setEvents(prev => {
          const next = [event, ...prev]
          return next.length > maxEvents ? next.slice(0, maxEvents) : next
        })
      } catch {}
    }

    return () => {
      es.close()
      setConnected(false)
    }
  }, [maxEvents])

  const togglePause = useCallback(() => {
    const nowPaused = !pausedRef.current
    pausedRef.current = nowPaused
    setPaused(nowPaused)

    if (!nowPaused && bufferRef.current.length > 0) {
      // Flush buffer
      const buffered = [...bufferRef.current]
      bufferRef.current = []
      setEvents(prev => {
        const next = [...buffered.reverse(), ...prev]
        return next.length > maxEvents ? next.slice(0, maxEvents) : next
      })
    }
  }, [maxEvents])

  return { events, connected, paused, togglePause }
}

export function useXdpSSE() {
  const [xdpHistory, setXdpHistory] = useState<{ ts: number; v4: number; v6: number; passed: number }[]>([])
  const [latestXdp, setLatestXdp] = useState<{
    dropped_v4_pps: number; dropped_v6_pps: number; passed_pps: number
    total_dropped_v4: number; total_dropped_v6: number
    xdp_enabled: boolean; softirq_percent: number; timestamp_ms: number
  } | null>(null)

  useEffect(() => {
    const es = new EventSource('/api/v1/events/live')
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        if (event.final_action === 'xdp_stats' && event.xdp_stats) {
          const s = event.xdp_stats
          setLatestXdp(s)
          setXdpHistory(prev => {
            const next = [...prev, { ts: s.timestamp_ms, v4: s.dropped_v4_pps, v6: s.dropped_v6_pps, passed: s.passed_pps }]
            return next.length > 60 ? next.slice(-60) : next
          })
        }
      } catch {}
    }
    return () => es.close()
  }, [])

  return { xdpHistory, latestXdp }
}
