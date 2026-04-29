import type {
  LogEvent, RoutePolicy, WafSettings, CustomRule,
  IpEntry, FingerprintCluster, StatsSnapshot, UpstreamConfig, XdpStatsSnapshot
} from './types.js'

// ─── Static pools ────────────────────────────────────────────────────────────
const IPS = [
  '192.177.78.148', '204.76.203.206', '138.128.104.79', '172.86.75.43',
  '45.155.205.233', '91.108.4.77', '103.21.244.0', '185.220.101.45',
  '194.165.16.77', '2.56.57.100', '77.83.197.122', '116.31.116.6',
  '58.56.96.123', '36.110.228.254', '223.72.75.36', '14.215.177.38',
  '52.84.12.99', '34.102.147.14', '151.101.64.81', '104.21.3.72',
]

const PATHS = [
  '/api/v1/login', '/api/v1/users/profile', '/api/v1/deposit',
  '/api/v1/withdrawal', '/api/v1/game/slots', '/api/v1/game/poker',
  '/static/js/bundle.js', '/static/css/app.css', '/assets/img/logo.png',
  '/admin.php', '/.env', '/config.yml', '/wp-admin/admin.php',
  '/api/v1/otp/verify', '/user/settings', '/api/v1/balance',
  '/.git/config', '/phpinfo.php', '/server-status', '/actuator/health',
  '/api/v1/transfer', '/api/v1/kyc/submit', '/static/fonts/inter.woff2',
]

const SUSPICIOUS_PATHS = [
  '/.env', '/admin.php', '/wp-admin/admin.php', '/.git/config',
  '/phpinfo.php', '/server-status', '/actuator/health',
  '/api/v1/login', '/api/v1/deposit', '/api/v1/withdrawal',
]

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
const WEIGHTED_METHODS = [
  'GET', 'GET', 'GET', 'GET', 'GET',
  'POST', 'POST', 'POST',
  'PUT', 'DELETE', 'OPTIONS', 'PATCH',
]

const REGIONS = ['singapore', 'ap-primary', 'us-west', 'eu-central', 'ap-southeast', 'us-east']
const COUNTRIES = ['SG', 'VN', 'US', 'CN', 'TH', 'MY', 'ID', 'DE', 'FR', 'GB', 'RU', 'TW']
const ASN_CATS = ['Residential', 'Residential', 'Residential', 'Datacenter', 'Datacenter', 'Tor', 'Vpn']
const PROTOCOLS = ['http1', 'http2', 'http2', 'http1', 'websocket', 'grpc']

const ATTACK_RULES = [
  'SQLI_UNION_BASED', 'SQLI_BLIND', 'SQLI_TIME_BASED',
  'XSS_REFLECTED', 'XSS_IN_JSON',
  'PATH_TRAVERSAL', 'SSRF_PRIVATE_IP',
  'BRUTE_FORCE_LOGIN', 'CREDENTIAL_STUFFING',
  'CANARY_HIT', 'ENDPOINT_ENUM', 'ERROR_HARVEST',
  'RATE_LIMIT_IP', 'HEADER_INJECTION', 'CRLF_INJECTION',
  'BODY_TOO_LARGE', 'JSON_DEPTH_EXCEEDED',
]

const FINGERPRINTS = [
  't13d1715h2_5b57614c22b0_93b4d1e30f4c',
  't13d190900h2_7c32d93a41e5_b2f8e1a7c9d3',
  't13d880900h2_f0e1b2c3d4e5_1a2b3c4d5e6f',
  't10d880900h2_aabbccddeeff_112233445566',
]

const UA_STRINGS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'python-requests/2.31.0',
  'curl/7.88.1',
  'Go-http-client/1.1',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function buildTier(path: string): string {
  if (['/api/v1/login', '/api/v1/otp/verify', '/api/v1/deposit', '/api/v1/withdrawal'].includes(path))
    return 'CRITICAL'
  if (path.startsWith('/api/') || path.startsWith('/game/') || path.startsWith('/user/'))
    return 'HIGH'
  if (path.startsWith('/static/') || path.startsWith('/assets/'))
    return 'MEDIUM'
  return 'CATCH_ALL'
}

function buildAction(riskAfter: number, path: string): string {
  if (SUSPICIOUS_PATHS.includes(path) && riskAfter > 70) return 'block'
  if (riskAfter > 70) return 'block'
  if (riskAfter > 30) return Math.random() > 0.6 ? 'challenge' : 'allow'
  return 'allow'
}

