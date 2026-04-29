interface ActionBadgeProps { action: string }
export function ActionBadge({ action }: ActionBadgeProps) {
  const cfg: Record<string, string> = {
    allow:      'text-[#3fb950]',
    block:      'text-[#f85149] font-semibold',
    challenge:  'text-[#a371f7]',
    rate_limit: 'text-[#d29922]',
    xdp_block:  'text-[#f85149] font-semibold',
  }
  return (
    <span className={`text-[11.5px] ${cfg[action] ?? 'text-[#8b949e]'}`}>
      {action}
    </span>
  )
}

interface TierBadgeProps { tier: string }
export function TierBadge({ tier }: TierBadgeProps) {
  const cfg: Record<string, string> = {
    CRITICAL: 'text-[#f85149]',
    HIGH:     'text-[#f0883e]',
    MEDIUM:   'text-[#d29922]',
    LOW:      'text-[#3fb950]',
    CATCH_ALL:'text-[#8b949e]',
  }
  return (
    <span className={`text-[11px] font-mono uppercase ${cfg[tier] ?? 'text-[#8b949e]'}`}>
      {tier === 'CATCH_ALL' ? 'CATCH' : tier}
    </span>
  )
}

interface RiskBadgeProps { score: number }
export function RiskBadge({ score }: RiskBadgeProps) {
  let label = 'LOW'
  let cls = 'text-[#8b949e]'
  if (score >= 70) { label = 'HIGH'; cls = 'text-[#f85149]' }
  else if (score >= 30) { label = 'MED'; cls = 'text-[#d29922]' }
  return (
    <span className={`text-[11px] font-semibold ${cls}`}>{label}</span>
  )
}

interface RuleTagProps { rule: string }
export function RuleTag({ rule }: RuleTagProps) {
  const isHigh = rule.includes('SQLI') || rule.includes('XSS') || rule.includes('SSRF') || rule.includes('CANARY')
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono mr-1 ${
      isHigh
        ? 'bg-[#3d1f1f] text-[#f85149] border border-[#5c2a2a]'
        : 'bg-[#2a2a1a] text-[#d29922] border border-[#3a3a22]'
    }`}>
      {rule}
    </span>
  )
}

interface MethodBadgeProps { method: string }
export function MethodBadge({ method }: MethodBadgeProps) {
  const cfg: Record<string, string> = {
    GET:     'text-[#79c0ff]',
    POST:    'text-[#3fb950]',
    PUT:     'text-[#d29922]',
    DELETE:  'text-[#f85149]',
    PATCH:   'text-[#a371f7]',
    OPTIONS: 'text-[#8b949e]',
  }
  return (
    <span className={`text-[11px] font-mono font-semibold ${cfg[method] ?? 'text-[#8b949e]'}`}>
      {method}
    </span>
  )
}
