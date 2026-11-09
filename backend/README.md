# Needs Platform Backend

A production-grade, scalable, modular monolith backend for the **Needs** service-booking platform, built using **Next.js App Router (Node.js runtime)**, **PostgreSQL 16 + PostGIS**, **Prisma ORM**, **Redis 7 (ioredis)**, **BullMQ**, and **Socket.IO**.

---

## 1. Non-Negotiable Architecture & Technology Stack

- **Framework:** Next.js App Router (Node.js runtime, TypeScript strict mode)
- **Primary Database:** PostgreSQL 16+ with PostGIS extension for spatial computations (`ST_DWithin`, `ST_DistanceSphere`)
- **ORM & Migrations:** Prisma ORM with raw SQL functional GiST spatial indexes
- **Caching & Geospatial Storage:** Redis 7 (ioredis) with Redis GEO, Pub/Sub, and single-instance atomic distributed locking
- **Asynchronous Task Processing:** BullMQ background worker daemon handling 7 distinct queues
- **Real-Time Communication:** Standalone Socket.IO server on dedicated port (4001) with `@socket.io/redis-adapter` for horizontal scaling
- **Authentication & Security:** JWT dual-token architecture with single-use refresh token rotation, token family revocation, and PBKDF2 OTP hashing
- **Payments & Wallets:** Multi-gateway adapter pattern (**bKash**, **Nagad**, **SSLCommerz**) with HMAC webhook validation, and double-entry append-only wallet ledger
- **Documentation:** Interactive OpenAPI 3.1 Swagger UI embedded at `/api/docs`

---

## 2. Decoupled Service Architecture

To prevent long-lived WebSocket connections and background worker jobs from interfering with Next.js HTTP serverless lifecycle, the architecture separates responsibilities into 3 distinct Node.js processes:

```
                      ┌────────────────────────────────────────┐
                      │            Nginx Reverse Proxy          │
                      └────┬──────────────────┬──────────────┬─┘
                           │                  │              │
                    :3000  │           :4001  │              │
                           ▼                  ▼              ▼
           ┌─────────────────────┐   ┌─────────────────┐   ┌─────────────────┐
           │ Next.js App Router  │   │ Socket.IO Server│   │  BullMQ Worker  │
           │  (REST API Server)  │   │ (Realtime Sync) │   │ (Backgrounds)   │
           └──────────┬──────────┘   └────────┬────────┘   └────────┬────────┘
                      │                       │                     │
                      └───────────────┬───────┴─────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
               ┌───────────────────┐     ┌───────────────────┐
               │ PostgreSQL 16     │     │ Redis 7           │
               │  + PostGIS        │     │  + GEO + Pub/Sub  │
               └───────────────────┘     └───────────────────┘
```

1. **Next.js App Router (`npm run start`):** Runs on port 3000, serving stateless REST API endpoints and Swagger UI.
2. **Realtime Server (`npm run realtime`):** Standalone HTTP + Socket.IO server on port 4001 with Redis adapter, handling `/tracking` and `/chat` gateways.
3. **BullMQ Background Worker (`npm run worker`):** Long-running worker daemon processing background jobs: dispatch timeouts (45s), booking auto-expiry (15m), wallet payouts, push/SMS notifications.

---