// ─── Main generator ───────────────────────────────────────────────────────────
export function generateLogEvent(overrides?: Partial<LogEvent>): LogEvent {
  const isSuspicious = Math.random() < 0.18
  const path = isSuspicious ? pick(SUSPICIOUS_PATHS) : pick(PATHS)
  const method = isSuspicious ? pick(['GET', 'POST']) : pick(WEIGHTED_METHODS)
  const ip = pick(IPS)
  const riskBefore = rand(0, 40)
  const riskDelta = isSuspicious ? rand(20, 60) : rand(-5, 15)
  const riskAfter = Math.min(100, Math.max(0, riskBefore + riskDelta))
  const action = buildAction(riskAfter, path)
  const matchedRules = isSuspicious
    ? [pick(ATTACK_RULES), ...(Math.random() > 0.5 ? [pick(ATTACK_RULES)] : [])]
    : (Math.random() > 0.8 ? [pick(['RATE_LIMIT_IP', 'BODY_TOO_LARGE'])] : [])

  const fp = pick(FINGERPRINTS)

  return {
    request_id: uuid(),
    timestamp_ms: Date.now(),
    client_ip: ip,
    real_ip: ip,
    tls_fingerprint: fp,
    composite_fingerprint: fp,
    session_id: `sess_${uuid().slice(0, 8)}`,
    method,
    path,
    raw_path: path,
    tier: buildTier(path),
    asn_category: isSuspicious ? pick(['Tor', 'Vpn', 'Datacenter']) : pick(ASN_CATS),
    country_code: pick(COUNTRIES),
    user_agent: isSuspicious ? pick(['python-requests/2.31.0', 'curl/7.88.1', 'Go-http-client/1.1']) : pick(UA_STRINGS),
    matched_rule_ids: matchedRules,
    risk_score_before: riskBefore,
    risk_score_delta: riskDelta,
    risk_score_after: riskAfter,
    final_action: action,
    response_status: action === 'block' ? 403 : action === 'challenge' ? 200 : pick([200, 200, 200, 404, 301, 304]),
    response_body_bytes: rand(128, 8192),
    latency_us: rand(200, 4800),
    cache_hit: Math.random() > 0.7,
    circuit_breaker_state: 'closed',
    journey_trail: null,
    fingerprint_cluster_size: rand(1, 8),
    xdp_stats: null,
    detected_protocol: pick(PROTOCOLS),
    ...overrides,
  }
}

export function generateXdpStats(prev?: XdpStatsSnapshot): XdpStatsSnapshot {
  const active = Math.random() > 0.3
  const dropped = active ? rand(0, 1200) : 0
  return {
    dropped_v4_pps: dropped * (0.8 + Math.random() * 0.4),
    dropped_v6_pps: dropped * (0.1 + Math.random() * 0.1),
    passed_pps: rand(800, 5000),
    total_dropped_v4: (prev?.total_dropped_v4 ?? 0) + dropped,
    total_dropped_v6: (prev?.total_dropped_v6 ?? 0) + Math.floor(dropped * 0.1),
    xdp_enabled: true,
    softirq_percent: active ? rand(2, 18) + Math.random() : rand(1, 5) + Math.random(),
    timestamp_ms: Date.now(),
  }
}

// ─── Persistent mock state ────────────────────────────────────────────────────
let _xdpStats: XdpStatsSnapshot = generateXdpStats()
let _totalL7Blocks = 0

export function getXdpStats(): XdpStatsSnapshot {
  _xdpStats = generateXdpStats(_xdpStats)
  return _xdpStats
}

export function incrementL7Blocks() { _totalL7Blocks++ }
export function getL7Blocks() { return _totalL7Blocks }

export const mockBlacklist: IpEntry[] = [
  { ip: '185.220.101.45', reason: 'Tor exit node', added_at: Date.now() - 3600000, expires_at: null, hits: 423 },
  { ip: '91.108.4.77', reason: 'BRUTE_FORCE_LOGIN', added_at: Date.now() - 7200000, expires_at: Date.now() + 3600000, hits: 88 },
  { ip: '194.165.16.77', reason: 'SQLI_UNION_BASED', added_at: Date.now() - 1800000, expires_at: null, hits: 55 },
  { ip: '45.155.205.233', reason: 'CANARY_HIT', added_at: Date.now() - 900000, expires_at: null, hits: 1 },
  { ip: '2.56.57.100', reason: 'Datacenter + credential stuffing', added_at: Date.now() - 300000, expires_at: Date.now() + 86400000, hits: 312 },
]

