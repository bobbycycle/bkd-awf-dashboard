import { useEffect, useState } from 'react'
import { Save, Plus, X } from 'lucide-react'
import type { TierConfig } from '../types.ts'
import { api } from '../lib/api.ts'

type TierMap = Record<string, TierConfig>

const TIER_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const
const TIER_COLORS: Record<string, string> = {
  CRITICAL: 'text-[#f85149] border-[#5c2a2a]',
  HIGH:     'text-[#f0883e] border-[#4a2e1a]',
  MEDIUM:   'text-[#d29922] border-[#3a3a22]',
  LOW:      'text-[#3fb950] border-[#1a3a22]',
}

function TierPanel({
  tier, config, onChange,
}: {
  tier: string
  config: TierConfig
  onChange: (cfg: TierConfig) => void
}) {
  const [newPattern, setNewPattern] = useState('')

  function addPattern() {
    if (!newPattern.trim()) return
    onChange({ ...config, patterns: [...config.patterns, newPattern.trim()] })
    setNewPattern('')
  }

  function removePattern(i: number) {
    const patterns = config.patterns.filter((_, idx) => idx !== i)
    onChange({ ...config, patterns })
  }

  return (
    <div className={`bg-[#161b22] border rounded-lg p-4 ${TIER_COLORS[tier] ?? 'border-[#2a3348]'}`}>
      <div className="flex items-center gap-2 mb-4">
        <h3 className={`font-semibold text-[13px] ${TIER_COLORS[tier]?.split(' ')[0] ?? 'text-white'}`}>{tier}</h3>
      </div>

      {/* Route patterns */}
      <div className="mb-4">
        <label className="text-[#8b949e] text-[11px] block mb-1.5">Route Patterns</label>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
          {config.patterns.map((p, i) => (
            <span key={i} className="flex items-center gap-1 bg-[#21293a] border border-[#2a3348] text-[#c9d1d9] text-[10px] font-mono px-2 py-0.5 rounded">
              {p}
              <button onClick={() => removePattern(i)} className="text-[#8b949e] hover:text-[#f85149] ml-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newPattern}
            onChange={e => setNewPattern(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPattern()}
            placeholder="/path/pattern*"
            className="flex-1 bg-[#0d1117] border border-[#2a3348] text-[#c9d1d9] text-[11px] font-mono rounded px-2 py-1 focus:outline-none focus:border-[#388bfd] placeholder-[#4d5a6b]"
          />
          <button onClick={addPattern}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#21293a] border border-[#2a3348] rounded text-[#8b949e] hover:text-white text-[11px] transition-colors">
            <Plus size={11} /> Add Pattern
          </button>
        </div>
      </div>

      {/* Rate limit slider */}
      <SliderField
        label="Rate Limit (req/s)"
        value={config.rate_limit}
        min={1} max={500}
        onChange={v => onChange({ ...config, rate_limit: v })}
      />
      <SliderField
        label="Burst Limit"
        value={config.burst_limit}
        min={1} max={1000}
        onChange={v => onChange({ ...config, burst_limit: v })}
      />

      {/* Toggles */}
      <div className="space-y-2.5 mt-3">
        <ToggleField
          label="Fail Open"
          checked={config.fail_open}
          disabled={tier === 'CRITICAL'}
          onChange={v => onChange({ ...config, fail_open: v })}
        />
        <ToggleField
          label="Cache Responses"
          checked={config.cache_responses}
          onChange={v => onChange({ ...config, cache_responses: v })}
        />
        {config.cache_responses && (
          <div className="flex items-center gap-2 mt-1">
            <label className="text-[#8b949e] text-[11px] shrink-0">Cache TTL (s)</label>
            <input
              type="number"
              value={config.cache_ttl ?? 60}
              min={10} max={86400}
              onChange={e => onChange({ ...config, cache_ttl: Number(e.target.value) })}
              className="w-20 bg-[#0d1117] border border-[#2a3348] text-[#c9d1d9] text-[11px] font-mono rounded px-2 py-1 focus:outline-none focus:border-[#388bfd]"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function SliderField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <label className="text-[#8b949e] text-[11px]">{label}</label>
        <span className="text-[#c9d1d9] text-[11px] font-mono">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))} className="w-full" />
    </div>
  )
}

function ToggleField({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <label className={`text-[11px] ${disabled ? 'text-[#4d5a6b]' : 'text-[#8b949e]'}`}>
        {label}
        {disabled && <span className="ml-1 text-[10px]">(forced off)</span>}
      </label>
      <label className="toggle-switch">
        <input type="checkbox" checked={disabled ? false : checked} disabled={disabled}
          onChange={e => !disabled && onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  )
}

export default function TierConfig() {
  const [tiers, setTiers] = useState<TierMap | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.config.tiers().then(d => setTiers(d as TierMap))
  }, [])

  async function handleSave() {
    if (!tiers) return
    setSaving(true)
    await api.config.saveTiers(tiers)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!tiers) return (
    <div className="flex items-center justify-center h-screen text-[#8b949e]">Loading…</div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-white font-semibold text-[15px]">Tier Config</h1>
          <p className="text-[#8b949e] text-[11px] mt-0.5">Route-based security tiers and rate limits</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold transition-colors ${
            saved
              ? 'bg-[#3fb950] text-black'
              : 'bg-[#388bfd] hover:bg-[#1f6feb] text-white'
          }`}>
          <Save size={13} />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save All'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {TIER_ORDER.map(tier => (
          <TierPanel
            key={tier}
            tier={tier}
            config={tiers[tier] ?? { patterns: [], rate_limit: 100, burst_limit: 200, fail_open: true, cache_responses: false, cache_ttl: null }}
            onChange={cfg => setTiers(prev => prev ? { ...prev, [tier]: cfg } : prev)}
          />
        ))}
      </div>
    </div>
  )
}
