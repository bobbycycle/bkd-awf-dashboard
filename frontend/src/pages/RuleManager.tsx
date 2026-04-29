import { useEffect, useState } from 'react'
import { Plus, Trash2, ToggleLeft, ToggleRight, Shield, ShieldOff, Zap, Clock } from 'lucide-react'
import type { CustomRule } from '../types.ts'
import { api } from '../lib/api.ts'

const ACTION_COLORS: Record<string, string> = {
  block:      'text-[#f85149] bg-[#3d1a1a] border-[#5c2a2a]',
  challenge:  'text-[#a371f7] bg-[#2d1f4a] border-[#4a3066]',
  allow:      'text-[#3fb950] bg-[#1a3a22] border-[#2a5c32]',
  rate_limit: 'text-[#d29922] bg-[#2a2a1a] border-[#4a4a22]',
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  block: ShieldOff, challenge: Shield, allow: Shield, rate_limit: Zap,
}

export default function RuleManager() {
  const [rules, setRules] = useState<CustomRule[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newDesc, setNewDesc] = useState('')
  const [newAction, setNewAction] = useState('block')
  const [newDelta, setNewDelta] = useState(30)

  useEffect(() => {
    api.rules.list().then(r => setRules(r as CustomRule[]))
  }, [])

  async function toggleRule(rule: CustomRule) {
    await api.rules.update(rule.id, { enabled: !rule.enabled })
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))
  }

  async function deleteRule(id: string) {
    await api.rules.delete(id)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  async function createRule() {
    if (!newDesc.trim()) return
    const created = await api.rules.create({
      description: newDesc,
      action: newAction,
      risk_score_delta: newDelta,
    }) as CustomRule
    setRules(prev => [created, ...prev])
    setShowNew(false)
    setNewDesc('')
    setNewAction('block')
    setNewDelta(30)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-white font-semibold text-[15px]">Rule Manager</h1>
          <p className="text-[#8b949e] text-[11px] mt-0.5">{rules.length} rules · hot-reload enabled</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#388bfd] hover:bg-[#1f6feb] text-white rounded text-[12px] font-semibold transition-colors">
          <Plus size={13} /> New Rule
        </button>
      </div>

      {/* New rule form */}
      {showNew && (
        <div className="bg-[#161b22] border border-[#388bfd] rounded-lg p-4 mb-4">
          <div className="text-[#c9d1d9] font-semibold text-[12px] mb-3">New Rule</div>
          <div className="space-y-3">
            <input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Rule description…"
              className="w-full bg-[#0d1117] border border-[#2a3348] text-[#c9d1d9] text-[12px] rounded px-3 py-1.5 focus:outline-none focus:border-[#388bfd] placeholder-[#4d5a6b]"
            />
            <div className="flex gap-3">
              <div>
                <label className="text-[#8b949e] text-[11px] block mb-1">Action</label>
                <select value={newAction} onChange={e => setNewAction(e.target.value)}
                  className="bg-[#0d1117] border border-[#2a3348] text-[#c9d1d9] text-[12px] rounded px-2 py-1.5 focus:outline-none focus:border-[#388bfd]">
                  <option value="block">Block</option>
                  <option value="challenge">Challenge</option>
                  <option value="allow">Allow</option>
                  <option value="rate_limit">Rate Limit</option>
                </select>
              </div>
              <div>
                <label className="text-[#8b949e] text-[11px] block mb-1">Risk Delta</label>
                <input type="number" value={newDelta} onChange={e => setNewDelta(Number(e.target.value))}
                  className="w-20 bg-[#0d1117] border border-[#2a3348] text-[#c9d1d9] text-[12px] font-mono rounded px-2 py-1.5 focus:outline-none focus:border-[#388bfd]" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createRule}
                className="px-4 py-1.5 bg-[#388bfd] hover:bg-[#1f6feb] text-white rounded text-[12px] font-semibold transition-colors">
                Create
              </button>
              <button onClick={() => setShowNew(false)}
                className="px-4 py-1.5 bg-[#21293a] text-[#8b949e] hover:text-white rounded text-[12px] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule list */}
      <div className="space-y-2">
        {rules.map(rule => {
          const Icon = ACTION_ICONS[rule.action] ?? Shield
          const colorCls = ACTION_COLORS[rule.action] ?? 'text-[#8b949e] bg-[#21293a] border-[#2a3348]'
          return (
            <div key={rule.id}
              className={`flex items-center gap-3 bg-[#161b22] border border-[#2a3348] rounded-lg px-4 py-3 ${!rule.enabled ? 'opacity-40' : ''}`}>
              {/* Priority badge */}
              <div className="text-[#4d5a6b] text-[10px] font-mono w-8 shrink-0">#{rule.priority}</div>

              {/* Action badge */}
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${colorCls}`}>
                <Icon size={10} />
                {rule.action.replace('_', ' ').toUpperCase()}
              </span>

              {/* Description */}
              <div className="flex-1 min-w-0">
                <div className="text-[#c9d1d9] text-[12px] truncate">{rule.description}</div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#8b949e]">
                  <span className="font-mono">{rule.scope}</span>
                  <span>·</span>
                  <span className={rule.risk_score_delta > 0 ? 'text-[#f85149]' : 'text-[#3fb950]'}>
                    Δ{rule.risk_score_delta > 0 ? '+' : ''}{rule.risk_score_delta}
                  </span>
                  <span>·</span>
                  <span className="font-mono">{rule.logic}</span>
                  <span>·</span>
                  <Clock size={9} />
                  <span>{new Date(rule.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Conditions count */}
              {rule.conditions.length > 0 && (
                <span className="text-[10px] text-[#8b949e] bg-[#21293a] px-2 py-0.5 rounded font-mono shrink-0">
                  {rule.conditions.length} cond
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleRule(rule)}
                  className="p-1.5 text-[#8b949e] hover:text-[#388bfd] transition-colors" title={rule.enabled ? 'Disable' : 'Enable'}>
                  {rule.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
                <button onClick={() => deleteRule(rule.id)}
                  className="p-1.5 text-[#8b949e] hover:text-[#f85149] transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {rules.length === 0 && !showNew && (
        <div className="flex flex-col items-center justify-center h-40 text-[#4d5a6b]">
          <Shield size={24} className="mb-2 opacity-30" />
          <span className="text-[12px]">No custom rules defined</span>
        </div>
      )}
    </div>
  )
}
