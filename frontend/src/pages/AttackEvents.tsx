import { useMemo, useState } from 'react'
import type { LogEvent } from '../types.ts'
import { ActionBadge, TierBadge, RuleTag, MethodBadge } from '../components/Badges.tsx'
import { AlertTriangle } from 'lucide-react'

interface Props { events: LogEvent[] }

function fmt(ms: number) {
  const d = new Date(ms)
  return d.toLocaleTimeString('en-US', { hour12: false })
}

export default function AttackEvents({ events }: Props) {
  const [filter, setFilter] = useState<'block' | 'challenge' | 'all'>('all')

  const attacks = useMemo(() =>
    events.filter(e => {
      if (e.matched_rule_ids.length === 0 && e.final_action === 'allow') return false
      if (e.final_action === 'allow' && e.risk_score_after < 30) return false
      if (filter === 'block') return e.final_action === 'block'
      if (filter === 'challenge') return e.final_action === 'challenge'
      return e.final_action === 'block' || e.final_action === 'challenge' || e.matched_rule_ids.length > 0
    }),
    [events, filter]
  )

  const blockCount = attacks.filter(e => e.final_action === 'block').length
  const challengeCount = attacks.filter(e => e.final_action === 'challenge').length

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#21293a] shrink-0">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-[#f85149]" />
          <div>
            <h1 className="text-white font-semibold text-[15px]">Attack Events</h1>
            <p className="text-[#8b949e] text-[11px] mt-0.5">
              {blockCount} blocked · {challengeCount} challenged
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {(['all', 'block', 'challenge'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-[11px] border transition-colors ${
                filter === f
                  ? 'bg-[#21293a] border-[#388bfd] text-white'
                  : 'border-[#2a3348] text-[#8b949e] hover:text-white'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0 bg-[#0f1117] z-10">
            <tr className="text-[#8b949e] border-b border-[#21293a]">
              <th className="text-left px-3 py-2 font-medium w-[80px]">Time</th>
              <th className="text-left px-3 py-2 font-medium w-[120px]">IP</th>
              <th className="text-left px-3 py-2 font-medium w-[60px]">Method</th>
              <th className="text-left px-3 py-2 font-medium">Path</th>
              <th className="text-left px-3 py-2 font-medium w-[70px]">Tier</th>
              <th className="text-left px-3 py-2 font-medium w-[52px]">Score</th>
              <th className="text-left px-3 py-2 font-medium w-[76px]">Action</th>
              <th className="text-left px-3 py-2 font-medium">Matched Rules</th>
              <th className="text-left px-3 py-2 font-medium w-[60px]">ASN</th>
            </tr>
          </thead>
          <tbody>
            {attacks.map(e => (
              <tr key={e.request_id} className="border-b border-[#21293a] hover:bg-[#161b22]">
                <td className="px-3 py-1.5 text-[#8b949e] font-mono">{fmt(e.timestamp_ms)}</td>
                <td className="px-3 py-1.5 text-[#79c0ff] font-mono">{e.client_ip}</td>
                <td className="px-3 py-1.5"><MethodBadge method={e.method} /></td>
                <td className="px-3 py-1.5 text-[#c9d1d9] max-w-[220px] truncate">{e.path}</td>
                <td className="px-3 py-1.5"><TierBadge tier={e.tier} /></td>
                <td className="px-3 py-1.5">
                  <span className={`font-mono font-semibold ${
                    e.risk_score_after >= 70 ? 'text-[#f85149]' :
                    e.risk_score_after >= 30 ? 'text-[#d29922]' : 'text-[#8b949e]'
                  }`}>{e.risk_score_after}</span>
                </td>
                <td className="px-3 py-1.5"><ActionBadge action={e.final_action} /></td>
                <td className="px-3 py-1.5 max-w-[200px]">
                  {e.matched_rule_ids.map(r => <RuleTag key={r} rule={r} />)}
                  {e.matched_rule_ids.length === 0 && <span className="text-[#4d5a6b]">—</span>}
                </td>
                <td className="px-3 py-1.5 text-[#8b949e] text-[10px]">{e.asn_category}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {attacks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-[#4d5a6b]">
            <AlertTriangle size={24} className="mb-2 opacity-30" />
            <span className="text-[12px]">No attack events detected</span>
          </div>
        )}
      </div>
    </div>
  )
}
