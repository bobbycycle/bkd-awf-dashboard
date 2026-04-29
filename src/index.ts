import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  generateLogEvent, addToHistory, eventHistory,
  mockBlacklist, mockWhitelist, mockRules, mockTierConfig,
  mockSettings, mockUpstreams, mockClusters, buildStats, getXdpStats,
} from './mockData.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT ?? 3001)
const WAF_BRIDGE = process.env.WAF_BRIDGE ?? 'http://127.0.0.1:9091'

app.use(cors())
app.use(express.json())

// ─── SSE clients registry ──────────────────────────────────────────────────
type SSEClient = { res: express.Response; id: number }
const sseClients: SSEClient[] = []
let clientIdSeq = 0

function broadcastSSE(event: object) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const client of sseClients) {
    client.res.write(data)
  }
}

// ─── Mock event generator loop ─────────────────────────────────────────────
let panicMode = false

setInterval(() => {
  if (panicMode) return
  const event = generateLogEvent()
  addToHistory(event)
  broadcastSSE(event)
}, 250)

// XDP stats every 1s
setInterval(() => {
  const xdpEvent = {
    request_id: 'xdp-stats',
    timestamp_ms: Date.now(),
    client_ip: '0.0.0.0',
    real_ip: '0.0.0.0',
    final_action: 'xdp_stats',
    xdp_stats: getXdpStats(),
    // fill required fields with defaults
    tls_fingerprint: '', composite_fingerprint: '', session_id: '',
    method: '', path: '', raw_path: '', tier: '', asn_category: '',
    country_code: '', user_agent: '', matched_rule_ids: [],
    risk_score_before: 0, risk_score_delta: 0, risk_score_after: 0,
    response_status: 0, response_body_bytes: 0, latency_us: 0,
    cache_hit: false, circuit_breaker_state: 'closed',
    journey_trail: null, fingerprint_cluster_size: 0, detected_protocol: null,
  }
  broadcastSSE(xdpEvent)
}, 1000)

// ─── Routes ────────────────────────────────────────────────────────────────

// Health
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.18', uptime_s: Math.floor(process.uptime()), waf_bridge: WAF_BRIDGE })
})

// SSE live events
app.get('/api/v1/events/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const id = ++clientIdSeq
  sseClients.push({ res, id })

  // Send last 20 events immediately
  const recent = eventHistory.slice(0, 20).reverse()
  for (const e of recent) {
    res.write(`data: ${JSON.stringify(e)}\n\n`)
  }

  req.on('close', () => {
    const idx = sseClients.findIndex(c => c.id === id)
    if (idx !== -1) sseClients.splice(idx, 1)
  })
})

// Event history
app.get('/api/v1/events/history', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 1000)
  res.json(eventHistory.slice(0, limit))
})

// Journey for a specific request
app.get('/api/v1/events/:request_id/journey', (req, res) => {
  const event = eventHistory.find(e => e.request_id === req.params.request_id)
  if (!event) return res.status(404).json({ error: 'Not found' })
  // Return mock journey trail
  const hops = [
    { path: '/api/v1/login', method: 'POST', timestamp_ms: Date.now() - 60000, response_status: 200, risk_delta: 5, anomaly_flags: [], tier: 'CRITICAL' },
    { path: '/api/v1/otp/verify', method: 'POST', timestamp_ms: Date.now() - 45000, response_status: 200, risk_delta: 0, anomaly_flags: ['FAST_OTP'], tier: 'CRITICAL' },
    { path: '/api/v1/deposit', method: 'POST', timestamp_ms: Date.now() - 3000, response_status: 403, risk_delta: 40, anomaly_flags: ['VELOCITY_ANOMALY', 'ZERO_DEPTH_SESSION'], tier: 'CRITICAL' },
  ]
  res.json({ request_id: event.request_id, journey: hops })
})

// Stats
app.get('/api/v1/stats', (_req, res) => {
  res.json(buildStats())
})

// Intelligence clusters
app.get('/api/v1/intelligence/clusters', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 50)
  res.json(mockClusters.slice(0, limit))
})

app.post('/api/v1/intelligence/block-cluster', (req, res) => {
  const { fingerprint } = req.body as { fingerprint: string }
  if (!fingerprint) return res.status(400).json({ error: 'fingerprint required' })
  res.json({ ok: true, blocked_fingerprint: fingerprint })
})

