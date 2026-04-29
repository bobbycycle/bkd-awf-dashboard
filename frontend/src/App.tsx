import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.tsx'
import { useSSE } from './hooks/useSSE.ts'
import Overview from './pages/Overview.tsx'
import LiveFeed from './pages/LiveFeed.tsx'
import AttackEvents from './pages/AttackEvents.tsx'
import Analytics from './pages/Analytics.tsx'
import RuleManager from './pages/RuleManager.tsx'
import TierConfig from './pages/TierConfig.tsx'
import Blacklist from './pages/Blacklist.tsx'
import Whitelist from './pages/Whitelist.tsx'
import Upstreams from './pages/Upstreams.tsx'
import Regions from './pages/Regions.tsx'
import MTLS from './pages/MTLS.tsx'
import AdminLog from './pages/AdminLog.tsx'
import Settings from './pages/Settings.tsx'

export default function App() {
  const sse = useSSE(1000)

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-[#0d1117]">
        <Sidebar connected={sse.connected} />
        <main className="flex-1 ml-[200px] min-h-screen overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Overview events={sse.events} />} />
            <Route path="/live" element={<LiveFeed sse={sse} />} />
            <Route path="/attacks" element={<AttackEvents events={sse.events} />} />
            <Route path="/analytics" element={<Analytics events={sse.events} />} />
            <Route path="/rules" element={<RuleManager />} />
            <Route path="/tiers" element={<TierConfig />} />
            <Route path="/blacklist" element={<Blacklist />} />
            <Route path="/whitelist" element={<Whitelist />} />
            <Route path="/upstreams" element={<Upstreams />} />
            <Route path="/regions" element={<Regions />} />
            <Route path="/mtls" element={<MTLS />} />
            <Route path="/logs" element={<AdminLog />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