## 3. Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma              # 26+ normalized models with RESTRICT deletion constraints
│   └── migrations/
│       └── 20261109000000_init_postgis/
│           └── migration.sql       # PostGIS extension & functional GiST spatial indexes
│
├── src/
│   ├── app/                        # Next.js App Router dynamic route handlers
│   │   ├── api/
│   │   │   ├── docs/               # Interactive Swagger UI (/api/docs)
│   │   │   └── v1/
│   │   │       ├── admin/          # Admin KYC review and provider verification
│   │   │       ├── analytics/      # Business KPIs, revenue breakdown
│   │   │       ├── auth/           # Phone OTP, token rotation, logout
│   │   │       ├── bookings/       # Booking state machine, transition, events ledger
│   │   │       ├── catalog/        # Categories and service offerings
│   │   │       ├── chat/           # Chat conversations history
│   │   │       ├── coupons/        # Promo code validation and management
│   │   │       ├── dispatch/       # Job assignment acceptance/rejection
│   │   │       ├── health/         # Liveness and deep readiness probes
│   │   │       ├── location/       # Provider GPS ingestion and nearby queries
│   │   │       ├── notifications/  # User notification inbox and read controls
│   │   │       ├── payments/       # Payment checkout initiation and webhooks
│   │   │       ├── providers/      # Profile, KYC submission, availability toggle
│   │   │       ├── reviews/        # Ratings and reviews for completed bookings
│   │   │       ├── support/        # Support tickets and threaded messages
│   │   │       ├── users/          # Profile and address book CRUD
│   │   │       └── wallet/         # Balance, top-up, payout withdrawal requests
│   │
│   ├── common/                     # Cross-cutting concerns & shared utilities
│   │   ├── dto/                    # Standardized ApiResponse & pagination DTOs
│   │   ├── enums/                  # System-wide enum definitions
│   │   ├── errors/                 # Centralized AppError hierarchy
│   │   ├── guards/                 # JWT withAuth, withRoles, withAdminAuth
│   │   ├── middleware/             # Redis sliding-window rate limiter
│   │   ├── utils/                  # Structured Pino logger with secret redaction
│   │   └── validators/             # Zod body & query validators
│   │
│   ├── config/                     # Typed Zod environment validation & modular configs
│   ├── database/                   # Prisma singleton & PostGIS spatial query engine
│   ├── docs/                       # OpenAPI 3.1 JSON definition
│   ├── infra/
│   │   ├── queue/                  # BullMQ connection factory & 7 queues manager
│   │   └── redis/                  # ioredis client, GEO helpers, Pub/Sub, distributed locks
│   │
│   ├── modules/                    # Business modules (Domain repositories & services)
│   │   ├── analytics/
│   │   ├── auth/
│   │   ├── bookings/
│   │   ├── catalog/
│   │   ├── coupons/
│   │   ├── dispatch/
│   │   ├── location/
│   │   ├── notifications/
│   │   ├── payments/
│   │   ├── providers/
│   │   ├── reviews/
│   │   ├── support/
│   │   ├── users/
│   │   └── wallet/
│   │
│   └── realtime/                   # Standalone Socket.IO server & specialized gateways
│       ├── chat.gateway.ts         # Persistent messaging, typing, read receipts
│       ├── server.ts               # Standalone server bootstrap on port 4001
│       ├── socket.auth.ts          # Socket handshake JWT verification
│       └── tracking.gateway.ts     # Live GPS tracking & Redis GEO broadcast
│
├── workers/                        # BullMQ background workers
│   ├── booking/                    # Booking auto-expiry processor (15m)
│   ├── dispatch/                   # Dispatch timeout & auto-redispatch (45s)
│   ├── notifications/              # FCM push and SMS delivery processor
│   ├── payment/                    # Double-entry wallet crediting processor
│   └── index.ts                    # Worker daemon bootstrap
│
├── tests/
│   └── unit/                       # 26 unit test suites (85 passing tests)
│
└── docker/
    ├── Dockerfile                  # Multi-stage production container
    └── docker-compose.yml          # 5-service orchestration (DB, Redis, API, Worker, Socket)
```

---

## 4. Getting Started

### 4.1 Prerequisites
- Node.js 20+
- PostgreSQL 16+ with PostGIS extension installed
- Redis 7+

### 4.2 Installation
```bash
cd backend
npm install
```

### 4.3 Environment Configuration
Copy the example environment template:
```bash
cp .env.example .env
```
Fill in valid database and Redis connection strings. In production, strict Zod validation rejects default secrets at boot.

### 4.4 Database Migration
Generate Prisma Client and apply migrations:
```bash
npm run db:generate
npm run db:migrate
```

---

## 5. Running the Application

### Development Mode (3 Separate Terminals)
```bash
# Terminal 1: Next.js API Server (Port 3000)
npm run dev

# Terminal 2: Socket.IO Realtime Gateway (Port 4001)
npm run realtime

# Terminal 3: BullMQ Background Worker Daemon
npm run worker
```

### Production Build & Run
```bash
npm run build
npm run start
```

---

## 6. Docker Orchestration

Run all 5 containers (PostgreSQL+PostGIS, Redis, Next.js API, BullMQ Worker, Socket.IO Server) with one command:
```bash
cd docker
docker compose up -d
```

---

## 7. Verification & Testing

```bash
# Run 85 Vitest unit tests
npm test

# TypeScript typecheck (strict mode)
npm run typecheck

# ESLint code style audit
npm run lint

# Production Next.js build
npm run build
```

---

## 8. Documentation

- **Interactive Swagger UI:** Visit `http://localhost:3000/api/docs` while the API is running.
- **OpenAPI 3.1 Spec:** `src/docs/openapi.json`
- **Markdown API Specification:** `API_DOCUMENTATION.md`
- **Implementation Status Tracker:** `IMPLEMENTATION_STATUS.md`
- **Database Schema Reference:** `DATABASE_SCHEMA.md`
- **Architecture Overview:** `ARCHITECTURE.md`
- **Security Audit:** `SECURITY.md`