export const mockWhitelist: IpEntry[] = [
  { ip: '10.0.0.1', reason: 'Internal monitoring', added_at: Date.now() - 86400000, expires_at: null, hits: 0 },
  { ip: '52.84.12.99', reason: 'AWS CloudFront health check', added_at: Date.now() - 43200000, expires_at: null, hits: 1240 },
  { ip: '151.101.64.81', reason: 'Fastly CDN', added_at: Date.now() - 43200000, expires_at: null, hits: 8832 },
]

export const mockRules: CustomRule[] = [
  {
    id: 'rule-001',
    priority: 100,
    scope: 'Global',
    action: 'block',
    risk_score_delta: 80,
    enabled: true,
    description: 'Block Tor exit nodes immediately',
    conditions: [{ field: 'AsnCategory', operator: 'Eq', value: 'Tor', negate: false }],
    logic: 'AND',
    created_at: Date.now() - 172800000,
  },
  {
    id: 'rule-002',
    priority: 90,
    scope: 'Route(/api/v1/login)',
    action: 'challenge',
    risk_score_delta: 30,
    enabled: true,
    description: 'Challenge datacenter IPs on login',
    conditions: [
      { field: 'AsnCategory', operator: 'Eq', value: 'Datacenter', negate: false },
      { field: 'Path', operator: 'StartsWith', value: '/api/v1/login', negate: false },
    ],
    logic: 'AND',
    created_at: Date.now() - 86400000,
  },
  {
    id: 'rule-003',
    priority: 80,
    scope: 'Global',
    action: 'block',
    risk_score_delta: 100,
    enabled: true,
    description: 'Block SQL injection in any field',
    conditions: [
      { field: 'QueryParam(*)', operator: 'Regex', value: "(union|select|insert|drop)\\s", negate: false },
    ],
    logic: 'OR',
    created_at: Date.now() - 259200000,
  },
  {
    id: 'rule-004',
    priority: 70,
    scope: 'Tier(CRITICAL)',
    action: 'rate_limit',
    risk_score_delta: 10,
    enabled: true,
    description: 'Rate limit CRITICAL endpoints to 10 req/s per IP',
    conditions: [],
    logic: 'AND',
    created_at: Date.now() - 345600000,
  },
  {
    id: 'rule-005',
    priority: 60,
    scope: 'Global',
    action: 'block',
    risk_score_delta: 90,
    enabled: false,
    description: 'Block VPN IPs (disabled — too aggressive)',
    conditions: [{ field: 'AsnCategory', operator: 'Eq', value: 'Vpn', negate: false }],
    logic: 'AND',
    created_at: Date.now() - 432000000,
  },
]

export const mockTierConfig: Record<string, {
  patterns: string[]
  rate_limit: number
  burst_limit: number
  fail_open: boolean
  cache_responses: boolean
  cache_ttl: number | null
}> = {
  CRITICAL: {
    patterns: ['/api/v1/login*', '/api/v1/otp*', '/api/v1/deposit', '/api/v1/withdrawal', '/admin*'],
    rate_limit: 10,
    burst_limit: 25,
    fail_open: false,
    cache_responses: false,
    cache_ttl: null,
  },
  HIGH: {
    patterns: ['/api/game/*', '/api/v1/*', '/user/*'],
    rate_limit: 70,
    burst_limit: 60,
    fail_open: true,
    cache_responses: false,
    cache_ttl: null,
  },
  MEDIUM: {
    patterns: ['/static/*'],
    rate_limit: 150,
    burst_limit: 350,
    fail_open: true,
    cache_responses: true,
    cache_ttl: 90,
  },
  LOW: {
    patterns: ['/*'],
    rate_limit: 100,
    burst_limit: 325,
    fail_open: true,
    cache_responses: true,
    cache_ttl: 200,
  },
}

export const mockSettings: WafSettings = {
  shadow_mode: false,
  risk_thresholds: {
    allow_below: 30,
    challenge_below: 51,
    block_above: 75,
    xdp_block_threshold: 90,
    xdp_block_ttl_secs: 3600,
    decay_per_hour: 10,
  },
  challenge_type: 'JS Challenge',
  honeypot_paths: ['/api/config', '/.gitconfig', '/wp-administrator.php', '/.php/admin'],
  block_stack_traces: true,
  redact_fields: ['password', 'token', 'secret', 'api_key'],
}

