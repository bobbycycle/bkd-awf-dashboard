const BASE = '/api/v1'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`)
  return res.json() as Promise<T>
}

export const api = {
  health: () => get('/health'),
  stats: () => get('/stats'),
  events: {
    history: (limit = 100) => get(`/events/history?limit=${limit}`),
    journey: (id: string) => get(`/events/${id}/journey`),
  },
  control: {
    panic: () => post('/control/panic'),
    unpanic: () => post('/control/unpanic'),
    status: () => get('/control/status'),
  },
  rules: {
    list: () => get('/rules'),
    create: (body: unknown) => post('/rules', body),
    update: (id: string, body: unknown) => put(`/rules/${id}`, body),
    delete: (id: string) => del(`/rules/${id}`),
  },
  config: {
    tiers: () => get('/config/tiers'),
    saveTiers: (body: unknown) => put('/config/tiers', body),
    settings: () => get('/config/settings'),
    saveSettings: (body: unknown) => put('/config/settings', body),
    saveThresholds: (body: unknown) => put('/config/thresholds', body),
  },
  blacklist: {
    list: () => get('/blacklist'),
    add: (body: unknown) => post('/blacklist', body),
    remove: (ip: string) => del(`/blacklist/${encodeURIComponent(ip)}`),
  },
  whitelist: {
    list: () => get('/whitelist'),
    add: (body: unknown) => post('/whitelist', body),
    remove: (ip: string) => del(`/whitelist/${encodeURIComponent(ip)}`),
  },
  upstreams: () => get('/upstreams'),
  intelligence: {
    clusters: (limit = 20) => get(`/intelligence/clusters?limit=${limit}`),
    blockCluster: (fingerprint: string) => post('/intelligence/block-cluster', { fingerprint }),
  },
  xdp: {
    stats: () => get('/xdp/stats'),
    blocklist: () => get('/xdp/blocklist'),
    unblock: (ip: string) => del(`/xdp/block/${encodeURIComponent(ip)}`),
  },
}
