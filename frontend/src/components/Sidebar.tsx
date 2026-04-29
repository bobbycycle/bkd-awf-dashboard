import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Radio, AlertTriangle, BarChart2, ListFilter,
  Layers, ShieldOff, ShieldCheck, Server, Globe, Lock, ScrollText,
  Settings, Shield,
} from 'lucide-react'

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', exact: true },
  { to: '/live', icon: Radio, label: 'Live Feed' },
  { to: '/attacks', icon: AlertTriangle, label: 'Attack Events' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/rules', icon: ListFilter, label: 'Rule Manager' },
  { to: '/tiers', icon: Layers, label: 'Tier Config' },
  { to: '/blacklist', icon: ShieldOff, label: 'Blacklist' },
  { to: '/whitelist', icon: ShieldCheck, label: 'Whitelist' },
  { to: '/upstreams', icon: Server, label: 'Upstreams' },
  { to: '/regions', icon: Globe, label: 'Regions' },
  { to: '/mtls', icon: Lock, label: 'mTLS' },
  { to: '/logs', icon: ScrollText, label: 'Admin Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

interface Props {
  connected: boolean
}

export default function Sidebar({ connected }: Props) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-[200px] flex flex-col bg-[#0f1117] border-r border-[#21293a] z-50 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#21293a]">
        <div className="w-7 h-7 rounded bg-[#388bfd] flex items-center justify-center shrink-0">
          <Shield size={15} className="text-white" />
        </div>
        <div>
          <div className="text-white font-semibold text-[13px] leading-tight">AI-WAF</div>
          <div className="text-[#4d5a6b] text-[10px]">v0.1.18</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-4 py-[7px] text-[12.5px] transition-colors cursor-pointer ${
                isActive
                  ? 'text-white bg-[#1c2230] border-r-2 border-[#388bfd]'
                  : 'text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#161b22]'
              }`
            }
          >
            <Icon size={14} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#21293a]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#3fb950] pulse' : 'bg-[#f85149]'}`} />
          <span className="text-[11px] text-[#8b949e]">{connected ? 'Live' : 'Offline'}</span>
        </div>
        <div className="text-[10px] text-[#4d5a6b] mt-0.5">admin</div>
      </div>
    </aside>
  )
}
