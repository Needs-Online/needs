# NEEDS BACKEND — DEPLOYMENT & OPERATIONS GUIDE
**Document ID:** DEP-001  
**Author:** DevOps & Infrastructure Engineer  
**Date:** November 9, 2026  
**Status:** PRODUCTION READY  

---

## 1. Prerequisites

- **Node.js:** v20.x or v22.x LTS
- **npm:** v10.x or higher
- **Docker & Docker Compose:** Docker Engine 24+, Compose v2
- **PostgreSQL:** 16+ with PostGIS 3.4+ extension
- **Redis:** 7.x

---

## 2. Local Development Setup

### 2.1 Clone and Environment Setup
```bash
cd backend
cp .env.example .env
```

### 2.2 Install Dependencies
```bash
npm install
```

### 2.3 Generate Prisma Client & Run Migrations
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 2.4 Start Development Services
Run the three independent processes in separate terminals or background services:

1. **Next.js API Server:**
   ```bash
   npm run dev
   # Server runs at http://localhost:3000
   # Swagger documentation at http://localhost:3000/api/docs
   ```

2. **Socket.IO Realtime Gateway:**
   ```bash
   npm run realtime
   # Realtime server runs on port 4001
   ```

3. **BullMQ Background Worker:**
   ```bash
   npm run worker
   # Headless job consumer listening to Redis
   ```

---

## 3. Docker Compose Orchestration

The platform provides a complete multi-container Docker Compose configuration in `docker/docker-compose.yml`.

### 3.1 Start Complete Stack
```bash
cd backend/docker
docker compose up -d --build
```

### 3.2 Containers Provisioned
| Container Name | Image / Build | Port | Health Check |
|---|---|---|---|
| `needs-postgres` | `postgis/postgis:16-3.4-alpine` | `5432:5432` | `pg_isready -U postgres -d needs_db` |
| `needs-redis` | `redis:7-alpine` | `6379:6379` | `redis-cli ping` |
| `needs-api` | `backend/docker/Dockerfile` (`target: runner`) | `3000:3000` | HTTP GET `/api/v1/health/liveness` |
| `needs-realtime`| `backend/docker/Dockerfile` (`npm run realtime`) | `4001:4001` | HTTP GET `http://localhost:4001/` |
| `needs-worker` | `backend/docker/Dockerfile` (`npm run worker`) | Internal | Process daemon |

### 3.3 Check Logs & Health
```bash
docker compose ps
docker compose logs -f api
docker compose logs -f realtime
docker compose logs -f worker
```

---

## 4. Verification & Health Monitoring

### 4.1 Liveness Probe
```bash
curl -i http://localhost:3000/api/v1/health/liveness
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Liveness probe healthy",
  "data": {
    "status": "UP",
    "uptime": 12.34,
    "timestamp": "2026-11-09T17:30:00.000Z"
  }
}
```

### 4.2 Readiness Probe
```bash
curl -i http://localhost:3000/api/v1/health/readiness
```
**Expected Response (200 OK):**
```json
{
  "success": true,
  "message": "Readiness probe healthy",
  "data": {
    "status": "UP",
    "timestamp": "2026-11-09T17:30:00.000Z",
    "checks": {
      "database": { "status": "UP", "latencyMs": 2 },
      "redis": { "status": "UP", "latencyMs": 1 },
      "queues": { "status": "UP", "latencyMs": 1 }
    }
  }
}
```

---

## 5. Production Environment Checklist

- [x] Configure dedicated persistent Node.js hosts (e.g. AWS ECS / DigitalOcean Kubernetes / Railway Persistent Containers).
- [x] Set strong random secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (minimum 32 characters).
- [x] Provision managed PostgreSQL with PostGIS extension enabled.
- [x] Provision high-availability Redis with persistence (AOF/RDB).
- [x] Configure SSL/TLS termination at load balancer / Nginx.
- [x] Verify CORS origin headers matching production domain.
