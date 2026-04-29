import { useEffect, useState } from 'react'
import { Server, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import type { UpstreamConfig } from '../types.ts'
import { api } from '../lib/api.ts'

export default function Upstreams() {
  const [upstreams, setUpstreams] = useState<UpstreamConfig[]>([])

  useEffect(() => {
    api.upstreams().then(u => setUpstreams(u as UpstreamConfig[]))
    const iv = setInterval(() => api.upstreams().then(u => setUpstreams(u as UpstreamConfig[])), 5000)
    return () => clearInterval(iv)
  }, [])

  const totalReqs = upstreams.reduce((s, u) => s + u.requests, 0)

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <Server size={16} className="text-[#388bfd]" />
        <div>
          <h1 className="text-white font-semibold text-[15px]">Upstreams</h1>
          <p className="text-[#8b949e] text-[11px] mt-0.5">Backend server pool health</p>
        </div>
        <RefreshCw size={12} className="ml-auto text-[#4d5a6b] animate-spin" style={{ animationDuration: '3s' }} />
      </div>

      <div className="grid gap-3">
        {upstreams.map(u => {
          const sharePercent = totalReqs > 0 ? (u.requests / totalReqs * 100).toFixed(1) : '0.0'
          const errorRate = u.requests > 0 ? (u.errors / u.requests * 100).toFixed(2) : '0.00'
          return (
            <div key={u.id} className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {u.healthy
                    ? <CheckCircle size={16} className="text-[#3fb950] shrink-0 mt-0.5" />
                    : <XCircle size={16} className="text-[#f85149] shrink-0 mt-0.5" />
                  }
                  <div>
                    <div className="text-white font-semibold text-[13px]">{u.name}</div>
                    <div className="text-[#8b949e] font-mono text-[11px] mt-0.5">{u.url}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    u.healthy ? 'bg-[#1a3a22] text-[#3fb950]' : 'bg-[#3d1a1a] text-[#f85149]'
                  }`}>
                    {u.healthy ? 'HEALTHY' : 'DOWN'}
                  </span>
                  <span className="text-[#8b949e] text-[11px] bg-[#21293a] px-2 py-0.5 rounded font-mono">
                    weight: {u.weight}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-4">
                <Metric label="Latency" value={u.healthy ? `${u.latency_ms}ms` : 'n/a'}
                  color={u.latency_ms > 50 ? 'text-[#d29922]' : 'text-[#3fb950]'} />
                <Metric label="Requests" value={u.requests.toLocaleString()} color="text-[#79c0ff]" />
                <Metric label="Errors" value={u.errors.toLocaleString()} color={u.errors > 0 ? 'text-[#f85149]' : 'text-[#8b949e]'} />
                <Metric label="Share" value={`${sharePercent}%`} color="text-[#8b949e]" />
              </div>

              {/* Load bar */}
              <div className="mt-3 bg-[#2a3348] rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${u.healthy ? 'bg-[#388bfd]' : 'bg-[#f85149]'}`}
                  style={{ width: `${Math.min(100, Number(sharePercent))}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#4d5a6b]">Traffic share</span>
                <span className="text-[10px] text-[#4d5a6b]">error rate: {errorRate}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[#8b949e] text-[10px]">{label}</div>
      <div className={`font-mono font-semibold text-[14px] mt-0.5 ${color}`}>{value}</div>
    </div>
  )
}
