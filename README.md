# Bringits Validation Platform

A command-based validation engine for testing Link services end-to-end.

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS (TypeScript), Prisma ORM, PostgreSQL |
| Frontend | Next.js (App Router), Tailwind CSS |
| Commands | HTTP, Postgres, Redis, Kafka, Wait |
| AI | OpenAI / Groq / Ollama |

## Getting Started

```bash
# Install dependencies
npm install

# Setup database
cd apps/backend
cp .env.example .env   # fill in secrets
npx prisma migrate dev
npx ts-node prisma/seed.ts

# Start backend (port 3002)
PORT=3002 npx ts-node -r tsconfig-paths/register src/main.ts

# Start frontend (port 3000)
cd apps/web
npm run dev
```

## Flows

| Flow | Steps | Description |
|------|-------|-------------|
| Link Platform — Full Integration | 46 | All services, CDC, Redis, cleanup |
| Proxy Bulk Ingest | 7 | BullMQ → enrichment → Postgres |
| Unblocker – Proxy Request Lifecycle | 11 | New domain → CDC → Redis pool |
| Target Delete – Redis Cleanup | 14 | CDC delete → Redis key eviction |
| Link Sync – CDC Simulation | 7 | Debezium CDC create/update/delete |
| Link API – Tenant CRUD | 7 | Full tenant lifecycle |
| Link API – Target CRUD | 7 | Full target lifecycle |
| Link API – Provider CRUD | 8 | Providers + lists |
| Link API – Proxies | 6 | Read + safe delete operations |
| Link API – BullMQ Health | 3 | Queue health check |

## Environment Variables

See `apps/backend/.env` for full list. Key patterns:

```
CONN_<NAME>_URL        # Postgres named connections
REDIS_<NAME>_URL       # Redis named connections  
KAFKA_<NAME>_BROKERS   # Kafka cluster
OPENAI_API_KEY         # AI chat (optional)
```

## Deployment

- **Docker**: `docker build -t bringits-validation-platform .`
- **Kubernetes**: see `pipelines/deploy.yaml` + `shared-deployments/.../bringits-validation-platform/values.yaml`