export const mockUpstreams: UpstreamConfig[] = [
  { id: 'up-001', name: 'Backend Primary', url: 'http://127.0.0.1:3000', weight: 10, healthy: true, latency_ms: 12, requests: 148820, errors: 42 },
  { id: 'up-002', name: 'Backend Replica', url: 'http://127.0.0.1:3001', weight: 5, healthy: true, latency_ms: 15, requests: 62438, errors: 18 },
  { id: 'up-003', name: 'Canary (5%)', url: 'http://127.0.0.1:3002', weight: 1, healthy: false, latency_ms: 0, requests: 0, errors: 0 },
]

export const mockClusters: FingerprintCluster[] = [
  {
    fingerprint: 't13d1715h2_5b57614c22b0_93b4d1e30f4c',
    ips: ['185.220.101.45', '45.155.205.233', '194.165.16.77'],
    request_count: 1832,
    block_count: 641,
    last_seen_ms: Date.now() - 45000,
    risk_score: 87,
  },
  {
    fingerprint: 't13d190900h2_7c32d93a41e5_b2f8e1a7c9d3',
    ips: ['91.108.4.77', '2.56.57.100'],
    request_count: 544,
    block_count: 120,
    last_seen_ms: Date.now() - 120000,
    risk_score: 72,
  },
]

// Rolling request history buffer
const HISTORY_SIZE = 1000
export const eventHistory: LogEvent[] = []

export function addToHistory(event: LogEvent) {
  eventHistory.unshift(event)
  if (eventHistory.length > HISTORY_SIZE) eventHistory.pop()
  if (event.final_action === 'block') incrementL7Blocks()
}

// Pre-fill with some history
for (let i = 0; i < 50; i++) {
  const e = generateLogEvent()
  e.timestamp_ms = Date.now() - (50 - i) * 3000
  addToHistory(e)
}

// ─── Stats snapshot ───────────────────────────────────────────────────────────
export function buildStats(): StatsSnapshot {
  const recent = eventHistory.slice(0, 200)
  const blocked = recent.filter(e => e.final_action === 'block').length
  const challenged = recent.filter(e => e.final_action === 'challenge').length
  const allowed = recent.filter(e => e.final_action === 'allow').length

  const attackCounts: Record<string, number> = {}
  for (const e of recent) {
    for (const rule of e.matched_rule_ids) {
      attackCounts[rule] = (attackCounts[rule] ?? 0) + 1
    }
  }

  const ipCounts: Record<string, { count: number; action: string }> = {}
  for (const e of recent) {
    if (!ipCounts[e.client_ip]) ipCounts[e.client_ip] = { count: 0, action: e.final_action }
    ipCounts[e.client_ip].count++
  }
  const topIps = Object.entries(ipCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([ip, v]) => ({ ip, count: v.count, action: v.action }))

  const pathCounts: Record<string, number> = {}
  for (const e of recent) {
    pathCounts[e.path] = (pathCounts[e.path] ?? 0) + 1
  }
  const topPaths = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }))

  const tierCounts: Record<string, number> = {}
  for (const e of recent) {
    tierCounts[e.tier] = (tierCounts[e.tier] ?? 0) + 1
  }

  const avgLatency = recent.reduce((s, e) => s + e.latency_us, 0) / (recent.length || 1)
  const sorted = [...recent].sort((a, b) => b.latency_us - a.latency_us)
  const p99Latency = sorted[Math.floor(sorted.length * 0.01)]?.latency_us ?? 0

  // Build 60-point timeline (last 60 seconds)
  const timeline = Array.from({ length: 60 }, (_, i) => {
    const ts = Date.now() - (59 - i) * 1000
    return {
      ts,
      rps: rand(80, 350),
      block_rate: Math.random() * 25,
    }
  })

  return {
    total_requests: eventHistory.length,
    blocked,
    challenged,
    allowed,
    rate_limited: Math.floor(recent.length * 0.02),
    req_per_sec: rand(80, 350),
    p99_latency_us: p99Latency,
    avg_latency_us: Math.round(avgLatency),
    cache_hit_rate: 0.68,
    circuit_breaker: 'closed',
    attack_counts: attackCounts,
    top_ips: topIps,
    top_paths: topPaths,
    tier_counts: tierCounts,
    timeline,
    xdp_stats: getXdpStats(),
  }
}
