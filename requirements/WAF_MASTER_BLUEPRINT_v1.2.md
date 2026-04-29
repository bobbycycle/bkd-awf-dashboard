# WAF ENTERPRISE-GRADE 2026 — MASTER BLUEPRINT

> **Phiên bản:** 1.2 — Bổ sung Batch 9 (XDP/eBPF Layer 4 Shield + Telemetry), Batch 10 (WebSocket), Batch 11 (Protocol Enforcement & Anti-Tunneling)
> **Mục đích:** Tài liệu duy nhất chứa toàn bộ context để AI khác có thể review và ra quyết định kỹ thuật  
> **Scope:** Thể lệ chính thức → Phân tích kiến trúc → Implementation Plan → Execution Strategy  
> **Changelog v1.1:** Thêm `JourneyHop` struct + `journey_trail` vào LogEvent (WAF-013, WAF-001); Thêm `FingerprintRegistry` mới (WAF-004B); Thêm API `/intelligence/clusters` (WAF-021); Thêm UI `JourneyTimeline` + `LinkedEntitiesCard` (WAF-022); Cập nhật Red Team mapping, Dependency Graph, Checklist.
> **Changelog v1.2:** Thêm Batch 9 (WAF-026/027 — XDP/eBPF Layer 4 Shield + XDP Telemetry Bridge tái dùng SSE); Batch 10 (WAF-028/029 — WebSocket Handshake Guard + Frame Rate Limiter); Batch 11 (WAF-030/031/032 — ALPN Enforcement + gRPC L7 Filter + Protocol Guard Anti-Tunneling). Fix `WAF_XDP_STATS` sang `PerCpuArray` (tránh lock contention). Thêm `xdp_block_threshold` vào `RiskThresholds`. Reject gRPC internal API và CPU Savings Gauge ước tính. Cập nhật Dependency Graph, Red Team mapping, Checklist, Performance Budget.

---

## PHẦN 0: HƯỚNG DẪN ĐỌC TÀI LIỆU NÀY

Tài liệu được tổ chức theo luồng logic:

```
Phần 1: Thể lệ chính thức (nguồn sự thật duy nhất)
   ↓
Phần 2: Phân tích scoring + chiến lược đạt điểm tối đa
   ↓
Phần 3: Quyết định kiến trúc và lý do
   ↓
Phần 4: Shared Types Contract (foundation của mọi task)
   ↓
Phần 5: Implementation Plan — 32 tasks / 11 batches (chi tiết)
   ↓
Phần 6: Middleware execution order + dependency graph
   ↓
Phần 7: Red Team attack scenarios → defensive mapping
   ↓
Phần 8: AI execution strategy (model routing + cost)
   ↓
Phần 9: Known risks + mitigation
   ↓
Phần 10: Checklist trước khi demo
   ↓
Phần 11: [v1.1] User Journey Anomaly + Attack Graph — thiết kế chi tiết
   ↓
Phần 12: [v1.2] Batch 9 — XDP/eBPF Layer 4 Shield + Telemetry
   ↓
Phần 13: [v1.2] Batch 10 — WebSocket & Stateful Proxy
   ↓
Phần 14: [v1.2] Batch 11 — Protocol Enforcement & Anti-Tunneling
```

**Dành cho AI reviewer:** Mỗi task trong Phần 5 đều có `depends_on`, `output_files`, function signatures, và test specs. Hãy verify:
1. Dependency ordering có đúng không?
2. Type contracts có nhất quán không?
3. Có task nào thiếu để đáp ứng thể lệ không?
4. Có hidden async deadlock hay lock contention nào không?

---

## PHẦN 1: THỂ LỆ CHÍNH THỨC — TÓM TẮT ĐẦY ĐỦ

### 1.1 Thông tin cơ bản

| Thông số | Chi tiết |
|---|---|
| Sự kiện | WAF Mini Hackathon 2026 — Toàn công ty |
| Giải thưởng | Nhất $30K / Nhì $20K / Ba $10K / 3× KK $5K |
| Ngôn ngữ bắt buộc | **Rust 100% cho Core** (không exception). Dashboard: bất kỳ ngôn ngữ |
| Output bắt buộc | Single binary, `./waf run`, không Docker, không runtime dependency |
| Performance SLA | p99 latency overhead **≤ 5ms** \| throughput **≥ 5,000 req/s** |
| Attack Battle | 45 phút, tự động hoàn toàn, cấm can thiệp thủ công |
| Ban giám khảo | CEO, CTO, Tech Manager, Head of Security, Red Team |

### 1.2 Tiêu chí chấm điểm (Tổng: 120 điểm)

| # | Tiêu chí | Điểm | Nội dung đánh giá |
|---|---|---|---|
| 1 | **Security Effectiveness** | **40/120** | OWASP Top 5 coverage, device fingerprinting accuracy, behavioral anomaly detection, canary endpoint, brute force detection, error recon detection |
| 2 | **Performance** | **20/120** | p99 ≤ 5ms, throughput ≥ 5K req/s, memory footprint, behavior under DDoS |
| 3 | **Intelligence & Adaptiveness** | **20/120** | Risk score accuracy, transaction velocity & sequence, graceful degradation, fail-close/fail-open per endpoint |
| 4 | **Architecture & Code Quality** | **15/120** | Rust idiomatic patterns, error handling, documentation, test coverage |
| 5 | **Extensibility** | **10/120** | Rule hot-reload, per-scope rules (IP/user/session/device), priority resolution, plugin-ready |
| 6 | **Dashboard UI/UX** | **10/120** | Live request feed, attack visualization, hot config update, SIEM-compatible audit log |
| 7 | **Deployment & Operability** | **5/120** | Single binary, one-command startup, circuit breaker, fail behavior documented |

> **Critical:** Security Effectiveness = 33% tổng điểm. Đây là priority cao nhất.

### 1.3 Yêu cầu chức năng bắt buộc (Mục 5.2 — 10 chức năng)

| # | Chức năng | Mô tả kỹ thuật |
|---|---|---|
| 01 | **Rule Engine** | Match theo IP, Path, Header, Payload, Cookie. Hỗ trợ regex, wildcard, exact match, logical AND/OR |
| 02 | **Rate Limiting** | Sliding window per-IP **VÀ** per-user-session. Token bucket cho burst control |
| 03 | **DDoS Protection** | Burst detection + auto block. Fail-close cho CRITICAL tier, fail-open cho MEDIUM/CATCH-ALL |
| 04 | **Challenge Engine** | JS Challenge + Proof-of-Work. Adaptive: Allow/Challenge/Block theo risk score tích lũy |
| 05 | **Relay & Proxy Detection** | X-Forwarded-For chain validation, ASN classification (residential/datacenter/Tor) |
| 06 | **Whitelist + Blacklist** | IP & FQDN whitelist. Blacklist file load at startup (Tor exit list, bad ASN). Auto risk boost |
| 07 | **Smart Caching** | No-cache CRITICAL. Aggressive cache MEDIUM. TTL configurable per route |
| 08 | **Device Fingerprinting** | TLS JA3/JA4 + HTTP/2 settings + User-Agent entropy. Detect cùng device đổi IP |
| 09 | **Behavioral Anomaly** | Timing quá đều (bot), zero-depth session, thiếu Referer, interval < 50ms |
| 10 | **Transaction Velocity** | Login→OTP→Deposit trong N giây, withdrawal velocity, rapid limit-change pattern |

### 1.4 Attack Detection Coverage bắt buộc (Mục 5.3 — OWASP Top 5+)

| Attack Vector | Yêu cầu detection |
|---|---|
| **SQLi** | Classic, blind, time-based, UNION-based. Detect trong URL params, headers, JSON body |
| **XSS** | Reflected & stored. Script injection trong query string, form data, JSON |
| **Path Traversal** | `../` sequences, URL-encoded variants `%2e%2e`. Detect trong URL path & query params |
| **SSRF** | Request tới 10.x, 172.16.x, 192.168.x, 169.254.x, metadata endpoints |
| **Header Injection** | Host header injection, CRLF injection, X-Forwarded-For spoofing |
| **Brute Force / Credential Stuffing** | Per-user failed login counter, password spraying pattern |
| **Error Scanning / Recon** | Rapid 4xx/5xx pattern, endpoint enumeration, OPTIONS method abuse |
| **Request Body Abuse** | Malformed JSON, oversized payload, deeply nested object, content-type mismatch |

### 1.5 Rule System requirements (Mục 5.4)

- Hot-reload bắt buộc — không rebuild binary, không restart service
- Format: YAML hoặc TOML
- Rule schema bắt buộc: `condition (match)`, `action`, `risk_score_delta`
- Rule scope: global, per-tier, per-route-pattern, per-IP, per-user-session, per-device-fingerprint
- **Rule priority: numeric để resolve conflict**

### 1.6 Challenge & Risk Engine (Mục 5.5)

- Risk score tích lũy per `{IP + device fingerprint + session}` — không reset sau mỗi request
- Risk tăng khi: rule match, failed challenge, behavioral anomaly, ASN suspicious, fingerprint conflict
- Risk giảm khi: challenge thành công, sustained normal behavior
- Threshold: `score < 30 = Allow`, `30–70 = Challenge`, `> 70 = Block`
- **Canary/Honeypot:** hit = risk MAX + block IP ngay

### 1.7 Tiered Protection Policy

| Tier | Route | Policy | Fail Mode |
|---|---|---|---|
| **CRITICAL** | `/login`, `/otp`, `/deposit`, `/withdrawal` | Full stack + fingerprint + behavioral + velocity | **Fail-CLOSE** (deny all nếu WAF lỗi) |
| **HIGH** | `/game/*`, `/api/*`, `/user/*` | DDoS protection + OWASP + bot filter + caching | **Fail-OPEN** |
| **MEDIUM** | `/static/*`, `/assets/*`, `/public/*` | Rate limit + path traversal + aggressive cache | **Fail-OPEN** |
| **CATCH-ALL** | `/**` | Baseline SQLi/XSS + rate limit + blacklist + log all | **Fail-OPEN** |

### 1.8 Red Team Attack Scenarios (Mục 7)

| # | Attack Vector | Kỹ thuật |
|---|---|---|
| 01 | **DDoS Layer 4 & 7** | TCP flooding, HTTP flood, **Slowloris**, **RUDY**. DDoS nhắm vào chính WAF |
| 02 | **Bot Login & Credential Stuffing** | Brute force, password spraying từ nhiều IP, IP rotation |
| 03 | **Relay & Proxy Attack** | Proxy chain injection, abnormal XFF, VPN/Tor exit node |
| 04 | **Device Fingerprint Evasion** | Thay đổi TLS fingerprint, rotate User-Agent, giả mạo residential IP |
| 05 | **Behavioral Bypass** | Zero-depth session attack, perfectly-timed bot, giả mạo Referer |
| 06 | **Transaction Fraud** | Login→Deposit < 5s, withdrawal ngay sau deposit, rapid limit-change |
| 07 | **OWASP Injection** | SQLi blind/time-based, XSS trong JSON body, SSRF, path traversal |
| 08 | **Canary / Recon Scan** | Endpoint enumeration, honeypot scan, OPTIONS abuse, error harvesting |

### 1.9 Quy định nghiêm cấm (vi phạm = loại ngay)

- ✕ Dữ liệu giả / demo fake
- ✕ Hardcode rule để vượt test case cụ thể
- ✕ Can thiệp thủ công trong Attack Battle
- ✕ Tấn công sandbox của đội khác

---

## PHẦN 2: PHÂN TÍCH CHIẾN LƯỢC ĐẠT ĐIỂM TỐI ĐA

### 2.1 Coverage matrix — Mỗi task đóng góp vào tiêu chí nào

```
Security Effectiveness (40đ):
  WAF-011 (OWASP Scanner)          → SQLi, XSS, SSRF, Path Traversal, Header Injection
  WAF-013 (Behavioral Engine)      → Brute Force, Zero-Depth, Timing Anomaly, Recon
  WAF-004 (TLS Fingerprint)        → Device Fingerprinting accuracy
  WAF-008 (Router + Honeypot)      → Canary endpoint
  WAF-015 (Challenge Engine)       → Challenge accuracy
  WAF-012 (Custom Rule Engine)     → Rule coverage breadth
  [v1.2] WAF-026/027 (XDP)         → Layer 4 DDoS defense trước kernel TCP stack
  [v1.2] WAF-028/029 (WebSocket)   → Modern app attack surface coverage
  [v1.2] WAF-030/031/032 (Protocol)→ Anti-tunneling, ALPN, gRPC inspection

Performance (20đ):
  WAF-003 (Pingora Skeleton)       → Sub-ms forwarding baseline
  WAF-009 (Rate Limiter - moka)    → O(1) rate check, no sweep thread
  WAF-018 (Smart Cache)            → Reduce backend load under DDoS
  WAF-025 (Integration)            → Load test validation
  [v1.2] WAF-026 (XDP)             → Drop L4 floods at NIC — zero CPU cost

Intelligence & Adaptiveness (20đ):
  WAF-014 (Risk Engine)            → Score accuracy
  WAF-013 (Behavioral)             → Velocity tracking, sequence detection
  WAF-016 (Circuit Breaker)        → Graceful degradation
  WAF-008 (Router)                 → Fail-close/fail-open per tier
  [v1.2] WAF-027 (XDP Controller)  → Auto-promote score > 90 to L4 block

Architecture & Code Quality (15đ):
  ALL tasks                        → No unwrap/expect, proper error handling
  WAF-025 (Integration Tests)      → Test coverage
  Shared Types Contract            → Type consistency
  [v1.2] Workspace split           → waf-core/waf-ebpf clean separation

Extensibility (10đ):
  WAF-012 (Custom Rule Engine)     → AND/OR logic, priority resolution
  WAF-002 (Config Watcher)         → Hot-reload
  WAF-001 (Rule Schema)            → Per-scope rules

Dashboard (10đ):
  WAF-022 (React UI)               → Live feed, attack visualization
  WAF-021 (Dashboard Backend)      → Hot config, panic button
  WAF-005 (Audit Logger)           → SIEM-compatible JSON
  [v1.2] XdpShieldPanel            → L4 vs L7 blocking ratio, drop rate, SoftIRQ %

Deployment (5đ):
  WAF-025 (main.rs + ./waf run)    → Single binary, one-command
  WAF-016 (Circuit Breaker)        → Upstream protection
```

