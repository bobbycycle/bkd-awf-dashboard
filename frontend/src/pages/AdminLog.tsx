import { useState } from 'react'
import { ScrollText, User } from 'lucide-react'

const MOCK_LOG = [
  { id: 1, ts: Date.now() - 120000, user: 'admin', action: 'Updated risk thresholds', detail: 'block_above: 70 → 75', level: 'info' },
  { id: 2, ts: Date.now() - 300000, user: 'admin', action: 'Added blacklist entry', detail: 'IP: 185.220.101.45 (Tor)', level: 'warning' },
  { id: 3, ts: Date.now() - 600000, user: 'admin', action: 'Disabled rule rule-005', detail: 'Block VPN IPs', level: 'info' },
  { id: 4, ts: Date.now() - 900000, user: 'system', action: 'Config hot-reload triggered', detail: 'waf.yaml mtime changed', level: 'info' },
  { id: 5, ts: Date.now() - 1800000, user: 'admin', action: 'Panic button activated', detail: 'Duration: 45s', level: 'critical' },
  { id: 6, ts: Date.now() - 1860000, user: 'admin', action: 'Panic button deactivated', detail: '', level: 'info' },
  { id: 7, ts: Date.now() - 3600000, user: 'admin', action: 'Tier config saved', detail: 'CRITICAL burst_limit: 20 → 25', level: 'info' },
  { id: 8, ts: Date.now() - 7200000, user: 'admin', action: 'New rule created', detail: 'rule-001: Block Tor exit nodes', level: 'info' },
  { id: 9, ts: Date.now() - 86400000, user: 'system', action: 'WAF started', detail: 'waf v0.1.18, XDP enabled on eth0', level: 'info' },
]

const LEVEL_CFG: Record<string, string> = {
  info: 'text-[#8b949e]',
  warning: 'text-[#d29922]',
  critical: 'text-[#f85149]',
}

export default function AdminLog() {
  const [filter, setFilter] = useState('all')

  const logs = MOCK_LOG.filter(l => filter === 'all' || l.level === filter)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <ScrollText size={16} className="text-[#8b949e]" />
          <div>
            <h1 className="text-white font-semibold text-[15px]">Admin Log</h1>
            <p className="text-[#8b949e] text-[11px] mt-0.5">Audit trail — SIEM-compatible JSON</p>
          </div>
        </div>
        <div className="flex gap-1">
          {['all', 'info', 'warning', 'critical'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-[11px] border transition-colors ${
                filter === f ? 'bg-[#21293a] border-[#388bfd] text-white' : 'border-[#2a3348] text-[#8b949e] hover:text-white'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#2a3348] rounded-lg overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[#8b949e] border-b border-[#2a3348] bg-[#0f1117]">
              <th className="text-left px-4 py-2.5 font-medium w-[140px]">Timestamp</th>
              <th className="text-left px-4 py-2.5 font-medium w-[80px]">User</th>
              <th className="text-left px-4 py-2.5 font-medium">Action</th>
              <th className="text-left px-4 py-2.5 font-medium">Detail</th>
              <th className="text-left px-4 py-2.5 font-medium w-[72px]">Level</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b border-[#21293a] hover:bg-[#1c2230]">
                <td className="px-4 py-2.5 text-[#8b949e] font-mono text-[11px]">
                  {new Date(l.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <User size={11} className="text-[#4d5a6b]" />
                    <span className="text-[#c9d1d9]">{l.user}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[#c9d1d9]">{l.action}</td>
                <td className="px-4 py-2.5 text-[#8b949e] font-mono text-[11px]">{l.detail || '—'}</td>
                <td className={`px-4 py-2.5 font-semibold text-[11px] ${LEVEL_CFG[l.level] ?? ''}`}>
                  {l.level.toUpperCase()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
