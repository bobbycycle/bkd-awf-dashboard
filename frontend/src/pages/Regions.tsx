import { Globe, MapPin } from 'lucide-react'

const REGIONS = [
  { id: 'ap-sg', name: 'Singapore (AP-SE)', code: 'SG', traffic: 42, blocked: 18, latency: 8, active: true },
  { id: 'ap-vn', name: 'Vietnam (AP-SE)', code: 'VN', traffic: 28, blocked: 12, latency: 12, active: true },
  { id: 'us-west', name: 'US West', code: 'US', traffic: 15, blocked: 5, latency: 145, active: true },
  { id: 'eu-central', name: 'EU Central', code: 'DE', traffic: 10, blocked: 3, latency: 220, active: true },
  { id: 'cn-east', name: 'China East', code: 'CN', traffic: 5, blocked: 62, latency: 95, active: false },
]

export default function Regions() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <Globe size={16} className="text-[#388bfd]" />
        <div>
          <h1 className="text-white font-semibold text-[15px]">Regions</h1>
          <p className="text-[#8b949e] text-[11px] mt-0.5">Geographic traffic distribution</p>
        </div>
      </div>

      <div className="grid gap-3">
        {REGIONS.map(r => (
          <div key={r.id} className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#21293a] flex items-center justify-center shrink-0">
              <MapPin size={16} className={r.active ? 'text-[#388bfd]' : 'text-[#4d5a6b]'} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-[12px]">{r.name}</span>
                <span className="text-[10px] font-mono text-[#8b949e] bg-[#21293a] px-1.5 py-0.5 rounded">{r.code}</span>
                {!r.active && (
                  <span className="text-[10px] text-[#f85149] bg-[#3d1a1a] px-1.5 py-0.5 rounded">HIGH BLOCK RATE</span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2 text-[11px]">
                <div>
                  <span className="text-[#4d5a6b]">Traffic </span>
                  <span className="text-[#79c0ff] font-mono">{r.traffic}%</span>
                </div>
                <div>
                  <span className="text-[#4d5a6b]">Block rate </span>
                  <span className={`font-mono ${r.blocked > 30 ? 'text-[#f85149]' : 'text-[#8b949e]'}`}>{r.blocked}%</span>
                </div>
                <div>
                  <span className="text-[#4d5a6b]">Latency </span>
                  <span className="text-[#8b949e] font-mono">{r.latency}ms</span>
                </div>
              </div>
              <div className="mt-2 bg-[#2a3348] rounded-full h-1 overflow-hidden">
                <div className="h-1 rounded-full bg-[#388bfd]" style={{ width: `${r.traffic}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