### 2.2 Minimum viable vs. full implementation

**Để không bị loại (≥ 60/120):**
- WAF-001 to WAF-003: Foundation
- WAF-008, WAF-009: Basic routing + rate limiting
- WAF-011: OWASP scanner (phải có SQLi/XSS tối thiểu)
- WAF-005, WAF-022: Logging + Dashboard basic

**Để thắng (≥ 100/120):**
- Tất cả 32 tasks hoàn chỉnh
- Integration tests pass
- Load test đạt 5K req/s p99 ≤ 5ms
- Challenge Engine hoạt động thực sự (không mock)
- Dashboard live với real data từ WAF
- XDP hoạt động với graceful fallback khi không support

---

## PHẦN 3: QUYẾT ĐỊNH KIẾN TRÚC VÀ LÝ DO

### 3.1 Pingora thay vì hyper raw

**Quyết định:** Dùng Cloudflare Pingora làm proxy foundation.

**Lý do:**
- Pingora xử lý HTTP/1.1, HTTP/2, TLS, connection pooling, graceful reload — tất cả built-in
- Performance đã được battle-test ở 40M req/s tại Cloudflare
- Tiết kiệm ~2 tuần code proxy từ đầu
- TLS termination có sẵn (cần cho JA4 fingerprinting)

**Trade-off:**
- Ít training data hơn trong LLM → cần feed docs/examples vào prompt khi dùng AI
- Pingora dùng `ProxyHttp` trait, không phải `tower::Service` — AI agent phải được inform rõ
- Phiên bản hiện tại: 0.8.x (MSRV: Rust 1.84)

**Pingora ProxyHttp trait — hooks cần implement:**
```rust
#[async_trait]
impl ProxyHttp for WafProxy {
    type CTX = WafRequestContext;

    async fn request_filter(&self, session: &mut Session, ctx: &mut CTX) 
        -> Result<bool>;
    // true = short-circuit (đã gửi response), false = tiếp tục forward

    async fn upstream_peer(&self, session: &mut Session, ctx: &mut CTX) 
        -> Result<Box<HttpPeer>>;

    async fn response_filter(&self, session: &mut Session, 
        upstream_response: &mut ResponseHeader, ctx: &mut CTX) -> Result<()>;

    async fn response_body_filter(&self, session: &mut Session, 
        body: &mut Option<Bytes>, end_of_stream: bool, ctx: &mut CTX)
        -> Result<Option<Duration>>;

    async fn logging(&self, session: &mut Session, 
        error: Option<&Error>, ctx: &mut CTX);
}
```

### 3.2 moka thay DashMap cho rate limiting và caching

- `moka::future::Cache` → Rate limiter buckets, Response cache, Session state (TTL eviction built-in)
- `DashMap` → Risk profiles, TLS fingerprint registry, XDP blocklist state (persistent, manual eviction)

### 3.3 arc-swap cho lock-free config hot-reload

```rust
let guard = config_state.get_current(); // ArcSwap guard — zero lock, zero copy
config_state.update_config(new_config); // Atomic pointer swap
```

### 3.4 tokio::sync::mpsc cho audit logging

KHÔNG dùng `crossbeam_channel::bounded` — blocking trong async context = deadlock. Dùng `try_send()` non-blocking, drop event khi channel full.

### 3.5 Tại sao CẦN Custom Rule Engine (Extensibility = 10đ)

Thể lệ mục 5.4 yêu cầu `condition`, `action`, `risk_score_delta`, scope per-device. Nếu chỉ có OWASP scanner sẽ mất toàn bộ 10 điểm Extensibility.

### 3.6 [v1.2] Workspace split cho XDP/eBPF

eBPF Rust yêu cầu target `bpfel-unknown-none` (nightly toolchain). Pingora build trên stable Rust. Bắt buộc tách workspace:

```
waf/
├── Cargo.toml          # workspace root
├── waf-core/           # Pingora proxy — stable Rust
├── waf-ebpf/           # XDP kernel program — nightly, bpfel-unknown-none
└── xtask/              # Build orchestration
```

### 3.7 [v1.2] PerCpuArray cho XDP stats — KHÔNG dùng HashMap

`BPF_MAP_TYPE_PERCPU_ARRAY` tránh lock contention: mỗi CPU core ghi vào slot riêng, không cần atomic. Userspace sum tất cả per-CPU values.

```rust
// ❌ SAI — HashMap cần atomic khi nhiều CPU cùng write
static WAF_XDP_STATS: HashMap<u32, u64> = HashMap::with_max_entries(8, 0);

// ✅ ĐÚNG — per-core isolation, no lock
static WAF_XDP_STATS: PerCpuArray<u64> = PerCpuArray::with_max_entries(3, 0);
// index 0 = dropped_v4, 1 = dropped_v6, 2 = passed
```

### 3.8 [v1.2] XDP threshold KHÁC với WAF block threshold

XDP block không có Challenge fallback, TTL-based, không thể serve PoW. Phải dùng ngưỡng cao hơn:
- WAF L7 block: `score > 70` (có thể challenge trước)
- XDP L4 hard block: `score > 90` (chắc chắn hơn, kèm TTL 1 giờ)

### 3.9 [v1.2] XDP Telemetry tái dùng SSE Bridge — KHÔNG tạo REST polling mới

Stats Collector đọc PerCpuArray mỗi 1s → push `XdpStatsSnapshot` vào `AuditLogger` channel (đã có từ WAF-005) → SSE bridge (WAF-020) broadcast đến Dashboard. Không cần endpoint mới, không gRPC internal (over-engineering).

`softirq_percent` lấy từ `/proc/stat` thực tế — KHÔNG dùng hằng số ước tính (không defend được khi BTC hỏi).

---

## PHẦN 4: SHARED TYPES CONTRACT

> **Quy tắc:** File này được tạo trong WAF-001. Mọi task sau PHẢI import từ đây.  
> **Không được:** Tự define type trong module riêng nếu đã có trong types.rs.

**File: `src/types.rs`**

```rust
use std::collections::HashMap;
use std::net::IpAddr;
use std::time::{Duration, Instant};

// ============================================================
// ENUMS
// ============================================================

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum ProtectionTier { Critical, High, Medium, CatchAll }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum RuleAction { Allow, Challenge, Block, RateLimit }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum FailMode { Open, Close }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ChallengeType { ProofOfWork, JsChallenge }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum RuleOperator { Eq, Contains, Regex, StartsWith, Gt, Lt, IpInCidr }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum RuleField {
    Ip, Path, QueryParam(String), Header(String), Cookie(String),
    Body, Method, UserAgent, Fingerprint, SessionId, AsnCategory
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum RuleLogic { And, Or }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub enum AsnCategory { Residential, Datacenter, Tor, Vpn, Unknown }

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum RuleScope {
    Global,
    Tier(ProtectionTier),
    Route(String),
    Ip(String),
    Session(String),
    Fingerprint(String),
}

// ============================================================
// CONFIG STRUCTS
// ============================================================

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WafConfig {
    pub listen_addr: String,
    pub backend_url: String,
    pub tls: Option<TlsConfig>,
    pub global_rate_limit: u32,
    pub max_body_bytes: u64,
    pub json_max_depth: u32,
    pub routes: Vec<RoutePolicy>,
    pub honeypot_routes: Vec<String>,
    pub connection_timeouts: TimeoutConfig,
    pub whitelist_file: Option<String>,
    pub blacklist_file: Option<String>,
    pub tor_exit_list_file: Option<String>,
    pub geoip_db_path: Option<String>,
    pub challenge_secret: String,
    pub risk_thresholds: RiskThresholds,
    pub redact_fields: Vec<String>,
    // [v1.2] WebSocket
    pub ws_allowed_origins: Vec<String>,       // empty = allow all
    pub ws_allowed_protocols: Vec<String>,     // empty = allow all
    pub ws_max_frames_per_second: u32,         // default: 100
    // [v1.2] Protocol enforcement
    pub allowed_alpn: Vec<String>,             // empty = no restriction. e.g. ["h2", "http/1.1"]
    // [v1.2] XDP
    pub xdp_interface: Option<String>,         // e.g. "eth0" — None = XDP disabled
    pub xdp_pin_path: Option<String>,          // e.g. "/sys/fs/bpf/waf"
}

impl Default for WafConfig {
    fn default() -> Self {
        Self {
            listen_addr: "0.0.0.0:8080".into(),
            backend_url: "http://127.0.0.1:3000".into(),
            tls: None,
            global_rate_limit: 100,
            max_body_bytes: 1_048_576,
            json_max_depth: 10,
            routes: vec![],
            honeypot_routes: vec![],
            connection_timeouts: TimeoutConfig::default(),
            whitelist_file: None,
            blacklist_file: None,
            tor_exit_list_file: None,
            geoip_db_path: None,
            challenge_secret: "changeme-in-production".into(),
            risk_thresholds: RiskThresholds::default(),
            redact_fields: vec!["card_number".into(), "bank_account".into(), "ssn".into()],
            ws_allowed_origins: vec![],
            ws_allowed_protocols: vec![],
            ws_max_frames_per_second: 100,
            allowed_alpn: vec![],
            xdp_interface: None,
            xdp_pin_path: None,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TlsConfig {
    pub cert_path: String,
    pub key_path: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RoutePolicy {
    pub path_pattern: String,
    pub tier: ProtectionTier,
    pub default_action: RuleAction,
    pub rate_limit: Option<u32>,
    pub session_rate_limit: Option<u32>,
    pub fail_mode: FailMode,
    pub max_body_bytes: Option<u64>,
    pub challenge_type: Option<ChallengeType>,
    pub strip_response_headers: Vec<String>,
    pub cache_ttl_secs: Option<u64>,
    // [v1.2] per-route ALPN override
    pub allowed_alpn: Option<Vec<String>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TimeoutConfig {
    pub connect_ms: u64,
    pub header_read_ms: u64,
    pub body_read_ms: u64,
    pub backend_response_ms: u64,
    pub keepalive_secs: u64,
}

impl Default for TimeoutConfig {
    fn default() -> Self {
        Self { connect_ms: 5000, header_read_ms: 10000,
               body_read_ms: 30000, backend_response_ms: 15000, keepalive_secs: 60 }
    }
}

/// [v1.2] Thêm xdp_block_threshold và xdp_block_ttl_secs
/// XDP threshold PHẢI cao hơn block_above vì XDP block không có Challenge fallback
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RiskThresholds {
    pub allow_below: u32,         // default: 30
    pub block_above: u32,         // default: 70 — WAF Layer 7 block (có thể challenge trước)
    pub xdp_block_threshold: u32, // default: 90 — XDP Layer 4 hard block (không challenge, TTL-based)
    pub xdp_block_ttl_secs: u64,  // default: 3600 — bao lâu XDP block entry tồn tại
    pub decay_per_hour: u32,      // default: 10
}

impl Default for RiskThresholds {
    fn default() -> Self {
        Self { allow_below: 30, block_above: 70, xdp_block_threshold: 90,
               xdp_block_ttl_secs: 3600, decay_per_hour: 10 }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CustomRule {
    pub id: String,
    pub priority: u32,
    pub scope: RuleScope,
    pub conditions: Vec<RuleCondition>,
    pub logic: RuleLogic,
    pub action: RuleAction,
    pub risk_score_delta: i32,
    pub enabled: bool,
    pub description: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RuleCondition {
    pub field: RuleField,
    pub operator: RuleOperator,
    pub value: String,
    pub negate: bool,
}

// ============================================================
// RUNTIME STRUCTS (per-request, not serialized)
// ============================================================

#[derive(Debug, Clone)]
pub struct NormalizedRequest {
    pub request_id: String,
    pub method: String,
    pub path: String,
    pub raw_path: String,
    pub query_params: String,
    pub headers: Vec<(String, String)>,
    pub cookies: HashMap<String, String>,
    pub body_bytes: Vec<u8>,
    pub body_text: Option<String>,
    pub client_ip: IpAddr,
    pub real_ip: IpAddr,
    pub tls_fingerprint: Option<String>,
    pub http2_fingerprint: Option<String>,
    pub composite_fingerprint: Option<String>,
    pub session_id: Option<String>,
    pub user_agent: String,
    pub asn_category: AsnCategory,
    pub country_code: Option<String>,
    pub is_whitelisted: bool,
    pub timestamp: Instant,
    pub inspection_results: Vec<InspectionResult>,
    pub matched_route: Option<RoutePolicy>,
    // [v1.2] Protocol fields
    pub is_websocket_upgrade: bool,
    pub negotiated_alpn: Option<String>,
    pub connection_preface_bytes: Option<Vec<u8>>,  // first 16 bytes for protocol guard
}

#[derive(Debug, Clone)]
pub struct InspectionResult {
    pub rule_id: String,
    pub risk_delta: i32,
    pub recommended_action: RuleAction,
    pub reason: String,
    pub field_matched: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct JourneyHop {
    pub path: String,
    pub method: String,
    pub timestamp_ms: u64,
    pub response_status: Option<u16>,
    pub risk_delta: i32,
    pub anomaly_flags: Vec<String>,
    pub tier: String,
}

/// [v1.2] XDP stats snapshot — pushed vào SSE bridge mỗi 1 giây qua AuditLogger channel
/// softirq_percent lấy từ /proc/stat thực tế — KHÔNG dùng hằng số ước tính
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct XdpStatsSnapshot {
    pub dropped_v4_pps: f64,    // packets/sec IPv4 dropped — delta so với giây trước
    pub dropped_v6_pps: f64,    // packets/sec IPv6 dropped
    pub passed_pps: f64,        // packets/sec passed through XDP
    pub total_dropped_v4: u64,  // cumulative since XDP load
    pub total_dropped_v6: u64,
    pub xdp_enabled: bool,      // false = XDP not loaded / not supported on this host
    pub softirq_percent: f64,   // real value from /proc/stat — NOT an estimate
    pub timestamp_ms: u64,
}

/// SIEM-compatible structured log entry
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LogEvent {
    pub request_id: String,
    pub timestamp_ms: u64,
    pub client_ip: String,
    pub real_ip: String,
    pub tls_fingerprint: String,
    pub composite_fingerprint: String,
    pub session_id: String,
    pub method: String,
    pub path: String,
    pub raw_path: String,
    pub tier: String,
    pub asn_category: String,
    pub country_code: String,
    pub user_agent: String,
    pub matched_rule_ids: Vec<String>,
    pub risk_score_before: u32,
    pub risk_score_delta: i32,
    pub risk_score_after: u32,
    pub final_action: String,
    pub response_status: u16,
    pub response_body_bytes: u64,
    pub latency_us: u64,
    pub cache_hit: bool,
    pub circuit_breaker_state: String,
    // [v1.1] User Journey Anomaly
    pub journey_trail: Option<Vec<JourneyHop>>,
    // [v1.1] Attack Graph
    pub fingerprint_cluster_size: u32,
    // [v1.2] XDP telemetry — Some chỉ khi final_action == "xdp_stats" (synthetic event từ collector)
    pub xdp_stats: Option<XdpStatsSnapshot>,
    // [v1.2] Protocol detection
    pub detected_protocol: Option<String>, // "http1"|"http2"|"websocket"|"grpc"|"tunnel_ssh"|...
}

/// Per-request context attached to Pingora session
#[derive(Debug)]
pub struct WafRequestContext {
    pub request_id: String,
    pub start_time: Instant,
    pub client_ip: Option<IpAddr>,
    pub normalized_req: Option<NormalizedRequest>,
    pub matched_route: Option<RoutePolicy>,
    pub inspection_results: Vec<InspectionResult>,
    pub risk_score_before: u32,
    pub risk_delta_total: i32,
    pub risk_score_after: u32,
    pub final_action: RuleAction,
    pub response_status: Option<u16>,
    pub response_body_bytes: u64,
    pub cache_hit: bool,
    pub session_id: Option<String>,
    pub new_session: bool,
    pub challenge_token: Option<String>,
    // [v1.2]
    pub is_websocket: bool,
    pub detected_protocol: Option<String>,
}

impl WafRequestContext {
    pub fn new() -> Self {
        Self {
            request_id: uuid::Uuid::new_v4().to_string(),
            start_time: Instant::now(),
            client_ip: None,
            normalized_req: None,
            matched_route: None,
            inspection_results: vec![],
            risk_score_before: 0,
            risk_delta_total: 0,
            risk_score_after: 0,
            final_action: RuleAction::Allow,
            response_status: None,
            response_body_bytes: 0,
            cache_hit: false,
            session_id: None,
            new_session: false,
            challenge_token: None,
            is_websocket: false,
            detected_protocol: None,
        }
    }

    pub fn risk_key(&self) -> String {
        if let Some(req) = &self.normalized_req {
            if let Some(fp) = &req.composite_fingerprint {
                return format!("{}:{}", req.real_ip, fp);
            }
            return req.real_ip.to_string();
        }
        self.client_ip.map(|ip| ip.to_string()).unwrap_or_else(|| "unknown".into())
    }
}

// ============================================================
// ERROR TYPES
// ============================================================

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
}

#[derive(Debug, thiserror::Error)]
pub enum WafError {
    #[error("Proxy error: {0}")]
    ProxyError(String),
    #[error("Config error: {0}")]
    ConfigError(#[from] ConfigError),
    #[error("Fingerprint error: {0}")]
    FingerprintError(String),
}
```

