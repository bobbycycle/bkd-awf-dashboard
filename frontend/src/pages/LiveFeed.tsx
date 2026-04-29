import { useState, useRef } from 'react'
import { Download, Pause, Play, Filter } from 'lucide-react'
import type { LogEvent } from '../types.ts'
import { ActionBadge, TierBadge, RiskBadge, RuleTag, MethodBadge } from '../components/Badges.tsx'

interface Props {
  sse: {
    events: LogEvent[]
    connected: boolean
    paused: boolean
    togglePause: () => void
  }
}

function fmt(ms: number): string {
  const d = new Date(ms)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

export default function LiveFeed({ sse }: Props) {
  const { events, connected, paused, togglePause } = sse
  const [filterAction, setFilterAction] = useState('all')
  const [filterTier, setFilterTier] = useState('all')
  const [filterMethod, setFilterMethod] = useState('all')
  const [search, setSearch] = useState('')
  const prevCount = useRef(0)

  const filtered = events.filter(e => {
    if (filterAction !== 'all' && e.final_action !== filterAction) return false
    if (filterTier !== 'all' && e.tier !== filterTier) return false
    if (filterMethod !== 'all' && e.method !== filterMethod) return false
    if (search && !e.path.toLowerCase().includes(search.toLowerCase()) &&
        !e.client_ip.includes(search)) return false
    return true
  })

  const newCount = events.length - prevCount.current
  prevCount.current = events.length

  function exportCsv() {
    const header = 'time,ip,method,path,tier,risk,action,rules\n'
    const rows = filtered.slice(0, 500).map(e =>
      `${fmt(e.timestamp_ms)},${e.client_ip},${e.method},${e.path},${e.tier},${e.risk_score_after},${e.final_action},"${e.matched_rule_ids.join(';')}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `waf-live-${Date.now()}.csv`; a.click()
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#21293a] shrink-0">
        <div>
          <h1 className="text-white font-semibold text-[15px]">Live Feed</h1>
          <p className="text-[#8b949e] text-[11px] mt-0.5">
            {events.length.toLocaleString()} / 1000 events
            {paused && <span className="ml-2 text-[#d29922]">● PAUSED (+{filtered.length} buffered)</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] text-[#8b949e] border border-[#2a3348] hover:text-white hover:border-[#388bfd] transition-colors">
            <Download size={12} /> CSV
          </button>
          <button onClick={togglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] border transition-colors ${
              paused
                ? 'bg-[#d29922] border-[#d29922] text-black font-semibold'
                : 'text-[#8b949e] border-[#2a3348] hover:text-white hover:border-[#388bfd]'
            }`}>
            {paused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-6 py-2.5 border-b border-[#21293a] shrink-0 bg-[#0f1117]">
        <Filter size={12} className="text-[#8b949e] shrink-0" />
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="bg-[#161b22] text-[#8b949e] text-[11px] border border-[#2a3348] rounded px-2 py-1 focus:outline-none focus:border-[#388bfd]">
          <option value="all">All Actions</option>
          <option value="allow">Allow</option>
          <option value="block">Block</option>
          <option value="challenge">Challenge</option>
          <option value="rate_limit">Rate Limit</option>
        </select>
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
          className="bg-[#161b22] text-[#8b949e] text-[11px] border border-[#2a3348] rounded px-2 py-1 focus:outline-none focus:border-[#388bfd]">
          <option value="all">All Tiers</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="CATCH_ALL">CATCH_ALL</option>
        </select>
        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
          className="bg-[#161b22] text-[#8b949e] text-[11px] border border-[#2a3348] rounded px-2 py-1 focus:outline-none focus:border-[#388bfd]">
          <option value="all">All Methods</option>
          {['GET','POST','PUT','DELETE','OPTIONS','PATCH'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter IP / path…"
          className="bg-[#161b22] text-[#c9d1d9] text-[11px] border border-[#2a3348] rounded px-2.5 py-1 focus:outline-none focus:border-[#388bfd] w-48 placeholder-[#4d5a6b]"
        />
        <span className="ml-auto text-[11px] text-[#8b949e]">
          {filtered.length.toLocaleString()} results
          <span className={`ml-2 w-2 h-2 inline-block rounded-full ${connected ? 'bg-[#3fb950] pulse' : 'bg-[#f85149]'}`} />
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0 bg-[#0f1117] z-10">
            <tr className="text-[#8b949e] border-b border-[#21293a]">
              <th className="text-left px-3 py-2 font-medium w-[72px]">Time</th>
              <th className="text-left px-3 py-2 font-medium w-[120px]">IP</th>
              <th className="text-left px-3 py-2 font-medium w-[64px]">Method</th>
              <th className="text-left px-3 py-2 font-medium">Path</th>
              <th className="text-left px-3 py-2 font-medium w-[90px]">Region</th>
              <th className="text-left px-3 py-2 font-medium w-[72px]">Tier</th>
              <th className="text-left px-3 py-2 font-medium w-[40px]">Risk</th>
              <th className="text-left px-3 py-2 font-medium w-[72px]">Action</th>
              <th className="text-left px-3 py-2 font-medium">Rules</th>
              <th className="px-3 py-2 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, i) => (
              <tr
                key={e.request_id}
                className={`border-b border-[#21293a] hover:bg-[#161b22] transition-colors cursor-default ${i < newCount && !paused ? 'row-new' : ''}`}
              >
                <td className="px-3 py-1.5 text-[#8b949e] font-mono tabular-nums">{fmt(e.timestamp_ms)}</td>
                <td className="px-3 py-1.5 text-[#79c0ff] font-mono">{e.client_ip}</td>
                <td className="px-3 py-1.5"><MethodBadge method={e.method} /></td>
                <td className="px-3 py-1.5 text-[#c9d1d9] max-w-[260px] truncate" title={e.path}>
                  <span className="text-[#4d5a6b] text-[10px]">{e.country_code} </span>
                  {e.path}
                </td>
                <td className="px-3 py-1.5 text-[#8b949e]">{e.asn_category === 'Tor' ? '🧅 tor' : e.asn_category === 'Vpn' ? '🔒 vpn' : 'ap-primary'}</td>
                <td className="px-3 py-1.5"><TierBadge tier={e.tier} /></td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <RiskBadge score={e.risk_score_after} />
                    <span className="text-[#4d5a6b] text-[10px]">{e.risk_score_after}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5"><ActionBadge action={e.final_action} /></td>
                <td className="px-3 py-1.5 max-w-[180px]">
                  {e.matched_rule_ids.map(r => <RuleTag key={r} rule={r} />)}
                </td>
                <td className="px-3 py-1.5 text-right text-[#4d5a6b]">
                  <span className="font-mono">{(e.latency_us / 1000).toFixed(1)}ms</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[#4d5a6b] text-[12px]">
            No events match current filters
          </div>
        )}
      </div>
    </div>
  )
}
