# WAF Enterprise-Grade 2026 — Dashboard

Real-time monitoring and management dashboard for a Web Application Firewall (WAF), built for the WAF Mini Hackathon 2026.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js · Express · TypeScript |
| Frontend | React 18 · Vite · TailwindCSS · Recharts |
| Real-time | SSE (Server-Sent Events) |
| Runtime | tsx (dev) |

## Project Structure

```
dashboard/
├── src/                  # Express backend
│   ├── index.ts          # Entry point, routes, SSE
│   ├── mockData.ts       # Mock data generator
│   └── types.ts          # Shared type definitions
├── frontend/             # React frontend (Vite)
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/        # Dashboard pages
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities
│   └── vite.config.ts
├── public/               # Built frontend (served by Express)
└── requirements/         # Hackathon rules & blueprint
```

## Installation

```bash
# Install dependencies for both backend and frontend
npm run install:all
```

## Development

```bash
# Run backend (port 3001) + frontend (port 5173) concurrently
npm run dev
```

- Frontend dev server: http://localhost:5173
- Backend API: http://localhost:3001
- SSE live feed: http://localhost:3001/api/v1/events/live

## Production Build

```bash
# Build frontend → public/
npm run build

# Start production server (serves frontend + API on port 3001)
npm start
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/events/live` | SSE real-time event stream |
| GET | `/api/v1/events/history` | Request history (max 1000) |
| GET | `/api/v1/stats` | Aggregated statistics |
| GET | `/api/v1/rules` | List WAF rules |
| POST | `/api/v1/rules` | Create a new rule |
| PUT | `/api/v1/rules/:id` | Update a rule |
| DELETE | `/api/v1/rules/:id` | Delete a rule |
| GET | `/api/v1/blacklist` | List blocked IPs |
| POST | `/api/v1/blacklist` | Add IP to blacklist |
| DELETE | `/api/v1/blacklist/:ip` | Remove IP from blacklist |
| GET | `/api/v1/whitelist` | List allowed IPs |
| GET | `/api/v1/intelligence/clusters` | Fingerprint clusters |
| POST | `/api/v1/intelligence/block-cluster` | Block by fingerprint |
| GET | `/api/v1/xdp/stats` | XDP/eBPF Layer 4 stats |
| POST | `/api/v1/control/panic` | Enable Panic Mode |
| POST | `/api/v1/control/unpanic` | Disable Panic Mode |

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `WAF_BRIDGE` | `http://127.0.0.1:9091` | Real WAF bridge address |