---

## PHẦN 5: IMPLEMENTATION PLAN — 32 TASKS / 11 BATCHES

### Cargo.toml (workspace root)

```toml
[workspace]
members = ["waf-core", "waf-ebpf", "xtask"]
resolver = "2"
```

### waf-core/Cargo.toml Dependencies

```toml
[package]
name = "waf-core"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "waf"
path = "src/main.rs"

[dependencies]
pingora = { version = "0.8", features = ["lb"] }
pingora-core = "0.8"
pingora-proxy = "0.8"
pingora-http = "0.8"
tokio = { version = "1", features = ["full"] }
async-trait = "0.1"
arc-swap = "1"
moka = { version = "0.12", features = ["future"] }
dashmap = "5"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
regex = "1"
md-5 = "0.10"
sha2 = "0.10"
hmac = "0.12"
hex = "0.4"
ipnet = "2"
notify = "6"
maxminddb = "0.24"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json"] }
prometheus = { version = "0.13", features = ["process"] }
uuid = { version = "1", features = ["v4"] }
clap = { version = "4", features = ["derive"] }
thiserror = "1"
anyhow = "1"
indexmap = "2"
bytes = "1"
# [v1.2] aya cho XDP userspace control
aya = { version = "0.13", features = ["async_tokio"] }
aya-log = "0.2"

[dev-dependencies]
tokio-test = "0.4"
reqwest = { version = "0.12", features = ["json"] }
```

### waf-ebpf/Cargo.toml

```toml
[package]
name = "waf-ebpf"
version = "0.1.0"
edition = "2021"

[dependencies]
aya-ebpf = "0.1"
aya-log-ebpf = "0.1"

[profile.release]
opt-level = 3
lto = true
```

---

### 📦 BATCH 1: PINGORA FOUNDATION (5 tasks — chạy tuần tự)

#### WAF-001: Project Setup + Types + Config Parser

```yaml
priority: CRITICAL
depends_on: []
output_files:
  - src/types.rs          # Shared Types Contract (toàn bộ nội dung Phần 4)
  - src/config/models.rs  # Re-export từ types.rs
  - src/config/parser.rs
  - config/waf_rules.yaml
  - config/custom_rules.yaml
```

**Function signatures cần implement:**

```rust
pub fn parse_waf_config(yaml_str: &str) -> Result<WafConfig, ConfigError>;
pub fn parse_custom_rules(yaml_str: &str) -> Result<Vec<CustomRule>, ConfigError>;
pub fn load_config_file(path: &std::path::Path) -> Result<WafConfig, ConfigError>;
fn validate_config(config: &WafConfig) -> Result<(), ConfigError>;
// Validation: no duplicate path_pattern, rate_limit > 0, json_max_depth > 0,
// backend_url valid URI, challenge_secret.len() >= 16
// [v1.2] xdp_block_threshold > block_above (XDP ngưỡng phải cao hơn WAF ngưỡng)
```

**Tests bắt buộc:**
```rust
#[test] fn test_parse_valid_yaml()
#[test] fn test_parse_missing_routes_returns_error()
#[test] fn test_duplicate_path_pattern_returns_validation_error()
#[test] fn test_rate_limit_zero_returns_validation_error()
#[test] fn test_default_timeouts_correct()
#[test] fn test_parse_custom_rules_with_and_logic()
#[test] fn test_parse_custom_rules_with_or_logic()
#[test] fn test_rule_scope_types()
// [v1.2]
#[test] fn test_xdp_threshold_must_exceed_block_above()
// xdp_block_threshold=70 với block_above=70 → validation error
```

---

#### WAF-002: Lock-free Config State + Filesystem Watcher

```yaml
priority: CRITICAL
depends_on: [WAF-001]
output_files:
  - src/config/state.rs
  - src/config/watcher.rs
```

```rust
pub struct ConfigState {
    pub config: Arc<ArcSwap<WafConfig>>,
    pub rules: Arc<ArcSwap<Vec<CustomRule>>>,
}

impl ConfigState {
    pub fn new(config: WafConfig, rules: Vec<CustomRule>) -> Self;
    pub fn update_config(&self, new_config: WafConfig);
    pub fn update_rules(&self, new_rules: Vec<CustomRule>);
    pub fn get_config(&self) -> arc_swap::Guard<Arc<WafConfig>>;
    pub fn get_rules(&self) -> arc_swap::Guard<Arc<Vec<CustomRule>>>;
}

pub async fn spawn_config_watcher(
    config_path: std::path::PathBuf,
    rules_path: std::path::PathBuf,
    state: ConfigState,
) -> Result<(), WafError>;
// Debounce: ignore events within 500ms
```

**Tests bắt buộc:**
```rust
#[tokio::test] async fn test_concurrent_reads_during_update()
#[tokio::test] async fn test_watcher_updates_config_on_file_change()
#[tokio::test] async fn test_watcher_preserves_config_on_invalid_yaml()
```

---

#### WAF-003: Pingora Proxy Skeleton

```yaml
priority: CRITICAL
depends_on: [WAF-001]
output_files:
  - src/proxy/server.rs
  - src/proxy/context.rs
```

**QUAN TRỌNG:** Pingora dùng `ProxyHttp` trait, KHÔNG phải tower::Service.

```rust
pub struct WafProxy {
    pub config_state: ConfigState,
    pub middlewares: Arc<WafMiddlewares>,
}

pub struct WafMiddlewares {
    pub reputation_db: Arc<IpReputationDB>,
    pub geoip: Arc<GeoIpClassifier>,
    pub rate_limiter: Arc<RateLimiter>,
    pub session_tracker: Arc<SessionTracker>,
    pub risk_engine: Arc<RiskEngine>,
    pub challenge_engine: Arc<ChallengeEngine>,
    pub circuit_breaker: Arc<CircuitBreaker>,
    pub response_cache: Arc<ResponseCache>,
    pub audit_logger: Arc<AuditLogger>,
    pub metrics: Arc<MetricsCollector>,
    pub fp_registry: Arc<FingerprintRegistry>,    // [v1.1]
    // [v1.2]
    pub xdp_controller: Arc<XdpBlocklistController>,
    pub ws_tracker: Arc<WsSessionTracker>,
}
```

**Tests bắt buộc:**
```rust
#[tokio::test] async fn test_proxy_forwards_get_request()
#[tokio::test] async fn test_proxy_forwards_post_with_body()
#[tokio::test] async fn test_request_filter_short_circuit_on_block()
```

---

#### WAF-004: TLS Fingerprint Capture

```yaml
priority: HIGH
depends_on: [WAF-003]
output_files:
  - src/security/fingerprint.rs
```

```rust
pub fn compute_ja4_hash(info: &ClientHelloInfo) -> String;
pub fn extract_from_session_digest(session: &Session) -> Option<String>;
pub fn compute_h2_fingerprint(...) -> String;
pub fn compute_composite_fingerprint(ja4: &str, h2_fp: &str, user_agent: &str) -> String;
pub fn fingerprint_or_default(session: &Session) -> String;
// [v1.2] Thêm: extract ALPN từ session digest
pub fn extract_alpn_from_session(session: &Session) -> Option<String>;
```

**Tests bắt buộc:**
```rust
#[test] fn test_chrome_vs_python_produce_different_hashes()
#[test] fn test_same_input_always_produces_same_hash()
#[test] fn test_composite_fingerprint_with_different_h2_settings()
```

---

#### WAF-004B: Fingerprint Registry (IP Rotation Detection) [v1.1]

```yaml
priority: HIGH
depends_on: [WAF-004]
output_files:
  - src/security/fp_registry.rs
```

```rust
pub struct FingerprintRegistry {
    clusters: DashMap<String, FingerprintCluster>,
    ip_to_fp: DashMap<IpAddr, String>,
}

impl FingerprintRegistry {
    pub fn new() -> Self;
    pub fn record(&self, ip: IpAddr, fingerprint: &str);
    pub fn get_cluster_ips(&self, fingerprint: &str) -> Vec<IpAddr>;
    pub fn cluster_size(&self, fingerprint: &str) -> usize;
    pub fn get_fingerprint_for_ip(&self, ip: &IpAddr) -> Option<String>;
    pub fn top_clusters(&self, limit: usize) -> Vec<FingerprintCluster>;
    pub fn evict_stale(&self, ttl_secs: u64);
}
// Risk delta: min((cluster_size - 1) * 10, 50)
```

**Tests bắt buộc:**
```rust
#[test] fn test_record_single_ip_single_fp()
#[test] fn test_record_multiple_ips_same_fp()
#[test] fn test_record_deduplication()
#[test] fn test_ip_cap_at_1000()
#[test] fn test_reverse_lookup()
#[test] fn test_top_clusters_sorted_desc()
#[test] fn test_evict_stale_removes_old_clusters()
#[test] fn test_concurrent_record_no_panic()
```

---

#### WAF-005: Async Non-blocking Audit Logger

```yaml
priority: HIGH
depends_on: [WAF-001]
output_files:
  - src/telemetry/logger.rs
```

```rust
pub struct AuditLogger {
    sender: tokio::sync::mpsc::Sender<LogEvent>,
    dropped_count: Arc<AtomicU64>,
}

impl AuditLogger {
    pub fn new(log_file_path: std::path::PathBuf, buffer_size: usize) -> Self;
    pub async fn log(&self, event: LogEvent);  // try_send — non-blocking
    pub fn dropped_count(&self) -> u64;
    pub async fn shutdown(&self);
}
// [v1.2] AuditLogger nhận cả XdpStatsSnapshot events (LogEvent với xdp_stats: Some(...))
// SSE bridge sẽ filter và broadcast chúng như telemetry stream riêng
```

**Tests bắt buộc:**
```rust
#[tokio::test] async fn test_100_events_all_in_file()
#[tokio::test] async fn test_overflow_drops_gracefully()
#[tokio::test] async fn test_proxy_not_blocked()
```

---

### 📦 BATCH 2: TRAFFIC CONTROL + INTELLIGENCE (5 tasks — parallel)

#### WAF-006: IP Reputation Database

```yaml
priority: HIGH
depends_on: [WAF-001]
output_files:
  - src/security/reputation.rs
```

```rust
pub enum ReputationResult { Whitelisted, Blacklisted, TorExit, BadAsn, Unknown }

pub struct IpReputationDB {
    whitelist: Vec<IpNet>,
    blacklist: Vec<IpNet>,
    tor_exits: std::collections::HashSet<IpAddr>,
}

impl IpReputationDB {
    pub fn load(config: &WafConfig) -> Result<Self, WafError>;
    pub fn check(&self, ip: &IpAddr) -> ReputationResult;
    pub fn reload(&mut self, config: &WafConfig) -> Result<(), WafError>;
}
```

---

#### WAF-007: ASN/GeoIP Classifier + XFF Validator

```yaml
priority: HIGH
depends_on: [WAF-001]
output_files:
  - src/security/geoip.rs
```

