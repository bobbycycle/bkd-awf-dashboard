import { useEffect, useState } from 'react'
import { Plus, Trash2, ShieldCheck } from 'lucide-react'
import type { IpEntry } from '../types.ts'
import { api } from '../lib/api.ts'

function fmt(ms: number) {
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Whitelist() {
  const [list, setList] = useState<IpEntry[]>([])
  const [newIp, setNewIp] = useState('')
  const [newReason, setNewReason] = useState('')

  useEffect(() => {
    api.whitelist.list().then(l => setList(l as IpEntry[]))
  }, [])

  async function add() {
    if (!newIp.trim()) return
    const entry = await api.whitelist.add({ ip: newIp.trim(), reason: newReason || 'Manual allow', expires_at: null }) as IpEntry
    setList(prev => [entry, ...prev])
    setNewIp(''); setNewReason('')
  }

  async function remove(ip: string) {
    await api.whitelist.remove(ip)
    setList(prev => prev.filter(e => e.ip !== ip))
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <ShieldCheck size={16} className="text-[#3fb950]" />
        <div>
          <h1 className="text-white font-semibold text-[15px]">Whitelist</h1>
          <p className="text-[#8b949e] text-[11px] mt-0.5">{list.length} trusted IPs</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input value={newIp} onChange={e => setNewIp(e.target.value)}
          placeholder="IP address…" onKeyDown={e => e.key === 'Enter' && add()}
          className="w-40 bg-[#161b22] border border-[#2a3348] text-[#c9d1d9] text-[12px] font-mono rounded px-3 py-1.5 focus:outline-none focus:border-[#388bfd] placeholder-[#4d5a6b]" />
        <input value={newReason} onChange={e => setNewReason(e.target.value)}
          placeholder="Reason (optional)…" onKeyDown={e => e.key === 'Enter' && add()}
          className="flex-1 bg-[#161b22] border border-[#2a3348] text-[#c9d1d9] text-[12px] rounded px-3 py-1.5 focus:outline-none focus:border-[#388bfd] placeholder-[#4d5a6b]" />
        <button onClick={add}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3fb950] hover:bg-[#2ea643] text-black rounded text-[12px] font-semibold transition-colors">
          <Plus size={12} /> Allow
        </button>
      </div>

      <div className="bg-[#161b22] border border-[#2a3348] rounded-lg overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[#8b949e] border-b border-[#2a3348] bg-[#0f1117]">
              <th className="text-left px-4 py-2.5 font-medium">IP</th>
              <th className="text-left px-4 py-2.5 font-medium">Reason</th>
              <th className="text-left px-4 py-2.5 font-medium w-[140px]">Added</th>
              <th className="text-right px-4 py-2.5 font-medium w-[60px]">Hits</th>
              <th className="px-4 py-2.5 w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(e => (
              <tr key={e.ip} className="border-b border-[#21293a] hover:bg-[#1c2230]">
                <td className="px-4 py-2.5 text-[#79c0ff] font-mono">{e.ip}</td>
                <td className="px-4 py-2.5 text-[#c9d1d9]">{e.reason}</td>
                <td className="px-4 py-2.5 text-[#8b949e]">{fmt(e.added_at)}</td>
                <td className="px-4 py-2.5 text-right text-[#3fb950] font-mono tabular-nums">{e.hits}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => remove(e.ip)} className="text-[#8b949e] hover:text-[#f85149] transition-colors">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <div className="flex items-center justify-center h-24 text-[#4d5a6b] text-[12px]">Whitelist is empty</div>
        )}
      </div>
    </div>
  )
}
