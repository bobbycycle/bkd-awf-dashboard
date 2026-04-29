import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Shield, ShieldOff, Zap, Activity, Clock, Database } from 'lucide-react'
import type { LogEvent, StatsSnapshot } from '../types.ts'
import { api } from '../lib/api.ts'

interface Props { events: LogEvent[] }

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[#8b949e] text-[11px] mb-1">{label}</div>
          <div className="text-white text-[22px] font-semibold tabular-nums">{value}</div>
          {sub && <div className="text-[#8b949e] text-[10px] mt-0.5">{sub}</div>}
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
    </div>
  )
}

const PIE_COLORS = ['#3fb950', '#f85149', '#a371f7', '#d29922']
const TIER_COLORS: Record<string, string> = {
  CRITICAL: '#f85149', HIGH: '#f0883e', MEDIUM: '#d29922', CATCH_ALL: '#8b949e',
}

export default function Overview({ events }: Props) {
  const [stats, setStats] = useState<StatsSnapshot | null>(null)

  useEffect(() => {
    api.stats().then(s => setStats(s as StatsSnapshot))
    const iv = setInterval(() => api.stats().then(s => setStats(s as StatsSnapshot)), 3000)
    return () => clearInterval(iv)
  }, [])

  if (!stats) return (
    <div className="flex items-center justify-center h-screen text-[#8b949e]">Loading…</div>
  )

  const pieData = [
    { name: 'Allow', value: stats.allowed },
    { name: 'Block', value: stats.blocked },
    { name: 'Challenge', value: stats.challenged },
    { name: 'Rate Limit', value: stats.rate_limited },
  ]

  const attackData = Object.entries(stats.attack_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }))

  const tierData = Object.entries(stats.tier_counts)
    .map(([tier, count]) => ({ name: tier, count, fill: TIER_COLORS[tier] ?? '#8b949e' }))

  const blockRate = stats.total_requests
    ? ((stats.blocked / stats.total_requests) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-white font-semibold text-[15px]">Overview</h1>
        <p className="text-[#8b949e] text-[11px] mt-0.5">Real-time security posture</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total Requests" value={stats.total_requests.toLocaleString()}
          sub={`${stats.req_per_sec} req/s`} icon={Activity} color="bg-[#1f3a5f]" />
        <StatCard label="Blocked" value={stats.blocked.toLocaleString()}
          sub={`${blockRate}% block rate`} icon={ShieldOff} color="bg-[#3d1a1a]" />
        <StatCard label="Challenged" value={stats.challenged.toLocaleString()}
          sub="JS + PoW" icon={Shield} color="bg-[#2d1f4a]" />
        <StatCard label="p99 Latency" value={`${(stats.p99_latency_us / 1000).toFixed(1)}ms`}
          sub={`avg ${(stats.avg_latency_us / 1000).toFixed(1)}ms`} icon={Clock} color="bg-[#1a2f1a]" />
      </div>

      {/* Row 2: XDP + Circuit Breaker */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="XDP Dropped/s (v4)" value={stats.xdp_stats.dropped_v4_pps.toFixed(0)}
          sub="Layer 4 pps" icon={Zap} color="bg-[#1a2f40]" />
        <StatCard label="SoftIRQ CPU %" value={`${stats.xdp_stats.softirq_percent.toFixed(1)}%`}
          sub="from /proc/stat" icon={Activity} color="bg-[#1a2f40]" />
        <StatCard label="Cache Hit Rate" value={`${(stats.cache_hit_rate * 100).toFixed(0)}%`}
          sub="smart cache" icon={Database} color="bg-[#1a2a20]" />
        <StatCard label="Circuit Breaker" value={stats.circuit_breaker.toUpperCase()}
          sub="upstream health" icon={Zap}
          color={stats.circuit_breaker === 'closed' ? 'bg-[#1a2f1a]' : 'bg-[#3d1a1a]'} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Timeline */}
        <div className="col-span-2 bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
          <div className="text-[#c9d1d9] text-[12px] font-medium mb-3">Requests / Block Rate (60s)</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={stats.timeline} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="rps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#388bfd" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#388bfd" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="blk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f85149" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f85149" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" hide />
              <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#161b22', border: '1px solid #2a3348', fontSize: 11 }}
                labelFormatter={() => ''}
                formatter={(val: number, name: string) => [
                  name === 'rps' ? `${val} req/s` : `${val.toFixed(1)}%`,
                  name === 'rps' ? 'Requests/s' : 'Block Rate %',
                ]}
              />
              <Area type="monotone" dataKey="rps" stroke="#388bfd" fill="url(#rps)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="block_rate" stroke="#f85149" fill="url(#blk)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Action pie */}
        <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
          <div className="text-[#c9d1d9] text-[12px] font-medium mb-3">Action Distribution</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                dataKey="value" paddingAngle={2}>
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #2a3348', fontSize: 11 }} />
              <Legend iconSize={8} iconType="circle"
                formatter={(v) => <span style={{ color: '#8b949e', fontSize: 10 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Attack types */}
        <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
          <div className="text-[#c9d1d9] text-[12px] font-medium mb-3">Top Attack Types</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={attackData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
              <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 10 }} width={120} />
              <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #2a3348', fontSize: 11 }} />
              <Bar dataKey="count" fill="#f85149" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top attackers */}
        <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
          <div className="text-[#c9d1d9] text-[12px] font-medium mb-3">Top IPs</div>
          <div className="space-y-1.5 overflow-auto max-h-[150px]">
            {stats.top_ips.slice(0, 8).map(({ ip, count, action }) => (
              <div key={ip} className="flex items-center gap-2 text-[11px]">
                <span className="text-[#79c0ff] font-mono w-[128px] shrink-0">{ip}</span>
                <div className="flex-1 bg-[#2a3348] rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${action === 'block' ? 'bg-[#f85149]' : 'bg-[#388bfd]'}`}
                    style={{ width: `${Math.min(100, count * 3)}%` }}
                  />
                </div>
                <span className="text-[#8b949e] tabular-nums w-10 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