```rust
pub struct GeoIpClassifier { ... }

impl GeoIpClassifier {
    pub fn new(config: &WafConfig) -> Result<Self, WafError>;
    pub fn classify(&self, ip: &IpAddr) -> IpClassification;
}

pub fn extract_real_ip(
    xff_header: Option<&str>,
    direct_ip: IpAddr,
    trusted_proxies: &[IpNet],
) -> (IpAddr, bool); // (real_ip, is_xff_suspicious)
```

---

#### WAF-008: Tiered Router + Honeypot Check

```yaml
priority: HIGH
depends_on: [WAF-001, WAF-003]
output_files:
  - src/proxy/router.rs
```

```rust
pub fn determine_route(path: &str, config: &WafConfig) -> RoutePolicy;
pub fn is_honeypot(path: &str, config: &WafConfig) -> bool;
fn catchall_policy(config: &WafConfig) -> RoutePolicy;
```

---

#### WAF-009: Rate Limiter

```yaml
priority: HIGH
depends_on: [WAF-001]
output_files:
  - src/security/rate_limit.rs
```

```rust
pub trait Clock: Send + Sync + 'static { fn now_secs(&self) -> u64; }

pub struct RateLimiter<C: Clock = SystemClock> { ... }

impl<C: Clock> RateLimiter<C> {
    pub fn new(clock: C) -> Self;
    pub async fn check(&self, key: &str, max_per_minute: u32) -> bool;
    pub fn blocked_count(&self) -> u64;
}
```

**Tests bắt buộc:**
```rust
#[tokio::test] async fn test_burst_limit_exact()
#[tokio::test] async fn test_window_reset_after_60_secs()
#[tokio::test] async fn test_independent_buckets_per_key()
#[tokio::test] async fn test_session_rate_limit_independent_from_ip()
```

---

#### WAF-010: Deep Normalizer

```yaml
priority: HIGH
depends_on: [WAF-001]
output_files:
  - src/security/normalize.rs
```

```rust
pub fn recursive_url_decode(input: &str) -> String;
pub fn normalize_path(raw_path: &str) -> String;
pub fn decode_html_entities(input: &str) -> String;
pub fn detect_header_injection(value: &str) -> bool;
pub fn validate_json_body(body: &[u8], max_depth: u32) -> Result<String, NormalizeError>;
pub fn build_normalized_request(...) -> (NormalizedRequest, Vec<InspectionResult>);
```

**Tests:**
```rust
#[test] fn test_double_url_encoding()
#[test] fn test_path_traversal_resolve()
#[test] fn test_html_entity_decode()
#[test] fn test_json_depth_exceeded()
#[test] fn test_content_type_mismatch()
#[test] fn test_header_injection_detected()
```

---

### 📦 BATCH 3: STATIC THREAT ENGINE (2 tasks — parallel)

#### WAF-011: OWASP Regex Scanner

```yaml
priority: CRITICAL
depends_on: [WAF-001, WAF-010]
output_files:
  - src/security/scanner.rs
```

```rust
static SCAN_PATTERNS: OnceLock<ScanPatterns> = OnceLock::new();
// Compiled ONCE at startup — SQLi, XSS, Path Traversal, SSRF, Header Injection

pub fn scan_request(req: &NormalizedRequest) -> Vec<InspectionResult>;

// [v1.2] Thêm helper cho gRPC scanner (WAF-031)
/// Scan một string tùy ý cho OWASP patterns — tái dùng cho gRPC Protobuf strings
pub fn scan_string_for_owasp(input: &str, field_name: &str) -> Vec<InspectionResult>;
```

**Tests bắt buộc:**
```rust
#[test] fn test_clean_request_no_matches()
#[test] fn test_union_select_case_insensitive()
#[test] fn test_sqli_comment_injection()
#[test] fn test_xss_img_onerror()
#[test] fn test_ssrf_cloud_metadata()
#[test] fn test_ssrf_rfc1918()
#[test] fn test_crlf_injection_in_header()
#[test] fn test_path_traversal_in_query()
#[test] fn test_time_based_sqli()
#[test] fn test_regex_compilation_under_100ms()
#[test] fn test_json_body_scanned()
```

---

#### WAF-012: Custom Rule Engine (AND/OR Logic + Priority)

```yaml
priority: HIGH
depends_on: [WAF-001, WAF-010]
output_files:
  - src/security/rule_engine.rs
```

```rust
pub fn evaluate_rules(req: &NormalizedRequest, rules: &[CustomRule], route: &RoutePolicy) -> Vec<InspectionResult>;
pub fn evaluate_rule(req: &NormalizedRequest, rule: &CustomRule) -> Option<InspectionResult>;
pub fn precompile_regex_conditions(rules: &[CustomRule]) -> HashMap<String, Regex>;
```

**Tests bắt buộc:**
```rust
#[test] fn test_and_logic_all_conditions_must_match()
#[test] fn test_or_logic_any_condition_matches()
#[test] fn test_negate_inverts_condition()
#[test] fn test_priority_block_beats_allow()
#[test] fn test_scope_tier_filtering()
#[test] fn test_regex_condition_precompiled()
#[test] fn test_ip_cidr_match()
```

---

### 📦 BATCH 4: BEHAVIORAL ENGINE (3 tasks — tuần tự)

#### WAF-013: Session Tracker + Behavioral Anomaly Detector

```yaml
priority: CRITICAL
depends_on: [WAF-001, WAF-008]
output_files:
  - src/security/behavioral.rs
```

```rust
pub struct SessionState {
    pub session_id: String,
    pub journey: std::collections::VecDeque<JourneyHop>,  // max 20 [v1.1]
    pub request_times: std::collections::VecDeque<Instant>,
    pub critical_endpoint_times: std::collections::VecDeque<(String, Instant)>,
    pub failed_auth_count: u32,
    pub distinct_usernames_attempted: std::collections::HashSet<String>,
    pub error_4xx_count: u32,
    pub last_error_window_start: Instant,
    pub total_requests: u64,
    pub first_seen: Instant,
}

impl SessionTracker {
    pub async fn record_and_analyze(
        &self, session_id: &str, path: &str, method: &str, tier: &str,
        route: &RoutePolicy, response_status: Option<u16>,
        username_hint: Option<&str>, risk_delta_so_far: i32,
        anomaly_flags: Vec<String>,
    ) -> Vec<InspectionResult>;

    pub async fn snapshot_journey(&self, session_id: &str) -> Vec<JourneyHop>;
}
```

**Tests bắt buộc:**
```rust
#[tokio::test] async fn test_zero_depth_session_blocks_deposit()
#[tokio::test] async fn test_shallow_session_challenges_login()
#[tokio::test] async fn test_velocity_login_deposit_2_seconds()
#[tokio::test] async fn test_timing_regularity_50ms_uniform()
#[tokio::test] async fn test_no_timing_alert_on_varied_intervals()
#[tokio::test] async fn test_brute_force_6_failed_logins()
#[tokio::test] async fn test_password_spraying_10_usernames()
#[tokio::test] async fn test_error_recon_25_404s()
#[tokio::test] async fn test_journey_records_hops_in_order()
#[tokio::test] async fn test_journey_capped_at_20_hops()
#[tokio::test] async fn test_snapshot_journey_returns_copy()
#[tokio::test] async fn test_journey_hop_contains_risk_delta()
```

---

#### WAF-014: Risk Score Engine + Decision Gate

```yaml
priority: CRITICAL
depends_on: [WAF-001]
output_files:
  - src/security/risk.rs
```

```rust
pub struct RiskEngine<C: Clock = SystemClock> {
    profiles: DashMap<String, RiskProfile>,
    clock: Arc<C>,
    thresholds: RiskThresholds,
}

impl<C: Clock> RiskEngine<C> {
    pub fn new(clock: C, thresholds: RiskThresholds) -> Self;

    /// [v1.2] Thêm tham số ip + xdp để auto-promote khi score > xdp_block_threshold
    pub fn add_risk(
        &self,
        key: &str,
        delta: i32,
        ip: Option<IpAddr>,                           // [v1.2]
        xdp: Option<&XdpBlocklistController>,         // [v1.2]
    ) -> u32;
    // Nếu new_score >= thresholds.xdp_block_threshold:
    //   xdp.block_ip_async(ip)  → non-blocking, spawns tokio task

    pub fn get_score(&self, key: &str) -> u32;
    pub fn apply_decay(&self);
    pub fn get_or_create_profile(&self, key: &str) -> RiskProfile;
}

pub fn decide(score: u32, thresholds: &RiskThresholds) -> RuleAction;
```

---

#### WAF-015: Challenge Engine (JS Proof-of-Work)

```yaml
priority: HIGH
depends_on: [WAF-001, WAF-014]
output_files:
  - src/security/challenge.rs
  - static/challenge.html
```

```rust
pub struct ChallengeEngine {
    secret: Vec<u8>,
    difficulty: u8,
}

impl ChallengeEngine {
    pub fn new(secret: &str, difficulty: u8) -> Self;
    pub fn generate_challenge_page(&self, request_id: &str) -> (String, String);
    pub fn verify_pow(&self, challenge_nonce: &str, solution: &str) -> bool;
    pub fn issue_cookie(&self, client_ip: &IpAddr, fingerprint: &str) -> String;
    pub fn verify_cookie(&self, cookie: &str, client_ip: &IpAddr, fingerprint: &str) -> bool;
}
```

---

### 📦 BATCH 5: RESILIENCE & RESPONSE PROTECTION (3 tasks — parallel)

#### WAF-016: Circuit Breaker

```yaml
priority: HIGH
depends_on: [WAF-001, WAF-003]
output_files:
  - src/proxy/health.rs
```

```rust
pub enum CircuitState { Closed, Open, HalfOpen }

pub struct CircuitBreaker<C: Clock = SystemClock> { ... }

impl<C: Clock> CircuitBreaker<C> {
    pub fn new(clock: C, config: CircuitBreakerConfig) -> Self;
    pub fn state(&self) -> CircuitState;
    pub fn is_available(&self) -> bool;
    pub fn record_success(&self);
    pub fn record_failure(&self);
    pub async fn spawn_health_checker(self: Arc<Self>, backend_url: String);
}
```

---

#### WAF-017: Response DLP + Error Masking

```yaml
priority: HIGH
depends_on: [WAF-001, WAF-003]
output_files:
  - src/security/dlp.rs
```

```rust
pub fn mask_error_response(status: u16, body: &Bytes, request_id: &str) -> Option<Bytes>;
pub fn redact_pii(body: &Bytes, content_type: &str, redact_fields: &[String]) -> DlpResult;
pub fn sanitize_response_headers(headers: &mut Vec<(String, String)>);
```

---

#### WAF-018: Smart Response Cache

```yaml
priority: NORMAL
depends_on: [WAF-001, WAF-008]
output_files:
  - src/proxy/cache.rs
```

```rust
pub struct ResponseCache { cache: Cache<String, Arc<CachedResponse>> }

impl ResponseCache {
    pub fn new(max_capacity_mb: u64) -> Self;
    pub fn cache_key(method: &str, path: &str, accept_encoding: Option<&str>) -> String;
    pub async fn get(&self, key: &str) -> Option<Arc<CachedResponse>>;
    pub async fn store(&self, key: &str, response: CachedResponse);
    pub fn cacheable_ttl(method: &str, route: &RoutePolicy, response_status: u16, cache_control: Option<&str>) -> Option<Duration>;
}
```

---

### 📦 BATCH 6: OBSERVABILITY (2 tasks — parallel)

#### WAF-019: Prometheus Metrics Exporter

```yaml
priority: NORMAL
depends_on: [WAF-001]
output_files:
  - src/telemetry/metrics.rs
```

```rust
pub struct MetricsCollector { ... }

impl MetricsCollector {
    pub fn new() -> Self;
    pub fn record_request(&self, tier: &str, action: &str, duration_secs: f64, risk_score: u32);
    pub fn inc_active_connections(&self);
    pub fn dec_active_connections(&self);
    pub fn set_circuit_breaker_state(&self, backend: &str, state: u8);
    pub fn inc_cache_hit(&self);
    pub fn inc_cache_miss(&self);
    pub fn set_dropped_logs(&self, count: u64);
    // [v1.2]
    pub fn record_xdp_drop(&self, ipv: u8);   // ipv: 4 or 6
    pub fn render(&self) -> String;
}

pub async fn start_metrics_server(metrics: Arc<MetricsCollector>, port: u16);
```

---

#### WAF-020: SSE Telemetry Bridge (Rust → Dashboard)

```yaml
priority: NORMAL
depends_on: [WAF-005]
output_files:
  - src/telemetry/sse_bridge.rs
```

```rust
/// [v1.2] Thêm xdp_controller để serve /xdp/blocklist
pub async fn start_sse_bridge(
    port: u16,
    logger: Arc<AuditLogger>,
    fp_registry: Arc<FingerprintRegistry>,
    xdp_controller: Arc<XdpBlocklistController>,  // [v1.2]
    ring_buffer_size: usize,
);

// Endpoints:
// GET  /events/live                    → SSE stream of LogEvents (incl. xdp_stats events)
// GET  /events/history?limit=N         → last N events as JSON array
// POST /events                         → internal: AuditLogger pushes events here
// GET  /intelligence/clusters?limit=N  → FingerprintRegistry.top_clusters() [v1.1]
// [v1.2]
// GET  /xdp/blocklist                  → XdpBlocklistController.list_blocked()
// DELETE /xdp/block/:ip                → XdpBlocklistController.unblock_ip()
```

---

### 📦 BATCH 7: DASHBOARD (2 tasks — tuần tự)

#### WAF-021: Dashboard Backend API (Node.js/TypeScript)

```yaml
lang: typescript
depends_on: [WAF-020]
output_files:
  - dashboard/src/server.ts
  - dashboard/src/routes/health.ts
  - dashboard/src/routes/events.ts
  - dashboard/src/routes/control.ts
  - dashboard/src/routes/rules.ts
  - dashboard/src/routes/intelligence.ts   # [v1.1]
  - dashboard/src/routes/xdp.ts            # [v1.2]
```

