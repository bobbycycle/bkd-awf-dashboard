import { useMemo, useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid,
} from 'recharts'
import type { LogEvent, StatsSnapshot } from '../types.ts'
import { useXdpSSE } from '../hooks/useSSE.ts'
import { api } from '../lib/api.ts'

interface Props { events: LogEvent[] }

export default function Analytics({ events }: Props) {
  const [stats, setStats] = useState<StatsSnapshot | null>(null)
  const { xdpHistory, latestXdp } = useXdpSSE()

  useEffect(() => {
    api.stats().then(s => setStats(s as StatsSnapshot))
    const iv = setInterval(() => api.stats().then(s => setStats(s as StatsSnapshot)), 5000)
    return () => clearInterval(iv)
  }, [])

  const attackData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) {
      for (const r of e.matched_rule_ids) counts[r] = (counts[r] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }))
  }, [events])

  const countryData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) counts[e.country_code] = (counts[e.country_code] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, value]) => ({ name, value }))
  }, [events])

  const latencyBuckets = useMemo(() => {
    const buckets = [
      { label: '<0.5ms', count: 0 },
      { label: '0.5-1ms', count: 0 },
      { label: '1-2ms', count: 0 },
      { label: '2-3ms', count: 0 },
      { label: '3-5ms', count: 0 },
      { label: '>5ms', count: 0 },
    ]
    for (const e of events) {
      const ms = e.latency_us / 1000
      if (ms < 0.5) buckets[0].count++
      else if (ms < 1) buckets[1].count++
      else if (ms < 2) buckets[2].count++
      else if (ms < 3) buckets[3].count++
      else if (ms < 5) buckets[4].count++
      else buckets[5].count++
    }
    return buckets
  }, [events])

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-white font-semibold text-[15px]">Analytics</h1>
        <p className="text-[#8b949e] text-[11px] mt-0.5">Last {events.length} events</p>
      </div>

      {/* Requests over time */}
      {stats && (
        <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
          <div className="text-[#c9d1d9] text-[12px] font-medium mb-3">Traffic Timeline (60s rolling)</div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={stats.timeline} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="g-rps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#388bfd" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#388bfd" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21293a" />
              <XAxis dataKey="ts" hide />
              <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #2a3348', fontSize: 11 }} />
              <Area type="monotone" dataKey="rps" stroke="#388bfd" fill="url(#g-rps)" strokeWidth={1.5} dot={false} name="req/s" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* XDP drop rate */}
      {xdpHistory.length > 0 && (
        <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[#c9d1d9] text-[12px] font-medium">XDP Drop Rate (60s)</div>
            {latestXdp && (
              <div className="flex items-center gap-3 text-[11px] text-[#8b949e]">
                <span>SoftIRQ: <span className="text-white font-mono">{latestXdp.softirq_percent.toFixed(1)}%</span></span>
                <span>v4 total: <span className="text-[#f85149] font-mono">{latestXdp.total_dropped_v4.toLocaleString()}</span></span>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={xdpHistory} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="g-v4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f85149" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f85149" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="g-v6" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d29922" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#d29922" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" hide />
              <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #2a3348', fontSize: 11 }}
                formatter={(v: number, name: string) => [`${v.toFixed(0)} pps`, name === 'v4' ? 'IPv4 drops/s' : name === 'v6' ? 'IPv6 drops/s' : 'Passed/s']}
              />
              <Area type="monotone" dataKey="v4" stroke="#f85149" fill="url(#g-v4)" strokeWidth={1.5} dot={false} name="v4" />
              <Area type="monotone" dataKey="v6" stroke="#d29922" fill="url(#g-v6)" strokeWidth={1.5} dot={false} name="v6" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Attack types */}
        <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
          <div className="text-[#c9d1d9] text-[12px] font-medium mb-3">Attack Rule Matches</div>
          {attackData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={attackData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 10 }} width={130} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #2a3348', fontSize: 11 }} />
                <Bar dataKey="count" fill="#f85149" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-[#4d5a6b] text-[12px]">No attack data yet</div>
          )}
        </div>

        {/* Latency distribution */}
        <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
          <div className="text-[#c9d1d9] text-[12px] font-medium mb-3">Latency Distribution</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={latencyBuckets} margin={{ left: -10, right: 10 }}>
              <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #2a3348', fontSize: 11 }} />
              <Bar dataKey="count" fill="#388bfd" radius={[2, 2, 0, 0]} name="Requests" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Country distribution */}
      <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
        <div className="text-[#c9d1d9] text-[12px] font-medium mb-3">Top Countries</div>
        <div className="grid grid-cols-2 gap-x-8">
          {countryData.map(({ name, value }) => {
            const max = countryData[0]?.value ?? 1
            return (
              <div key={name} className="flex items-center gap-2 py-1 text-[11px]">
                <span className="text-[#8b949e] w-8 shrink-0">{name}</span>
                <div className="flex-1 bg-[#2a3348] rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-[#388bfd]" style={{ width: `${(value / max) * 100}%` }} />
                </div>
                <span className="text-[#8b949e] tabular-nums w-10 text-right">{value}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
