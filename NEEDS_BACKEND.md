# Needs Backend: NestJS Project Structure

Stack: NestJS (TypeScript) + PostgreSQL/PostGIS + Redis (GEO, Pub/Sub, locks) + BullMQ + WebSocket (Socket.IO)
Architecture: **Modular monolith**. Each module maps to one logical service from the SRS (section 6.1), so it can be split into a microservice later.

---

## 1. Folder Tree

```
needs-backend/
├── src/
│   ├── main.ts                      # Bootstrap, Swagger (OpenAPI), global pipes
│   ├── app.module.ts                # Root module
│   │
│   ├── config/                      # Env config (typed, validated)
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── payment.config.ts        # bKash, Nagad, SSLCommerz
│   │   └── env.validation.ts        # Joi / zod schema
│   │
│   ├── common/                      # Shared, no business logic
│   │   ├── decorators/              # @CurrentUser(), @Roles(), @Public()
│   │   ├── guards/                  # JwtAuthGuard, RolesGuard
│   │   ├── filters/                 # Global exception filter
│   │   ├── interceptors/            # Logging, response transform, idempotency
│   │   ├── pipes/
│   │   ├── dto/                     # PaginationDto, etc.
│   │   ├── enums/                   # Role, BookingStatus, PaymentMethod
│   │   ├── constants/
│   │   └── utils/                   # geo helpers, otp helper, money helper
│   │
│   ├── database/
│   │   ├── database.module.ts
│   │   ├── migrations/
│   │   └── seeds/                   # Categories, admin roles
│   │
│   ├── infra/                       # Technical adapters (external services)
│   │   ├── redis/                   # Redis client, GEO helper, distributed lock
│   │   ├── queue/                   # BullMQ setup
│   │   ├── storage/                 # S3-compatible upload, signed URLs
│   │   ├── sms/                     # SSLWireless adapter
│   │   ├── push/                    # FCM adapter
│   │   ├── maps/                    # Google Maps / Mapbox adapter
│   │   └── telephony/               # Masked call provider adapter
│   │
│   └── modules/                     # Business modules (1 module = 1 domain)
│       ├── auth/                    # OTP, JWT, refresh token, sessions
│       ├── users/                   # User profile, addresses, language
│       ├── providers/               # ProviderProfile, KYC, verification status
│       ├── catalog/                 # Category, Service, pricing types
│       ├── location/                # Provider live location ingest + nearby query
│       ├── dispatch/                # Ranking, request timeout, re-dispatch
│       ├── bookings/                # Booking lifecycle state machine, events
│       ├── tracking/                # Live tracking gateway (WebSocket)
│       ├── chat/                    # In-app chat (WebSocket)
│       ├── payments/                # Gateways, webhooks, ledger
│       ├── wallet/                  # Customer/provider wallet, payouts
│       ├── coupons/                 # Promo, referral
│       ├── reviews/                 # Ratings, moderation
│       ├── notifications/           # Push + SMS fallback, in-app center
│       ├── support/                 # Complaints, tickets, FAQ
│       ├── admin/                   # Back-office APIs, audit log, RBAC
│       ├── analytics/               # Event tracking, reports (ClickHouse)
│       └── health/                  # Liveness / readiness checks
│
├── test/
│   ├── e2e/
│   └── fixtures/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml           # app, postgres+postgis, redis
├── k8s/                             # Kubernetes manifests (later)
├── .env.example
├── nest-cli.json
├── tsconfig.json
├── package.json
└── README.md
```

---

## 2. Standard Module Layout

Every module under `src/modules/` follows the same shape:

```
bookings/
├── bookings.module.ts
├── bookings.controller.ts           # REST endpoints
├── bookings.service.ts              # Business logic
├── bookings.repository.ts           # DB queries (optional, keeps service clean)
├── bookings.gateway.ts              # WebSocket (only if realtime needed)
├── dto/
│   ├── create-booking.dto.ts
│   └── update-booking-status.dto.ts
├── entities/
│   ├── booking.entity.ts
│   └── booking-event.entity.ts
├── state/
│   └── booking.state-machine.ts     # Allowed transitions (FR-BKG-04)
├── events/
│   └── booking-status-changed.event.ts
├── processors/
│   └── booking-expiry.processor.ts  # BullMQ job
└── tests/
    ├── bookings.service.spec.ts
    └── bookings.controller.spec.ts
```

---

## 3. Key Module Notes (SRS mapping)

| Module | SRS refs | Important notes |
|---|---|---|
| auth | FR-AUTH-01..04, NFR-SEC-04 | OTP expiry 5 min, resend limit, rate limiting |
| providers | FR-PRV-*, BR-01 | New provider = `Pending`, only `Approved` gets jobs |
| location | FR-MAP-*, NFR-PERF-01 | Redis GEO sets per city + category, Postgres only snapshots |
| dispatch | FR-DSP-*, BR-02, BR-06 | Redis lock to prevent double assignment (FR-DSP-04) |
| bookings | FR-BKG-*, Appendix A | State machine, every change writes a `BookingEvent` |
| payments | FR-PAY-*, NFR-REL-04, NFR-SEC-05 | Idempotency keys, webhook signature verification |
| wallet | FR-PAY-03/05/06/07, BR-09 | Immutable ledger, append-only |
| admin | FR-ADM-*, NFR-SEC-06 | RBAC (SuperAdmin, Operations, Support, Finance), audit log |
| analytics | Targeted offers | Events to ClickHouse, KYC data never used |

---

## 4. Module Dependency Rules

- `common/` and `infra/` can be imported by anyone.
- Modules talk to each other through **service exports or events**, never by touching another module's tables directly.
- `dispatch` -> uses `location`, `providers`, `bookings`
- `bookings` -> emits events; `notifications`, `tracking`, `analytics` listen
- `payments` / `wallet` never import `bookings` internals, they listen to `booking.completed`

This keeps the later microservice split cheap.

---

## 5. Realtime Flow (WebSocket)

```
Provider app --(location every 5s)--> location.gateway --> Redis GEO + Pub/Sub
Customer app <--(provider position)-- tracking.gateway <-- Redis Pub/Sub
Dispatch --(job request)--> provider socket (target < 2s, NFR-PERF-03)
```

Use the Redis adapter for Socket.IO so multiple app instances can scale horizontally (NFR-SCL-04).

---

## 6. Recommended Packages

```
@nestjs/config  @nestjs/swagger  @nestjs/jwt  @nestjs/passport
@nestjs/websockets  @nestjs/platform-socket.io  @nestjs/throttler
@nestjs/bullmq  bullmq  ioredis  @socket.io/redis-adapter
typeorm  (or prisma)  pg  class-validator  class-transformer
firebase-admin  @aws-sdk/client-s3
```

## 7. Start Order (suggested)

1. `config`, `common`, `database`, `infra/redis`
2. `auth` -> `users`
3. `catalog` -> `providers` (+ admin approval)
4. `location` -> `bookings` -> `dispatch`
5. `notifications` -> `reviews` -> basic `admin`
6. (Phase 2) `tracking`, `chat`, `payments`, `wallet`, `coupons`