**API endpoints:**
```
GET  /api/v1/health
GET  /api/v1/events/live                   → SSE proxy from Rust bridge
GET  /api/v1/events/history?limit=N
POST /api/v1/control/panic
POST /api/v1/control/unpanic
POST /api/v1/rules
DELETE /api/v1/rules/:id
PUT  /api/v1/config/thresholds

[v1.1] Journey & Clusters:
GET  /api/v1/events/:request_id/journey
GET  /api/v1/intelligence/clusters?limit=20
POST /api/v1/intelligence/block-cluster

[v1.2] XDP Management:
GET  /api/v1/xdp/stats           → last XdpStatsSnapshot từ SSE stream
GET  /api/v1/xdp/blocklist       → proxy → Rust SSE bridge /xdp/blocklist
DELETE /api/v1/xdp/block/:ip     → proxy → Rust SSE bridge DELETE /xdp/block/:ip
```

---

#### WAF-022: React Dashboard UI

```yaml
lang: typescript
depends_on: [WAF-021]
output_files:
  - dashboard/frontend/src/App.tsx
  - dashboard/frontend/src/components/EventTable.tsx
  - dashboard/frontend/src/components/StatsPanel.tsx
  - dashboard/frontend/src/components/AttackHeatmap.tsx
  - dashboard/frontend/src/components/PanicButton.tsx
  - dashboard/frontend/src/components/RuleEditor.tsx
  - dashboard/frontend/src/components/JourneyTimeline.tsx      # [v1.1]
  - dashboard/frontend/src/components/LinkedEntitiesCard.tsx   # [v1.1]
  - dashboard/frontend/src/components/XdpShieldPanel.tsx       # [v1.2]
```

**[v1.2] XdpShieldPanel — 4 widgets:**

```
✅ XDP Shield Status LED
   - Xanh = Active (native/SKB mode)
   - Abu = "Not Supported on this host" (JANGAN tampilkan 0)
   - TIDAK boleh hiển thị "0 drops" khi xdp_enabled=false (gây nhầm lẫn)

✅ L4 vs L7 Blocking Ratio — Pie chart
   - L4 = total_dropped_v4 + total_dropped_v6 (XDP)
   - L7 = tổng block events từ audit log (WAF)
   - Label: "X% blocked at kernel level (Layer 4)"

✅ Real-time Drop Rate — Area chart, 60s rolling window
   - Y-axis: PPS (packets/sec) — KHÔNG phải req/sec
   - Legend: IPv4 drops/s | IPv6 drops/s | Passed/s
   - Data source: SSE stream, filter final_action == "xdp_stats"

✅ SoftIRQ % — Gauge 0-100%
   - Nguồn: /proc/stat thực tế
   - Label: "Kernel SoftIRQ CPU time (from /proc/stat)"
   - Tooltip: "Low % indicates XDP is bypassing kernel TCP stack"
   - KHÔNG label là "CPU Savings" (không defend được methodology)

❌ CPU Savings Gauge ước tính — KHÔNG implement
   (Hằng số thực nghiệm không defend được khi BTC hỏi)
```

**Demo scenario ghi chú trong component:**
```typescript
// Demo: sudo hping3 -S --flood -V -p 8080 <WAF_IP>
// Expected: dropped_v4_pps spike cao, softirq_percent vẫn thấp
// Chứng minh XDP bypass kernel TCP stack
```

---

### 📦 BATCH 8: INTEGRATION + BINARY (1 task)

#### WAF-025: Main Binary + Integration Tests + Load Test

```yaml
priority: CRITICAL
depends_on: [ALL previous tasks]
output_files:
  - src/main.rs
  - tests/integration_test.rs
  - scripts/load_test.sh
```

**Startup sequence (in `run` command):**
```
1.  Parse CLI args + load config + load custom rules
2.  Validate config
3.  Initialize IpReputationDB
4.  Initialize GeoIpClassifier
5.  Initialize RateLimiter, SessionTracker, RiskEngine
6.  Initialize ChallengeEngine
7.  Initialize FingerprintRegistry + spawn eviction task (10 min)     [v1.1]
8.  Initialize CircuitBreaker + spawn health checker
9.  Initialize ResponseCache
10. Initialize AuditLogger + spawn background writer
11. [v1.2] Initialize XDP: if xdp_interface configured:
        load_xdp_program(interface, pin_path) → graceful fallback if fails
        XdpBlocklistController::open(pin_path, block_ttl_secs)
        XdpStatsCollector::open(pin_path)
        XdpStatsCollector::spawn_collector(collector, logger.clone())
        spawn cleanup_expired task (every 5 min)
    else:
        XdpBlocklistController::disabled(block_ttl_secs)
12. [v1.2] Initialize WsSessionTracker
13. Spawn config watcher
14. Spawn RiskEngine decay task (every 60s)
15. Start Prometheus metrics server (port 9090)
16. Start SSE bridge (port 9091, pass fp_registry + xdp_controller)   [v1.2 extended]
17. Build WafProxy with all components
18. Start Pingora server (blocking)
19. SIGTERM/SIGINT: graceful shutdown
```

**request_filter() pipeline ORDER:**
```
1.  Whitelist check → skip all if whitelisted
2.  IP extraction + ASN classification
    FingerprintRegistry.record(real_ip, composite_fp)            [v1.1]
    If cluster_size > 5: risk +10*(size-1), max +50              [v1.1]
3.  Reputation check (blacklist/tor)
4.  Global rate limit
5.  Route matching
6.  Honeypot check → risk MAX + 403
6.5 [v1.2] ALPN enforcement (WAF-030)
    check_alpn_compliance(negotiated_alpn, route.allowed_alpn)
    If mismatch: risk +40, Block
7.  Per-route rate limit (IP + session)
7.5 [v1.2] WebSocket check (WAF-028) — if is_websocket_upgrade():
    validate_ws_handshake() → If rejected: risk +30, Block
    If valid: ws_tracker.on_connect() → ws_session_id
8.  Cache check
9.  Body size check
10. Normalization
    [v1.2] If body present + no content-type: check protocol guard (WAF-032)
    inspect_protocol_magic(body_bytes[..16]) → If tunnel: risk +80, Block
11. OWASP Scanner
    [v1.2] If gRPC (content-type: application/grpc*): scan_grpc_body() (WAF-031)
12. Custom Rule Engine
13. Behavioral Engine
14. Risk Decision Gate
    RiskEngine.add_risk(key, delta, ip, &xdp_controller)         [v1.2]
    If new_score > xdp_block_threshold: xdp.block_ip_async(ip)   [v1.2]
    decide(score) → Block/Challenge/Allow
```

**request_body_filter() [v1.2 — WebSocket frames]:**
```
If is_websocket && body chunk:
    ws_tracker.check_frame_quota(conn_key, clock)
    If err → disconnect (return Err to Pingora)
```

**Integration tests (20 scenarios):**
```rust
// Batch 1-8 (16 scenarios từ v1.1 — giữ nguyên)
#[tokio::test] async fn test_clean_get_request_passes()
#[tokio::test] async fn test_sqli_in_query_blocked()
#[tokio::test] async fn test_xss_in_body_blocked()
#[tokio::test] async fn test_rate_limit_exceeded_429()
#[tokio::test] async fn test_honeypot_returns_403()
#[tokio::test] async fn test_dlp_credit_card_redacted()
#[tokio::test] async fn test_error_masking_500()
#[tokio::test] async fn test_header_stripping()
#[tokio::test] async fn test_circuit_breaker_503()
#[tokio::test] async fn test_hot_reload_rate_limit()
#[tokio::test] async fn test_cache_hit_second_request()
#[tokio::test] async fn test_challenge_page_served()
#[tokio::test] async fn test_zero_depth_session_blocked()
#[tokio::test] async fn test_whitelist_skips_all_inspection()
#[tokio::test] async fn test_blacklist_blocked()
#[tokio::test] async fn test_content_type_mismatch_risk()
#[tokio::test] async fn test_blocked_event_has_journey_trail()      // [v1.1]
#[tokio::test] async fn test_allow_event_has_no_journey_trail()     // [v1.1]
#[tokio::test] async fn test_ip_rotation_cluster_risk_boost()       // [v1.1]
#[tokio::test] async fn test_fingerprint_cluster_size_in_log()      // [v1.1]
// [v1.2] XDP, WebSocket, Protocol (dùng mock controller — không cần real eBPF)
#[tokio::test] async fn test_risk_above_90_triggers_xdp_block()
#[tokio::test] async fn test_xdp_disabled_controller_no_panic()
#[tokio::test] async fn test_ws_invalid_handshake_blocked()
#[tokio::test] async fn test_grpc_sqli_detected()
#[tokio::test] async fn test_alpn_mismatch_blocked()
#[tokio::test] async fn test_ssh_magic_bytes_blocked()
```

---

### 📦 BATCH 9: XDP/EBPF LAYER 4 SHIELD [v1.2 MỚI]

#### Kiến trúc Feedback Loop

```
┌─────────────────────────────────────────────────────┐
│                   NETWORK CARD (NIC)                 │
│  [XDP HOOK — waf_xdp program]                       │
│       ├─ Lookup src IP in WAF_BLOCKLIST_V4/V6        │
│       ├─ If found AND timestamp < expiry → XDP_DROP  │
│       └─ Else → XDP_PASS                            │
│  [WAF_XDP_STATS: PerCpuArray<u64>]                  │
│       └─ Per-core counters — no lock contention      │
└──────────────┬──────────────────────────────────────┘
               │ XDP_PASS
               ▼
      [LINUX TCP STACK → PINGORA USERSPACE]
               │
               ▼ (score > xdp_block_threshold = 90)
      [RiskEngine.add_risk() → xdp.block_ip_async()]
               │
               ▼
      [aya userspace write to pinned map]
               │ (next packet from same IP)
               ▼
      [XDP_DROP at NIC — zero kernel overhead]

[XdpStatsCollector — 1s interval]
  Reads PerCpuArray → sum across CPUs
  Reads /proc/stat → real softirq%
  Push XdpStatsSnapshot via AuditLogger → SSE bridge → Dashboard
```

---

#### WAF-026: XDP Program (eBPF Kernel Side)

```yaml
priority: HIGH
depends_on: []
build_target: bpfel-unknown-none
build_command: cargo +nightly build --package waf-ebpf --target bpfel-unknown-none -Z build-std=core --release
output_files:
  - waf-ebpf/src/maps.rs
  - waf-ebpf/src/main.rs
```

```rust
// waf-ebpf/src/maps.rs
use aya_ebpf::macros::map;
use aya_ebpf::maps::{HashMap, PerCpuArray};

/// IPv4 blocklist: key = src IPv4 as u32 (network byte order), value = expiry unix secs
#[map(name = "WAF_BLOCKLIST_V4")]
pub static WAF_BLOCKLIST_V4: HashMap<u32, u64> = HashMap::with_max_entries(65536, 0);

/// IPv6 blocklist: key = [u8;16], value = expiry unix secs  
#[map(name = "WAF_BLOCKLIST_V6")]
pub static WAF_BLOCKLIST_V6: HashMap<[u8; 16], u64> = HashMap::with_max_entries(65536, 0);

/// Stats counters — PerCpuArray: KHÔNG dùng HashMap (lock contention giữa CPU cores)
/// index 0 = dropped_v4, index 1 = dropped_v6, index 2 = passed
#[map(name = "WAF_XDP_STATS")]
pub static WAF_XDP_STATS: PerCpuArray<u64> = PerCpuArray::with_max_entries(3, 0);
```

```rust
// waf-ebpf/src/main.rs
#![no_std]
#![no_main]

use aya_ebpf::{bindings::xdp_action, macros::xdp, programs::XdpContext};
use aya_ebpf::helpers::bpf_ktime_get_ns;
use core::mem;
mod maps;
use maps::*;

#[xdp]
pub fn waf_xdp(ctx: XdpContext) -> u32 {
    match try_waf_xdp(ctx) {
        Ok(ret) => ret,
        Err(_) => xdp_action::XDP_PASS,  // fail-open: LUÔN pass khi có lỗi
    }
}

fn try_waf_xdp(ctx: XdpContext) -> Result<u32, ()> {
    let ethhdr = ptr_at::<EthHdr>(&ctx, 0)?;
    match u16::from_be(unsafe { (*ethhdr).h_proto }) {
        ETH_P_IP   => check_ipv4(&ctx),
        ETH_P_IPV6 => check_ipv6(&ctx),
        _          => Ok(xdp_action::XDP_PASS),
    }
}

fn check_ipv4(ctx: &XdpContext) -> Result<u32, ()> {
    let iphdr = ptr_at::<IpHdr>(ctx, EthHdr::LEN)?;
    let src_ip = unsafe { (*iphdr).saddr };
    let now_secs = unsafe { bpf_ktime_get_ns() } / 1_000_000_000;

    if let Some(expiry) = unsafe { WAF_BLOCKLIST_V4.get(&src_ip) } {
        if now_secs < *expiry {
            increment_stat(0);  // dropped_v4
            return Ok(xdp_action::XDP_DROP);
        }
        // Expired — pass through, userspace cleanup sẽ xóa
    }
    increment_stat(2);  // passed
    Ok(xdp_action::XDP_PASS)
}

fn check_ipv6(ctx: &XdpContext) -> Result<u32, ()> {
    let ip6hdr = ptr_at::<Ip6Hdr>(ctx, EthHdr::LEN)?;
    let src_ip: [u8; 16] = unsafe { (*ip6hdr).saddr.in6_u.u6_addr8 };
    let now_secs = unsafe { bpf_ktime_get_ns() } / 1_000_000_000;

    if let Some(expiry) = unsafe { WAF_BLOCKLIST_V6.get(&src_ip) } {
        if now_secs < *expiry {
            increment_stat(1);  // dropped_v6
            return Ok(xdp_action::XDP_DROP);
        }
    }
    Ok(xdp_action::XDP_PASS)
}

/// PerCpuArray: kernel đảm bảo per-core isolation — không cần atomic operation
fn increment_stat(index: u32) {
    if let Some(count) = unsafe { WAF_XDP_STATS.get_ptr_mut(index) } {
        unsafe { *count += 1 };
    }
}

#[inline(always)]
fn ptr_at<T>(ctx: &XdpContext, offset: usize) -> Result<*const T, ()> {
    let start = ctx.data();
    let end = ctx.data_end();
    let len = mem::size_of::<T>();
    if start + offset + len > end { return Err(()); }
    Ok((start + offset) as *const T)
}

const ETH_P_IP: u16 = 0x0800;
const ETH_P_IPV6: u16 = 0x86DD;

#[repr(C)]
struct EthHdr { h_dest: [u8;6], h_source: [u8;6], h_proto: u16 }
impl EthHdr { const LEN: usize = 14; }

#[repr(C)]
struct IpHdr {
    _ihl_version: u8, _tos: u8, _tot_len: u16, _id: u16, _frag_off: u16,
    _ttl: u8, _protocol: u8, _check: u16, saddr: u32, _daddr: u32,
}

#[repr(C)]
union In6AddrUnion { u6_addr8: [u8;16], u6_addr16: [u16;8], u6_addr32: [u32;4] }

#[repr(C)]
struct Ip6Hdr {
    _flow_lbl: [u8;4], _payload_len: u16, _nexthdr: u8, _hop_limit: u8,
    saddr: In6AddrUnion, _daddr: In6AddrUnion,
}

#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! { loop {} }
```

