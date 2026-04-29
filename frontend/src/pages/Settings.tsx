import { useEffect, useState } from 'react'
import { Save, Plus, X, AlertOctagon } from 'lucide-react'
import type { WafSettings } from '../types.ts'
import { api } from '../lib/api.ts'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-5 mb-4">
      <h3 className="text-white font-semibold text-[13px] mb-4">{title}</h3>
      {children}
    </div>
  )
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[#c9d1d9] text-[12px]">{label}</div>
        {description && <div className="text-[#8b949e] text-[11px] mt-0.5">{description}</div>}
      </div>
      <label className="toggle-switch shrink-0 mt-0.5">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  )
}

function TagsField({ label, tags, onChange }: {
  label: string; tags: string[]; onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState('')

  function add() {
    const v = input.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInput('')
  }

  return (
    <div>
      <label className="text-[#8b949e] text-[11px] block mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t, i) => (
          <span key={i} className="flex items-center gap-1 bg-[#21293a] border border-[#2a3348] text-[#c9d1d9] text-[11px] font-mono px-2 py-0.5 rounded">
            {t}
            <button onClick={() => onChange(tags.filter((_, j) => j !== i))}
              className="text-[#8b949e] hover:text-[#f85149]">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add…"
          className="flex-1 bg-[#0d1117] border border-[#2a3348] text-[#c9d1d9] text-[11px] font-mono rounded px-2 py-1 focus:outline-none focus:border-[#388bfd] placeholder-[#4d5a6b]"
        />
        <button onClick={add}
          className="p-1.5 bg-[#21293a] border border-[#2a3348] rounded text-[#8b949e] hover:text-white transition-colors">
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const [settings, setSettings] = useState<WafSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [panicMode, setPanicMode] = useState(false)
  const [panicStatus, setPanicStatus] = useState<string | null>(null)

  useEffect(() => {
    api.config.settings().then(s => setSettings(s as WafSettings))
    api.control.status().then((s: unknown) => {
      const st = s as { panic: boolean }
      setPanicMode(st.panic)
    })
  }, [])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    await api.config.saveSettings(settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePanic() {
    if (panicMode) {
      await api.control.unpanic()
      setPanicMode(false)
      setPanicStatus('WAF resumed — traffic flowing normally')
    } else {
      await api.control.panic()
      setPanicMode(true)
      setPanicStatus('PANIC MODE ACTIVE — all traffic blocked')
    }
    setTimeout(() => setPanicStatus(null), 5000)
  }

  function update(patch: Partial<WafSettings>) {
    setSettings(prev => prev ? { ...prev, ...patch } : prev)
  }

  if (!settings) return (
    <div className="flex items-center justify-center h-screen text-[#8b949e]">Loading…</div>
  )

  const t = settings.risk_thresholds

  return (
    <div className="p-6 max-w-[720px]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-white font-semibold text-[15px]">Settings</h1>
          <p className="text-[#8b949e] text-[11px] mt-0.5">Changes apply immediately — no restart required</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded text-[12px] font-semibold transition-colors ${
            saved ? 'bg-[#3fb950] text-black' : 'bg-[#388bfd] hover:bg-[#1f6feb] text-white'
          }`}>
          <Save size={13} />
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Panic button */}
      <div className={`mb-4 p-4 rounded-lg border ${panicMode ? 'border-[#f85149] bg-[#3d1a1a]' : 'border-[#2a3348] bg-[#161b22]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertOctagon size={16} className={panicMode ? 'text-[#f85149]' : 'text-[#8b949e]'} />
            <div>
              <div className="text-[#c9d1d9] text-[12px] font-semibold">Emergency Panic Button</div>
              <div className="text-[#8b949e] text-[11px]">
                {panicMode ? '⚠ ACTIVE — All requests are being blocked' : 'Block all traffic immediately (manual intervention)'}
              </div>
            </div>
          </div>
          <button onClick={handlePanic}
            className={`px-4 py-2 rounded font-semibold text-[12px] transition-colors ${
              panicMode
                ? 'bg-[#3fb950] hover:bg-[#2ea643] text-black'
                : 'bg-[#f85149] hover:bg-[#da3633] text-white'
            }`}>
            {panicMode ? 'RESUME' : 'PANIC'}
          </button>
        </div>
        {panicStatus && (
          <div className="mt-2 text-[11px] text-[#d29922]">{panicStatus}</div>
        )}
      </div>

      {/* Shadow mode */}
      <Section title="Shadow Mode (Dry Run)">
        <ToggleRow
          label="Enable Shadow Mode"
          description="Requests that would be blocked/challenged are forwarded. Events still appear in Live Feed and logs."
          checked={settings.shadow_mode}
          onChange={v => update({ shadow_mode: v })}
        />
      </Section>

      {/* Risk thresholds */}
      <Section title="Risk Thresholds">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[#8b949e] text-[11px]">Allow (0 → {t.allow_below})</label>
              <span className="text-[#3fb950] font-mono text-[11px]">{t.allow_below}</span>
            </div>
            <input type="range" min={0} max={50} value={t.allow_below}
              onChange={e => update({ risk_thresholds: { ...t, allow_below: Number(e.target.value) } })} />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-[#8b949e] text-[11px]">Challenge ({t.allow_below} → {t.block_above})</label>
              <span className="text-[#a371f7] font-mono text-[11px]">{t.block_above}</span>
            </div>
            <input type="range" min={30} max={90} value={t.block_above}
              onChange={e => update({ risk_thresholds: { ...t, block_above: Number(e.target.value) } })} />
          </div>
          <div className="text-[11px] text-[#8b949e] bg-[#0d1117] rounded p-2 font-mono">
            Block threshold: &gt;{t.block_above} · XDP Layer 4 block: &gt;{t.xdp_block_threshold} (TTL {t.xdp_block_ttl_secs}s)
          </div>
        </div>
      </Section>

      {/* Challenge engine */}
      <Section title="Challenge Engine">
        <div>
          <label className="text-[#8b949e] text-[11px] block mb-1.5">Challenge Type</label>
          <select
            value={settings.challenge_type}
            onChange={e => update({ challenge_type: e.target.value })}
            className="bg-[#0d1117] border border-[#2a3348] text-[#c9d1d9] text-[12px] rounded px-3 py-1.5 focus:outline-none focus:border-[#388bfd] w-48">
            <option value="JS Challenge">JS Challenge</option>
            <option value="Proof of Work">Proof of Work</option>
          </select>
        </div>
      </Section>

      {/* Honeypot paths */}
      <Section title="Honeypot Paths">
        <p className="text-[#8b949e] text-[11px] mb-3">
          Requests to these paths trigger max risk score + immediate IP block.
        </p>
        <TagsField
          label=""
          tags={settings.honeypot_paths}
          onChange={v => update({ honeypot_paths: v })}
        />
      </Section>

      {/* Response filtering */}
      <Section title="Response Filtering">
        <div className="space-y-4">
          <ToggleRow
            label="Block Stack Traces in Responses"
            checked={settings.block_stack_traces}
            onChange={v => update({ block_stack_traces: v })}
          />
          <div className="pt-2 border-t border-[#21293a]">
            <TagsField
              label="Redact JSON Fields"
              tags={settings.redact_fields}
              onChange={v => update({ redact_fields: v })}
            />
          </div>
        </div>
      </Section>
    </div>
  )
}
