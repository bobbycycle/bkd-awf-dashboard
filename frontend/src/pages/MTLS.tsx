import { Lock, CheckCircle, AlertCircle } from 'lucide-react'

const CERTS = [
  { id: 'cert-001', cn: 'monitoring.internal', issuer: 'WAF Internal CA', expires: Date.now() + 86400000 * 180, valid: true, fingerprint: 'SHA256:aa:bb:cc:dd:ee:ff' },
  { id: 'cert-002', cn: 'scanner.internal', issuer: 'WAF Internal CA', expires: Date.now() + 86400000 * 30, valid: true, fingerprint: 'SHA256:11:22:33:44:55:66' },
  { id: 'cert-003', cn: 'admin-ui.corp', issuer: 'Corp CA', expires: Date.now() - 86400000, valid: false, fingerprint: 'SHA256:aa:11:bb:22:cc:33' },
]

function daysUntil(ms: number) {
  const d = Math.floor((ms - Date.now()) / 86400000)
  return d
}

export default function MTLS() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <Lock size={16} className="text-[#a371f7]" />
        <div>
          <h1 className="text-white font-semibold text-[15px]">mTLS</h1>
          <p className="text-[#8b949e] text-[11px] mt-0.5">Mutual TLS client certificate management</p>
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[#c9d1d9] text-[12px] font-semibold">mTLS Enforcement</div>
            <div className="text-[#8b949e] text-[11px] mt-0.5">Require client certificate on /admin/* and /internal/*</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" defaultChecked />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      <div className="space-y-2.5">
        {CERTS.map(cert => {
          const days = daysUntil(cert.expires)
          const expColor = !cert.valid ? 'text-[#f85149]' : days < 30 ? 'text-[#d29922]' : 'text-[#3fb950]'
          return (
            <div key={cert.id} className="bg-[#161b22] border border-[#2a3348] rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {cert.valid
                    ? <CheckCircle size={15} className="text-[#3fb950] shrink-0" />
                    : <AlertCircle size={15} className="text-[#f85149] shrink-0" />
                  }
                  <div>
                    <div className="text-white font-semibold text-[12px] font-mono">{cert.cn}</div>
                    <div className="text-[#8b949e] text-[11px] mt-0.5">Issuer: {cert.issuer}</div>
                    <div className="text-[#4d5a6b] text-[10px] font-mono mt-0.5">{cert.fingerprint}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[12px] font-semibold ${expColor}`}>
                    {cert.valid ? (days < 0 ? 'EXPIRED' : `${days}d`) : 'EXPIRED'}
                  </div>
                  <div className="text-[#4d5a6b] text-[10px]">
                    {new Date(cert.expires).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