---

#### WAF-027: XDP Userspace Controller + Stats Collector

```yaml
priority: HIGH
depends_on: [WAF-026, WAF-005]
output_files:
  - waf-core/src/ebpf/loader.rs
  - waf-core/src/ebpf/controller.rs
  - waf-core/src/ebpf/stats.rs
```

```rust
// waf-core/src/ebpf/loader.rs

/// Load XDP program, attach to interface, pin maps to /sys/fs/bpf/.
/// Graceful: nếu XDP không available → trả về Err, caller dùng disabled controller.
pub fn load_xdp_program(interface: &str, pin_path: &Path) -> Result<Bpf, WafError> {
    // embed compiled eBPF bytecode at compile time
    let bpf_bytes = include_bytes_aligned!(
        concat!(env!("CARGO_MANIFEST_DIR"), "/../target/bpfel-unknown-none/release/waf-ebpf")
    );
    let mut bpf = BpfLoader::new().load(bpf_bytes)
        .map_err(|e| WafError::ProxyError(format!("eBPF load: {e}")))?;

    let program: &mut Xdp = bpf.program_mut("waf_xdp")
        .ok_or_else(|| WafError::ProxyError("waf_xdp not found".into()))?
        .try_into()
        .map_err(|e| WafError::ProxyError(format!("XDP cast: {e}")))?;

    program.load().map_err(|e| WafError::ProxyError(format!("XDP load: {e}")))?;

    // Try native mode (fastest), fallback to SKB mode (always works)
    program.attach(interface, XdpFlags::DRV_MODE)
        .or_else(|_| program.attach(interface, XdpFlags::SKB_MODE))
        .map_err(|e| WafError::ProxyError(format!("XDP attach: {e}")))?;

    pin_maps(&mut bpf, pin_path)?;
    tracing::info!(interface, "XDP program attached");
    Ok(bpf)
}

pub fn pin_maps(bpf: &mut Bpf, pin_path: &Path) -> Result<(), WafError> {
    std::fs::create_dir_all(pin_path)
        .map_err(|e| WafError::ProxyError(format!("mkdir pin: {e}")))?;
    for name in &["WAF_BLOCKLIST_V4", "WAF_BLOCKLIST_V6", "WAF_XDP_STATS"] {
        bpf.map_mut(name)
            .ok_or_else(|| WafError::ProxyError(format!("map {name} not found")))?
            .pin(pin_path.join(name.to_lowercase()))
            .map_err(|e| WafError::ProxyError(format!("pin {name}: {e}")))?;
    }
    Ok(())
}
```

```rust
// waf-core/src/ebpf/controller.rs

pub struct XdpBlocklistController {
    v4_map: Arc<Mutex<EbpfHashMap<MapData, u32, u64>>>,
    v6_map: Arc<Mutex<EbpfHashMap<MapData, [u8;16], u64>>>,
    pub block_ttl_secs: u64,
    pub enabled: bool,
}

impl XdpBlocklistController {
    /// Mở pinned maps. Trả về disabled controller nếu không available.
    pub fn open(pin_path: &Path, block_ttl_secs: u64) -> Self;

    /// No-op controller — dùng khi XDP không supported (non-Linux, no CAP_BPF, CI)
    pub fn disabled(block_ttl_secs: u64) -> Self;

    /// Block IP tại Layer 4. Non-blocking — spawns tokio task.
    /// Gọi từ RiskEngine khi score >= xdp_block_threshold.
    pub fn block_ip_async(&self, ip: IpAddr);

    /// Unblock IP (dashboard unban action).
    pub async fn unblock_ip(&self, ip: IpAddr) -> Result<(), WafError>;

    /// List all currently blocked IPs with remaining TTL secs.
    pub async fn list_blocked(&self) -> Vec<(IpAddr, u64)>;

    /// Remove expired entries. Call every 5 minutes.
    pub async fn cleanup_expired(&self);
}
```

```rust
// waf-core/src/ebpf/stats.rs
//
// THIẾT KẾ: Tái dùng SSE bridge (WAF-020) — KHÔNG tạo REST polling endpoint mới.
// THIẾT KẾ: softirq% từ /proc/stat thực tế — KHÔNG dùng hằng số ước tính.

pub struct XdpStatsCollector {
    stats_map: Option<PerCpuArray<MapData, u64>>,
    pub xdp_enabled: bool,
}

impl XdpStatsCollector {
    /// Mở pinned PerCpuArray. Trả về disabled nếu map không tồn tại.
    pub fn open(pin_path: &Path) -> Self;

    /// Sum all per-CPU values → (dropped_v4_total, dropped_v6_total, passed_total)
    pub fn read_totals(&self) -> (u64, u64, u64);

    /// Spawn background task: đọc stats mỗi 1s, compute PPS delta,
    /// đọc /proc/stat cho softirq%, push XdpStatsSnapshot vào AuditLogger.
    /// SSE bridge tự broadcast → Dashboard (tái dùng channel đã có).
    pub fn spawn_collector(
        collector: Arc<Self>,
        logger: Arc<AuditLogger>,
    );
}

/// Đọc softirq% delta từ /proc/stat — số thực, không ước tính.
/// Returns 0.0 trên non-Linux hoặc parse error.
struct SoftirqReader { last_softirq: u64, last_total: u64 }

impl SoftirqReader {
    fn new() -> Self;
    fn read_delta_percent(&mut self) -> f64;
    // Parse: "cpu  user nice system idle iowait irq softirq ..."
    // softirq% = (Δsoftirq / Δtotal) * 100
    fn read_proc_stat() -> (u64, u64); // (softirq_jiffies, total_jiffies)
}
```

**Tests bắt buộc (WAF-027):**
```rust
#[tokio::test] async fn test_block_ipv4_inserts_into_map()
#[tokio::test] async fn test_block_ipv6_inserts_into_map()
#[tokio::test] async fn test_expired_entry_passes_through()
#[tokio::test] async fn test_unblock_removes_from_map()
#[tokio::test] async fn test_disabled_controller_all_ops_noop()
#[tokio::test] async fn test_list_blocked_excludes_expired()
#[tokio::test] async fn test_risk_engine_promotes_to_xdp_at_90()
#[tokio::test] async fn test_softirq_reader_zero_on_nonlinux()
#[tokio::test] async fn test_percpu_sum_across_cores()
#[tokio::test] async fn test_stats_collector_pushes_snapshot_to_logger()
```

---

### 📦 BATCH 10: WEBSOCKET & STATEFUL PROXY [v1.2 MỚI]

#### Mapping vào Pingora hooks

```
WebSocket flow:
  request_filter()      → WAF-028: Handshake Guard (validate Upgrade headers)
  request_body_filter() → WAF-029: Frame Rate Limiting (incoming WS frames)
  logging()             → ws_tracker.on_disconnect() cleanup
```

---

#### WAF-028: WebSocket Handshake Guard

```yaml
priority: NORMAL
depends_on: [WAF-001, WAF-008]
output_files:
  - waf-core/src/security/websocket.rs
```

```rust
// waf-core/src/security/websocket.rs

#[derive(Debug, Clone, PartialEq)]
pub enum WsHandshakeResult { Valid, Rejected(WsRejectReason) }

#[derive(Debug, Clone, PartialEq)]
pub enum WsRejectReason {
    MissingKey,
    InvalidKey,          // Not 24 base64 chars (= 16 decoded bytes)
    InvalidVersion,      // Sec-WebSocket-Version != "13"
    ProtocolNotAllowed(String),
    OriginNotAllowed(String),
    UpgradeOnNonGetMethod,
}

/// Validate WebSocket upgrade request per RFC 6455.
/// allowed_origins: empty = allow all (no CSRF restriction)
/// allowed_protocols: empty = allow all subprotocols
pub fn validate_ws_handshake(
    req: &NormalizedRequest,
    allowed_origins: &[String],
    allowed_protocols: &[String],
) -> WsHandshakeResult;

/// Detect WebSocket upgrade attempt
pub fn is_websocket_upgrade(req: &NormalizedRequest) -> bool;

/// Convert rejection reason to InspectionResult for WAF pipeline
pub fn ws_rejection_to_inspection(reason: &WsRejectReason) -> InspectionResult;
// risk_delta: +30, action: Block

#[cfg(test)]
mod tests {
    #[test] fn test_valid_handshake()
    #[test] fn test_missing_key_rejected()
    #[test] fn test_key_wrong_length_rejected()
    #[test] fn test_version_not_13_rejected()
    #[test] fn test_origin_not_in_allowlist_rejected()
    #[test] fn test_non_get_rejected()
    #[test] fn test_empty_origin_list_allows_all()
    #[test] fn test_empty_protocol_list_allows_all()
}
```

---

#### WAF-029: WebSocket Session Tracker + Frame Rate Limiter

```yaml
priority: NORMAL
depends_on: [WAF-028, WAF-009]
output_files:
  - waf-core/src/security/ws_session.rs
```

```rust
// waf-core/src/security/ws_session.rs

#[derive(Debug, Clone)]
pub struct WsSessionState {
    pub session_id: String,
    pub connected_at: std::time::Instant,
    pub frames_this_second: u32,
    pub last_frame_second: u64,
    pub total_frames: u64,
    pub anomaly_count: u32,
}

pub struct WsSessionTracker {
    sessions: Cache<String, Arc<Mutex<WsSessionState>>>,
    max_frames_per_second: u32,
}

impl WsSessionTracker {
    pub fn new(max_frames_per_second: u32) -> Self;

    /// Register new WS connection. Returns session_id.
    pub async fn on_connect(&self, connection_key: &str) -> String;

    /// Check frame rate quota. Clock-injectable for deterministic tests.
    pub async fn check_frame_quota<C: Clock>(
        &self,
        connection_key: &str,
        clock: &C,
    ) -> Result<(), WafError>;

    pub async fn on_disconnect(&self, connection_key: &str);
}

#[cfg(test)]
mod tests {
    #[tokio::test] async fn test_frame_quota_under_limit()
    #[tokio::test] async fn test_frame_quota_exceeded_returns_error()
    #[tokio::test] async fn test_counter_resets_new_second()
    #[tokio::test] async fn test_disconnect_removes_session()
    #[tokio::test] async fn test_session_not_found_returns_error()
}
```

---

### 📦 BATCH 11: PROTOCOL ENFORCEMENT & ANTI-TUNNELING [v1.2 MỚI]

#### Mapping vào Pingora hooks

```
Protocol enforcement:
  request_filter()      → WAF-030: ALPN enforcement (sau TLS info available)
  request_filter()      → WAF-032: Protocol Guard (body prefix check)
  request_body_filter() → WAF-031: gRPC L7 Filter (streaming Protobuf inspection)
```

---

#### WAF-030: ALPN Enforcement

```yaml
priority: NORMAL
depends_on: [WAF-001, WAF-003, WAF-004]
output_files:
  - waf-core/src/security/protocol.rs (ALPN section)
```

```rust
// waf-core/src/security/protocol.rs — ALPN section

pub const ALPN_HTTP11: &str = "http/1.1";
pub const ALPN_HTTP2: &str = "h2";

/// Check ALPN compliance.
/// Returns Ok(()) if: no ALPN negotiated | allowed_alpn empty | negotiated in allowed list.
/// Returns Err(InspectionResult) if mismatch.
pub fn check_alpn_compliance(
    negotiated_alpn: Option<&str>,
    allowed_alpn: &[String],
) -> Result<(), InspectionResult>;
// Err: rule_id="PROTO-001-ALPN-MISMATCH", risk_delta=+40, action=Block

#[cfg(test)]
mod tests {
    #[test] fn test_alpn_match_allowed()
    #[test] fn test_alpn_mismatch_blocked()
    #[test] fn test_no_alpn_always_ok()
    #[test] fn test_empty_allowlist_allows_any()
}
```

---

#### WAF-031: gRPC L7 Filter

```yaml
priority: LOW
depends_on: [WAF-001, WAF-011]
output_files:
  - waf-core/src/security/grpc.rs
```

```rust
// waf-core/src/security/grpc.rs
//
// gRPC dùng Protobuf binary — KHÔNG thể regex trực tiếp.
// Approach: decode wire format (schemaless), extract string fields, scan với WAF-011.

const GRPC_HEADER_LEN: usize = 5; // 1 byte compressed flag + 4 bytes message length

pub fn is_grpc_request(content_type: Option<&str>) -> bool;
// content_type.starts_with("application/grpc")

pub fn parse_grpc_frame_header(data: &[u8]) -> Result<(bool, u32), WafError>;
// Returns (is_compressed, message_len)

/// Extract candidate strings from Protobuf wire format (best-effort, schemaless).
/// Wire type 2 (length-delimited) fields that are valid UTF-8 = string candidates.
pub fn extract_proto_strings(data: &[u8]) -> Vec<String>;

/// Scan gRPC request body. Skips compressed frames (cannot scan without decompressing).
/// Calls scan_string_for_owasp() from WAF-011 on extracted strings.
pub fn scan_grpc_body(body: &Bytes) -> Vec<InspectionResult>;

#[cfg(test)]
mod tests {
    #[test] fn test_grpc_header_parse_uncompressed()
    #[test] fn test_grpc_header_parse_too_short()
    #[test] fn test_extract_strings_simple_proto()
    #[test] fn test_sqli_in_grpc_string_detected()
    #[test] fn test_xss_in_grpc_string_detected()
    #[test] fn test_compressed_frame_returns_empty()
    #[test] fn test_malformed_proto_no_panic()
    #[test] fn test_deeply_nested_proto_strings()
}
```