// Panic button
app.post('/api/v1/control/panic', (_req, res) => {
  panicMode = true
  res.json({ ok: true, mode: 'panic', message: 'All traffic blocked. WAF in emergency mode.' })
})

app.post('/api/v1/control/unpanic', (_req, res) => {
  panicMode = false
  res.json({ ok: true, mode: 'normal' })
})

app.get('/api/v1/control/status', (_req, res) => {
  res.json({ panic: panicMode, sse_clients: sseClients.length })
})

// Rules
app.get('/api/v1/rules', (_req, res) => res.json(mockRules))

app.post('/api/v1/rules', (req, res) => {
  const rule = req.body as { description?: string; action?: string; risk_score_delta?: number }
  const newRule = {
    id: `rule-${Date.now()}`,
    priority: 50,
    scope: 'Global',
    action: rule.action ?? 'block',
    risk_score_delta: rule.risk_score_delta ?? 30,
    enabled: true,
    description: rule.description ?? 'New rule',
    conditions: [],
    logic: 'AND' as const,
    created_at: Date.now(),
    ...rule,
  }
  mockRules.unshift(newRule)
  res.status(201).json(newRule)
})

app.put('/api/v1/rules/:id', (req, res) => {
  const idx = mockRules.findIndex(r => r.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  Object.assign(mockRules[idx], req.body)
  res.json(mockRules[idx])
})

app.delete('/api/v1/rules/:id', (req, res) => {
  const idx = mockRules.findIndex(r => r.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  mockRules.splice(idx, 1)
  res.json({ ok: true })
})

// Tier config
app.get('/api/v1/config/tiers', (_req, res) => res.json(mockTierConfig))

app.put('/api/v1/config/tiers', (req, res) => {
  Object.assign(mockTierConfig, req.body)
  res.json({ ok: true })
})

// Global settings
app.get('/api/v1/config/settings', (_req, res) => res.json(mockSettings))

app.put('/api/v1/config/settings', (req, res) => {
  Object.assign(mockSettings, req.body)
  res.json({ ok: true })
})

app.put('/api/v1/config/thresholds', (req, res) => {
  Object.assign(mockSettings.risk_thresholds, req.body)
  res.json({ ok: true })
})

// Blacklist / Whitelist
app.get('/api/v1/blacklist', (_req, res) => res.json(mockBlacklist))
app.post('/api/v1/blacklist', (req, res) => {
  const entry = { ...req.body, added_at: Date.now(), hits: 0 }
  mockBlacklist.unshift(entry)
  res.status(201).json(entry)
})
app.delete('/api/v1/blacklist/:ip', (req, res) => {
  const idx = mockBlacklist.findIndex(e => e.ip === decodeURIComponent(req.params.ip))
  if (idx !== -1) mockBlacklist.splice(idx, 1)
  res.json({ ok: true })
})

app.get('/api/v1/whitelist', (_req, res) => res.json(mockWhitelist))
app.post('/api/v1/whitelist', (req, res) => {
  const entry = { ...req.body, added_at: Date.now(), hits: 0 }
  mockWhitelist.unshift(entry)
  res.status(201).json(entry)
})
app.delete('/api/v1/whitelist/:ip', (req, res) => {
  const idx = mockWhitelist.findIndex(e => e.ip === decodeURIComponent(req.params.ip))
  if (idx !== -1) mockWhitelist.splice(idx, 1)
  res.json({ ok: true })
})

// Upstreams
app.get('/api/v1/upstreams', (_req, res) => res.json(mockUpstreams))

// XDP
app.get('/api/v1/xdp/stats', (_req, res) => res.json(getXdpStats()))
app.get('/api/v1/xdp/blocklist', (_req, res) => {
  res.json(mockBlacklist.filter(e => e.hits > 50))
})
app.delete('/api/v1/xdp/block/:ip', (req, res) => {
  res.json({ ok: true, unblocked: decodeURIComponent(req.params.ip) })
})

// ─── Serve frontend ────────────────────────────────────────────────────────
const publicDir = path.join(__dirname, '..', 'public')
app.use(express.static(publicDir))
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`WAF Dashboard API  → http://localhost:${PORT}`)
  console.log(`SSE live feed      → http://localhost:${PORT}/api/v1/events/live`)
  console.log(`WAF bridge target  → ${WAF_BRIDGE}`)
})
