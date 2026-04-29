export type RuleAction = 'allow' | 'challenge' | 'block' | 'rate_limit' | 'xdp_stats'
export type ProtectionTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CATCH_ALL'

export interface JourneyHop {
  path: string
  method: string
  timestamp_ms: number
  response_status: number | null
  risk_delta: number
  anomaly_flags: string[]
  tier: string
}

export interface XdpStatsSnapshot {
  dropped_v4_pps: number
  dropped_v6_pps: number
  passed_pps: number
  total_dropped_v4: number
  total_dropped_v6: number
  xdp_enabled: boolean
  softirq_percent: number
  timestamp_ms: number
}

export interface LogEvent {
  request_id: string
  timestamp_ms: number
  client_ip: string
  real_ip: string
  tls_fingerprint: string
  composite_fingerprint: string
  session_id: string
  method: string
  path: string
  raw_path: string
  tier: string
  asn_category: string
  country_code: string
  user_agent: string
  matched_rule_ids: string[]
  risk_score_before: number
  risk_score_delta: number
  risk_score_after: number
  final_action: string
  response_status: number
  response_body_bytes: number
  latency_us: number
  cache_hit: boolean
  circuit_breaker_state: string
  journey_trail: JourneyHop[] | null
  fingerprint_cluster_size: number
  xdp_stats: XdpStatsSnapshot | null
  detected_protocol: string | null
}

export interface RiskThresholds {
  allow_below: number
  challenge_below: number
  block_above: number
  xdp_block_threshold: number
  xdp_block_ttl_secs: number
  decay_per_hour: number
}

export interface WafSettings {
  shadow_mode: boolean
  risk_thresholds: RiskThresholds
  challenge_type: string
  honeypot_paths: string[]
  block_stack_traces: boolean
  redact_fields: string[]
}

export interface TierConfig {
  patterns: string[]
  rate_limit: number
  burst_limit: number
  fail_open: boolean
  cache_responses: boolean
  cache_ttl: number | null
}

export interface CustomRule {
  id: string
  priority: number
  scope: string
  action: string
  risk_score_delta: number
  enabled: boolean
  description: string
  conditions: RuleCondition[]
  logic: 'AND' | 'OR'
  created_at: number
}

export interface RuleCondition {
  field: string
  operator: string
  value: string
  negate: boolean
}

export interface IpEntry {
  ip: string
  reason: string
  added_at: number
  expires_at: number | null
  hits: number
}

export interface FingerprintCluster {
  fingerprint: string
  ips: string[]
  request_count: number
  block_count: number
  last_seen_ms: number
  risk_score: number
}

export interface StatsSnapshot {
  total_requests: number
  blocked: number
  challenged: number
  allowed: number
  rate_limited: number
  req_per_sec: number
  p99_latency_us: number
  avg_latency_us: number
  cache_hit_rate: number
  circuit_breaker: string
  attack_counts: Record<string, number>
  top_ips: Array<{ ip: string; count: number; action: string }>
  top_paths: Array<{ path: string; count: number }>
  tier_counts: Record<string, number>
  timeline: Array<{ ts: number; rps: number; block_rate: number }>
  xdp_stats: XdpStatsSnapshot
}

export interface UpstreamConfig {
  id: string
  name: string
  url: string
  weight: number
  healthy: boolean
  latency_ms: number
  requests: number
  errors: number
}