---

#### WAF-032: Protocol Guard (Anti-Tunneling)

```yaml
priority: NORMAL
depends_on: [WAF-001, WAF-003]
output_files:
  - waf-core/src/security/protocol.rs (Protocol Guard section)
```

```rust
// waf-core/src/security/protocol.rs — Protocol Guard section

#[derive(Debug, Clone, PartialEq)]
pub enum ProtocolCheckResult {
    ValidHttp1,
    ValidHttp2,
    SuspectedTunnel(TunnelProtocol),
    Unknown,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TunnelProtocol { Ssh, OpenVpn, WireGuard, Socks5, Other(String) }

// Magic byte signatures
const SSH_MAGIC: &[u8]       = b"SSH-";
const HTTP2_PREFACE: &[u8]   = b"PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n";
const OPENVPN_MAGIC: &[u8]   = &[0x00, 0x0D];
const WIREGUARD_MAGIC: &[u8] = &[0x01, 0x00, 0x00, 0x00];
const SOCKS5_MAGIC: &[u8]    = &[0x05];
const HTTP1_METHODS: &[&[u8]] = &[b"GET ", b"POST", b"PUT ", b"DELE", b"HEAD", b"OPTI", b"PATC"];

/// Inspect first bytes of connection payload to detect protocol tunneling.
/// NOTE: Pingora 0.8 không expose raw TLS bytes trực tiếp.
/// Workaround: check body_bytes prefix khi content-type absent.
pub fn inspect_protocol_magic(first_bytes: &[u8]) -> ProtocolCheckResult;

/// Convert ProtocolCheckResult to InspectionResult. None if valid HTTP.
pub fn protocol_check_to_inspection(result: &ProtocolCheckResult) -> Option<InspectionResult>;
// SuspectedTunnel: risk_delta=+80, action=Block (→ also triggers XDP block via RiskEngine)
// Unknown:         risk_delta=+20, action=Challenge

/// Should Protocol Guard run for this request?
/// Only when: non-standard method OR (no content-type AND body present)
pub fn should_run_protocol_guard(req: &NormalizedRequest) -> bool;

#[cfg(test)]
mod tests {
    #[test] fn test_http1_get_recognized()
    #[test] fn test_http2_preface_recognized()
    #[test] fn test_ssh_magic_detected()
    #[test] fn test_wireguard_magic_detected()
    #[test] fn test_socks5_detected()
    #[test] fn test_empty_bytes_unknown()
    #[test] fn test_unknown_returns_challenge_not_block()
    #[test] fn test_tunnel_returns_block_inspection()
    #[test] fn test_valid_http_returns_none_inspection()
}
```

---

## PHẦN 6: MIDDLEWARE ORDER + DEPENDENCY GRAPH

### 6.1 Request Processing Pipeline (v1.2 đầy đủ)

```
CLIENT
  │
  ▼
[PINGORA TCP ACCEPT] — connection timeout
  │
  ▼
[TLS HANDSHAKE] → JA4 fingerprint + extract ALPN   [v1.2]
  │
  ▼
[request_filter() START]
  │
  ├─→ 1.   WHITELIST CHECK → skip all if whitelisted
  │
  ├─→ 2.   IP EXTRACTION + ASN CLASSIFICATION
  │         FingerprintRegistry.record(real_ip, composite_fp)    [v1.1]
  │         cluster_size > 5 → InspectionResult FP-CLUSTER-001   [v1.1]
  │
  ├─→ 3.   REPUTATION CHECK (blacklist/tor)
  │
  ├─→ 4.   GLOBAL RATE LIMIT
  │
  ├─→ 5.   ROUTE MATCHING
  │
  ├─→ 6.   HONEYPOT CHECK → risk MAX + 403
  │
  ├─→ 6.5  ALPN ENFORCEMENT  [v1.2 WAF-030]
  │         check_alpn_compliance(negotiated_alpn, route.allowed_alpn)
  │         mismatch → risk +40, Block
  │
  ├─→ 7.   PER-ROUTE RATE LIMIT (IP + session)
  │
  ├─→ 7.5  WEBSOCKET CHECK  [v1.2 WAF-028]
  │         is_websocket_upgrade() → validate_ws_handshake()
  │         Rejected → risk +30, Block
  │         Valid → ws_tracker.on_connect() → ws_session_id
  │
  ├─→ 8.   CACHE CHECK → return cached if hit
  │
  ├─→ 9.   BODY SIZE VALIDATION → 413
  │
  ├─→ 10.  NORMALIZATION
  │         [v1.2] If no content-type + body present:
  │             inspect_protocol_magic(body[..16])  [WAF-032]
  │             SuspectedTunnel → risk +80, Block
  │
  ├─→ 11.  OWASP SCANNER
  │         [v1.2] If gRPC: scan_grpc_body()        [WAF-031]
  │
  ├─→ 12.  CUSTOM RULE ENGINE
  │
  ├─→ 13.  BEHAVIORAL ENGINE
  │
  ├─→ 14.  RISK DECISION GATE
  │         RiskEngine.add_risk(key, delta, ip, &xdp_controller)  [v1.2]
  │         new_score > xdp_block_threshold → xdp.block_ip_async()  [v1.2]
  │         decide(score) → Block/Challenge/Allow
  │
  ▼
[upstream_peer()]
  │
  ▼
[request_body_filter()]
  │  [v1.2] If is_websocket:
  │      ws_tracker.check_frame_quota(conn_key, clock)
  │      Err → disconnect
  │
  ▼
[response_filter()]
  │  Error masking → DLP → header strip → cache store → circuit breaker
  │
  ▼
[logging()]
  │  Build LogEvent
  │  [v1.1] If Block: journey_trail = snapshot_journey()
  │  [v1.1] fingerprint_cluster_size = registry.cluster_size()
  │  [v1.2] detected_protocol = ctx.detected_protocol
  │  AuditLogger.log() → SSE bridge → Dashboard
  │  [v1.2] If was_websocket: ws_tracker.on_disconnect()
  ▼
CLIENT RESPONSE
```

### 6.2 Dependency Graph (v1.2)

```
BATCH 1 (sequential):
  WAF-001 → ALL (types incl. XdpStatsSnapshot, RiskThresholds v1.2, XdpStatsSnapshot)
  WAF-002 (depends on WAF-001)
  WAF-003 (depends on WAF-001) — UPDATE: WafMiddlewares + xdp_controller + ws_tracker
  WAF-004 (depends on WAF-003) — UPDATE: extract_alpn_from_session()
  WAF-004B (depends on WAF-004)
  WAF-005 (depends on WAF-001) — receives XdpStatsSnapshot synthetic events

BATCH 2 (parallel): WAF-006..WAF-010

BATCH 3 (parallel):
  WAF-011 (depends on WAF-010) — UPDATE: + scan_string_for_owasp()
  WAF-012 (depends on WAF-010)

BATCH 4 (sequential): WAF-013 → WAF-014 → WAF-015
  WAF-014 — UPDATE: add_risk() + ip + xdp params

BATCH 5 (parallel): WAF-016, WAF-017, WAF-018

BATCH 6 (parallel):
  WAF-019 — UPDATE: + record_xdp_drop()
  WAF-020 — UPDATE: + xdp_controller param + /xdp/* endpoints

BATCH 7 (sequential):
  WAF-021 — UPDATE: + xdp.ts routes
  WAF-022 — UPDATE: + XdpShieldPanel

BATCH 8:
  WAF-025 — UPDATE: startup + XDP init + WS tracker + protocol guard in pipeline

BATCH 9 (XDP — separate build):
  WAF-026 (standalone bpfel-unknown-none build)
  WAF-027 (depends on WAF-026 compiled binary + WAF-005)

BATCH 10 (WebSocket):
  WAF-028 (depends on WAF-001, WAF-008)
  WAF-029 (depends on WAF-028, WAF-009)

BATCH 11 (Protocol):
  WAF-030 (depends on WAF-001, WAF-003, WAF-004)
  WAF-031 (depends on WAF-001, WAF-011 — needs scan_string_for_owasp)
  WAF-032 (depends on WAF-001, WAF-003)
```

---

## PHẦN 7: RED TEAM ATTACK SCENARIOS → DEFENSIVE MAPPING (v1.2)

| Attack Scenario | Kỹ thuật cụ thể | WAF Defense | Risk Delta |
|---|---|---|---|
| **DDoS Layer 4 SYN Flood** | `hping3 -S --flood` | **[v1.2] XDP DROP tại NIC** — zero kernel CPU | 0 CPU cost |
| **DDoS Layer 7 HTTP Flood** | 100K req/s từ botnet | Global rate limit + Circuit Breaker | 429 |
| **Slowloris** | Headers rất chậm | Pingora header_read_timeout = 10s | Connection drop |
| **RUDY** | POST body từng byte | Pingora body_read_timeout = 30s | Connection drop |
| **Credential Stuffing IP Rotation** | 1000 IPs, cùng JA4 | FingerprintRegistry + [v1.2] XDP auto-block khi score > 90 | +10/IP max +50 → XDP |
| **Password Spraying** | 1 IP, nhiều username | BHV-005: >10 usernames → +60 Block | +60 |
| **Zero-Depth Session** | POST /deposit trực tiếp | BHV-001: 0 pages → +50 Block | +50 |
| **Transaction Fraud** | Login→Deposit < 5s | BHV-003 velocity → +60 Block | +60 |
| **Perfectly-Timed Bot** | Requests 50ms uniform | BHV-004: std_dev < 5ms → +40 Challenge | +40 |
| **SQLi UNION SELECT** | Classic injection | WAF-011 SQLI-001 | +40 |
| **SQLi trong gRPC** | Protobuf string với SQL | **[v1.2] WAF-031** scan_grpc_body → WAF-011 | +40 |
| **XSS trong JSON body** | `{"name":"<script>"}` | WAF-011 XSS + body_text scan | +35 |
| **SSRF cloud metadata** | `169.254.169.254` | WAF-011 SSRF-002 | +50 |
| **Path Traversal encoded** | `%2e%2e%2f` | WAF-010 decode → WAF-011 TRAV-001 | +30 |
| **WebSocket invalid upgrade** | Missing Sec-WS-Key | **[v1.2] WAF-028** rejection | +30 Block |
| **WebSocket frame flood** | 10K frames/s | **[v1.2] WAF-029** frame quota | Disconnect |
| **WebSocket CSRF** | Unauthorized origin | **[v1.2] WAF-028** origin check | +30 Block |
| **ALPN mismatch** | Claim h2, send HTTP/1 data | **[v1.2] WAF-030** ALPN check | +40 Block |
| **SSH tunneling via port 443** | SSH-2.0 magic after TLS | **[v1.2] WAF-032** magic byte detection | +80 Block → XDP |
| **OpenVPN via port 443** | VPN magic bytes | **[v1.2] WAF-032** detection | +80 Block → XDP |
| **Honeypot scan** | GET /.env, /wp-admin/ | WAF-008 → risk MAX + 403 | MAX |
| **Error response harvesting** | Trigger 500s | WAF-017 error masking | No leak |
| **PII in response** | Backend returns CC# | WAF-017 DLP → redacted | No leak |
| **Header injection** | CRLF in Host | WAF-010 detect_header_injection | +60 |

---

## PHẦN 8: AI EXECUTION STRATEGY (v1.2)

### 8.1 Model Routing theo Task Type

| Task Category | Model | Lý do |
|---|---|---|
| **Pingora integration** (WAF-003, WAF-004, WAF-025) | **Claude Sonnet 4.6** | Best Rust + niche framework |
| **eBPF kernel code** (WAF-026) | **Claude Sonnet 4.6** | no_std + aya-ebpf syntax phức tạp |
| **aya userspace** (WAF-027) | **Gemini 3.1 Pro** | 1M context để load aya docs |
| **Pure Rust logic** (WAF-001, 002, 006-020, 028-032) | **Gemini 3.1 Pro** | SWE-bench 80.6% |
| **TypeScript/React** (WAF-021, WAF-022) | **DeepSeek V3.2** | JS/TS strong suit |
| **Test writing** | **Claude Sonnet 4.6** | Best test spec comprehension |

### 8.2 Prompt Engineering cho eBPF Tasks

```
SYSTEM PROMPT cho WAF-026 (XDP kernel):
You are an expert in eBPF/XDP development using aya-ebpf crate.
This is kernel-side code: #![no_std] #![no_main], cannot use std library.
Use PerCpuArray (NOT HashMap) for stats counters — no lock contention between CPU cores.
All pointer arithmetic must validate bounds before dereferencing (XDP verifier requirement).
fail-open on any error: always return XDP_PASS on error paths, NEVER XDP_DROP.

SYSTEM PROMPT cho WAF-027 (aya userspace):
PerCpuArray.get() returns PerCpuValues<T> — sum across all CPU entries to get total.
All map operations are fallible — use Result<>, never .unwrap().
Provide graceful disabled() fallback when XDP maps are unavailable.
```

### 8.3 Performance Budget (v1.2)

```
Baseline (Batch 1-8):             ~5.0ms
v1.1 additions:                   +0.08ms
v1.2 additions (non-WS/gRPC):
  WAF-030 (ALPN check):          +0.00ms  (string compare)
  WAF-032 (protocol guard):      +0.10ms  (byte prefix match)
  WAF-028 (WS check on upgrade): +0.10ms  (only WS upgrade requests)
  WAF-027 (XDP write async):     +0.00ms  (off critical path)
  XDP stats push (try_send):     +0.00ms  (non-blocking)
──────────────────────────────────────────
Non-WS/non-gRPC requests:  ~5.18ms  ✅ within SLA
gRPC requests:             +0.50ms  → ~5.68ms ⚠️ monitor
WebSocket frames:          +0.20ms per frame ✅

Mitigation nếu gRPC > 5ms:
  Move scan_grpc_body() sang background tokio::task,
  chấp nhận async result loss cho first chunk.
```

---

## PHẦN 9: KNOWN RISKS + MITIGATION (v1.2)

| Risk | Severity | Mitigation |
|---|---|---|
| AI hallucinate Pingora API | HIGH | Feed actual Pingora source. Human review Pingora tasks. |
| Types mismatch between tasks | HIGH | Strict types.rs contract. Never redeclare. |
| Async deadlock | HIGH | AuditLogger try_send. Clock trait prevents real-time dep. |
| eBPF toolchain conflict | HIGH | **[v1.2]** Workspace split waf-core/waf-ebpf (§3.6) |
| XDP not available on host | HIGH | **[v1.2]** disabled() controller — WAF vẫn chạy L7 only |
| CAP_BPF not granted | MEDIUM | **[v1.2]** Fallback SKB mode; document required caps |
| PerCpuArray API change in aya 0.13 | MEDIUM | **[v1.2]** Pin aya = "0.13" in Cargo.lock |
| softirq% parse sai | LOW | **[v1.2]** Return 0.0 on parse error; unit test with known content |
| gRPC false positive | MEDIUM | **[v1.2]** Only scan wire type 2 UTF-8 strings |
| Protocol Guard false positive | LOW | **[v1.2]** Only run when no content-type + body present |
| WS frame overhead | LOW | O(1) moka lookup — negligible |
| DashMap contention under DDoS | MEDIUM | moka on hot path. DashMap for risk profiles (lower freq). |
| load_test fails p99 > 5ms | HIGH | Profile early. gRPC scan → background task if needed. |

---

## PHẦN 10: CHECKLIST TRƯỚC KHI DEMO (v1.2)

```
□ ./waf run khởi động thành công
□ ./waf check validate config in ra thành công
□ curl http://localhost:8080/api/test → backend responds
□ curl "http://localhost:8080/login?id=1 UNION SELECT" → 403
□ curl "http://localhost:8080/.env" → 403 (honeypot)
□ 6 rapid failed POST /login → brute force detected
□ Config change → hot-reload < 2s
□ Backend down → circuit breaker trips
□ Load test: ≥5K req/s, p99 ≤5ms
□ Dashboard live tại http://localhost:3001
□ Panic button → all routes Block
□ cargo test — all pass
□ No .unwrap() in src/ (grep check)
□ Prometheus /metrics valid

[v1.1]
□ POST /deposit (zero-depth) → blocked event có journey_trail
□ Click blocked event → JourneyTimeline panel mở
□ 3 IPs cùng fingerprint → StatsPanel hiện "1 Active IP Rotation Cluster"
□ Click "Block toàn bộ cluster" → CustomRule tạo trong custom_rules.yaml
□ GET /api/v1/intelligence/clusters → JSON array

[v1.2 — XDP]
□ xdp_interface configured trong waf_rules.yaml
□ ./waf run logs "XDP program attached to eth0"
□ XDP Shield Status = Xanh (Active)
□ hping3 SYN flood → XDP Drop Rate spike trên area chart
□ SoftIRQ % gauge hiển thị số thực (không phải ước tính)
□ L4 vs L7 Blocking pie chart có cả 2 loại sau attack
□ GET /api/v1/xdp/blocklist → JSON array (rỗng ban đầu)
□ Risk score > 90 → IP xuất hiện trong xdp/blocklist
□ DELETE /api/v1/xdp/block/:ip → IP biến khỏi blocklist
□ XDP không support → Dashboard hiện "Not Supported" (KHÔNG hiện 0)
□ Prometheus có counter waf_xdp_dropped_total

[v1.2 — WebSocket]
□ WS upgrade không có Sec-WebSocket-Key → 400 + risk +30
□ WS upgrade version != 13 → 400
□ Valid WS upgrade → kết nối thành công, session tracked
□ 200+ WS frames/sec → frame rate limit triggered

[v1.2 — Protocol]
□ ALPN mismatch (allowed: h2, client: http/1.1) → blocked
□ SSH magic bytes trong body → risk +80, Block
□ OpenVPN magic bytes → risk +80, Block
□ gRPC request với SQLi trong Protobuf field → detected + blocked
□ Normal gRPC health check → passes (no false positive)

[v1.2 — Demo XDP trực tiếp cho BTC]
□ Terminal 1: ./waf run
□ Terminal 2: sudo hping3 -S --flood -V -p 8080 <WAF_IP>
□ Dashboard XDP Drop Rate spike vọt cao
□ Terminal 3: for i in $(seq 100); do curl http://localhost:8080/api/ping; done
□ Tất cả requests vẫn pass — WAF L7 không bị ảnh hưởng
□ SoftIRQ % thấp — chứng minh XDP đang bypass kernel
```

---

## PHẦN 11: [v1.1] USER JOURNEY ANOMALY + ATTACK GRAPH — THIẾT KẾ CHI TIẾT

> Phần này giữ nguyên từ blueprint v1.1.

### 11.1 User Journey Anomaly — Luồng dữ liệu end-to-end

```
[Request đến WAF]
      ↓
[Step 13: Behavioral Engine — record_and_analyze()]
      Ghi JourneyHop vào SessionState.journey (VecDeque, max 20)
      hop.risk_delta = tổng InspectionResult.risk_delta từ steps 11+12
      hop.anomaly_flags = ["sqli_detected"] nếu scanner triggered
      ↓
[Step 16: RISK DECISION GATE → final_action == Block]
      ↓
[logging() hook]
      if Block: journey_trail = snapshot_journey(session_id).await
      else:     journey_trail = None  ← KHÔNG lãng phí disk
      ↓
[AuditLogger → file + SSE bridge]
      ↓
[Dashboard EventTable — blocked row có icon 🔍]
      ↓ click
[GET /api/v1/events/:request_id/journey]
      ↓
[JourneyTimeline React render]
```

**Tại sao max 20 hops?** 20×200 bytes = 4KB/blocked session. 1000 blocks/giờ = 4MB — acceptable. Attacker thường bị block sau 2-5 hops.

**Tại sao snapshot không clear session?** Session có thể bị block nhiều lần; mỗi event cần context độc lập.

### 11.2 FingerprintRegistry

```
FingerprintRegistry {
    clusters: DashMap<String, FingerprintCluster>   // fp_hash → cluster
    ip_to_fp: DashMap<IpAddr, String>               // reverse lookup
}
```

Memory: 10K active fps × 16KB/cluster = 160MB worst case. Eviction mỗi 10 phút TTL 1 giờ → steady state << 160MB.

Risk delta: `min((cluster_size - 1) × 10, 50)`

### 11.3 Dashboard UX — Attack Graph + Cluster Block

```
StatsPanel: "⚠️ 3 Active IP Rotation Clusters"
    ↓ click
LinkedEntitiesCard: top cluster detail
    [🚫 Block toàn bộ cluster — N IPs]
    ↓ POST /intelligence/block-cluster
WAF-021: inject AUTO-CLUSTER-* rule vào custom_rules.yaml
    ↓ config watcher picks up
ArcSwap atomic swap — active in < 2s
```

### 11.4 Performance Budget v1.1

```
FingerprintRegistry ops: +0.07ms
SessionState journey:    +0.01ms
snapshot_journey (Block): +0.02ms
Total v1.1 overhead:     +0.08ms → ~5.08ms
```

---

## PHẦN 12: [v1.2] BATCH 9 — THIẾT KẾ CHI TIẾT XDP TELEMETRY

### 12.1 Quyết định kỹ thuật quan trọng

| Quyết định | Lý do | Bác bỏ alternative |
|---|---|---|
| `PerCpuArray` cho stats | No lock contention giữa CPU cores | `HashMap` cần atomic — hotpath ở NIC level |
| XDP threshold 90 > WAF threshold 70 | XDP block không có Challenge fallback | Cùng threshold → over-block legitimate users |
| Tái dùng SSE Bridge | Không thêm endpoint, tái dùng channel | REST polling mới = over-engineering |
| softirq từ `/proc/stat` thực tế | Defend được với BTC | Hằng số ước tính = không defend được |
| KHÔNG có CPU Savings Gauge | Methodology không reproducible | "mỗi 1M packets = X% CPU" không có basis |
| Graceful `disabled()` controller | XDP không available ở mọi môi trường | Hard dependency → WAF fail to start |
| Native → SKB mode fallback | Maximize performance, graceful degrade | Native only → fail trên nhiều VM/container |

### 12.2 XDP Stats Flow

```
[waf_xdp kernel] — tại mỗi packet
  increment_stat(index) → WAF_XDP_STATS[cpu_id][index]++
  (PerCpuArray: no atomic needed, kernel isolation per core)

[XdpStatsCollector] — mỗi 1 giây
  read_totals(): sum across all CPUs
    total_v4 = Σ WAF_XDP_STATS[cpu][0] for all cpus
    total_v6 = Σ WAF_XDP_STATS[cpu][1]
    total_passed = Σ WAF_XDP_STATS[cpu][2]
  
  SoftirqReader.read_delta_percent():
    parse /proc/stat line 1: "cpu user nice system idle iowait irq softirq ..."
    softirq% = (Δsoftirq_jiffies / Δtotal_jiffies) × 100
  
  Build XdpStatsSnapshot { dropped_v4_pps = total_v4 - last_v4, ... }
  
  LogEvent { final_action: "xdp_stats", xdp_stats: Some(snapshot), ... }
  AuditLogger.log(event)  ← try_send, non-blocking
    ↓ SSE bridge
    ↓ Dashboard: filter events where final_action == "xdp_stats"
    ↓ XdpShieldPanel updates
```

### 12.3 Dashboard XdpShieldPanel Data Sources

```typescript
// SSE stream — filter events
sseEventSource.addEventListener('message', (e) => {
  const event = JSON.parse(e.data);
  if (event.final_action === 'xdp_stats' && event.xdp_stats) {
    updateXdpPanel(event.xdp_stats);  // real-time push, no polling
  }
});

// xdp_enabled === false → show "Not Supported" banner, NOT zero values
// This is the correct UX: zero values would be misleading
if (!latestStats.xdp_enabled) {
  return <Banner>XDP Shield: Not Supported on this host</Banner>;
}
```

### 12.4 Performance Budget v1.2

```
v1.1 overhead:                    +0.08ms
v1.2 additions (non-WS, non-gRPC):
  ALPN check (string compare):   +0.00ms
  Protocol Guard (prefix match): +0.10ms
  XDP async write (off-path):    +0.00ms
  XDP stats push (try_send):     +0.00ms
Total v1.2 non-WS overhead:      +0.10ms → ~5.18ms ✅

WS frame check (moka get):       +0.20ms per frame ✅
gRPC scan (proto parse + regex): +0.50ms ⚠️ monitor under load
```

---

## PHẦN 13: [v1.2] BATCH 10 — WEBSOCKET THIẾT KẾ CHI TIẾT

### 13.1 Mapping Pingora hooks → WS lifecycle

```
HTTP upgrade request:
  request_filter()
    → is_websocket_upgrade() == true
    → validate_ws_handshake() → Valid/Rejected
    → Valid: ws_tracker.on_connect(conn_key) → ws_session_id
    → ctx.is_websocket = true

WS frames (after upgrade):
  request_body_filter() called per chunk
    → ws_tracker.check_frame_quota(conn_key, clock)
    → Err → return Err to Pingora → connection closed

Connection close:
  logging()
    → if ctx.is_websocket: ws_tracker.on_disconnect(conn_key)
```

### 13.2 Frame Rate Limiting Design

```
Per second sliding window (Clock-injectable):
  - Reset counter khi now_secs != last_frame_second
  - Không dùng tokio::time::sleep → không block Pingora worker thread
  - moka Cache TTL = 1 giờ → auto-evict idle WS sessions

Risk escalation:
  state.anomaly_count > 5 → push InspectionResult to ctx (risk +20)
  Sau logging(): ctx.inspection_results có thể trigger thêm risk trên
  request tiếp theo từ cùng session
```

---

## PHẦN 14: [v1.2] BATCH 11 — PROTOCOL ENFORCEMENT THIẾT KẾ CHI TIẾT

### 14.1 ALPN Enforcement Flow

```
TLS handshake complete → Pingora session.digest()
extract_alpn_from_session() → negotiated_alpn: Option<String>

Trong request_filter() step 6.5:
  Let effective_alpn_list = route.allowed_alpn
      .unwrap_or(config.allowed_alpn)
  check_alpn_compliance(negotiated_alpn, effective_alpn_list)
  Err(result) → ctx.inspection_results.push(result)
              → risk +40, action = Block

Per-route override:
  /api/grpc-service: allowed_alpn = ["h2"]  (gRPC requires h2)
  /api/legacy:       allowed_alpn = ["http/1.1", "h2"]
  /: allowed_alpn = null → use global config
```

### 14.2 gRPC Protobuf Inspection

```
Protobuf wire format (schemaless scan):
  tag = field_number << 3 | wire_type
  wire_type 0 = varint (skip)
  wire_type 1 = 64-bit (skip 8 bytes)
  wire_type 2 = length-delimited:
      length = varint
      if bytes[pos..pos+len] is valid UTF-8 AND len > 2:
          strings.push(s)
      recurse into nested messages
  wire_type 5 = 32-bit (skip 4 bytes)

Scan: scan_string_for_owasp(strings.join(" "), "grpc_body")
Skip compressed frames (flag byte != 0) — cannot scan without decompressing

False positive mitigation:
  - Minimum string length: 3 chars (filter noise)
  - Only printable chars (no control chars except \n\t)
  - Nested recursion limit: implicit via stack depth (safe for protobuf depth < 64)
```

### 14.3 Protocol Guard — Pingora Limitation Workaround

```
Pingora 0.8 limitation: không expose raw TLS decrypted bytes trực tiếp.
Workaround: inspect body_bytes khi:
  - content-type header absent (browsers luôn gửi content-type)
  - body_bytes không rỗng
  - method không phải standard HTTP

This catches:
  - SSH client connecting on port 443 (SSH-2.0-OpenSSH...)
  - OpenVPN over HTTPS (magic byte 0x00 0x0D)
  - WireGuard over HTTPS (magic byte 0x01 0x00 0x00 0x00)
  - SOCKS5 proxies (0x05)
  - Custom protocol tunneling (→ Unknown → risk +20)

Not caught by this approach (limitation):
  - Protocols that mimic HTTP headers perfectly
  - Encrypted tunnels that start with valid HTTP GET request

Mitigation: Protocol Guard is a detection layer, not a seal.
XDP block + behavioral engine catches persistent offenders.
```