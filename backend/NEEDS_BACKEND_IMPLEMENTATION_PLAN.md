# NEEDS BACKEND — MASTER IMPLEMENTATION PLAN
**Document ID:** NEEDS-PLAN-001  
**Author:** Senior Backend Architect & Technical Lead  
**Date:** November 9, 2026  
**Status:** ACTIVE EXECUTION BLUEPRINT  

---

## 1. Plan Overview & Architectural Directives

This document details the multi-phase roadmap to build the **Needs Backend** using Next.js App Router (Node.js runtime), PostgreSQL with PostGIS, Prisma ORM, Redis (ioredis), BullMQ, and Socket.IO.

### Non-Negotiable Standards:
- Production-grade modular monolith architecture.
- Strict TypeScript (`strict: true`, no `any`, typed errors).
- Zero mock data in production paths.
- All monetary transactions tracked via immutable double-entry ledger.
- Redis distributed locks on critical paths (dispatch, assignment, checkout).
- Every phase verified with automated unit/integration tests and type checking.

---

## 2. Phase-by-Phase Roadmap

### PHASE 1: Architectural Foundation & Core Infrastructure
*Goal: Establish containerized infrastructure, project scaffolding, schema definition, type-safe configuration, database migrations, Redis connection, BullMQ queue scaffolding, and health endpoints.*

- [x] **Audit and Requirements Analysis**: Produce `NEEDS_BACKEND_AUDIT.md`, `NEEDS_BACKEND_REQUIREMENTS_MATRIX.md`, and `NEEDS_BACKEND_IMPLEMENTATION_PLAN.md`.
- [ ] **Next.js & Workspace Initialization**:
  - Initialize Next.js App Router project with TypeScript strict mode, ESLint, and Prettier.
  - Setup path aliases (`@/modules/*`, `@/common/*`, `@/config/*`, `@/infra/*`, `@/lib/*`, `@/realtime/*`, `@/workers/*`).
- [ ] **Zod Environment Validation**:
  - Define robust schema for `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT`, `SOCKET_PORT`, `BKASH_*`, `NAGAD_*`, `SSLCOMMERZ_*`, etc.
  - Create fail-fast validator at application bootstrap.
- [ ] **Prisma & PostGIS Database Modeling**:
  - Initialize `prisma/schema.prisma` with all 25+ domain models.
  - Enable PostGIS extension and declare spatial geography types with raw SQL migration scripts.
  - Implement seed script (`prisma/seed.ts`) with default admin roles, service categories, and test fixtures.
- [ ] **Redis & BullMQ Infrastructure**:
  - Configure resilient `ioredis` singleton with automatic reconnection, error handlers, and key prefixing.
  - Configure BullMQ Queue manager and worker connection pool.
  - Implement Redis distributed locking helper (`withDistributedLock`).
- [ ] **Common Utilities & Middlewares**:
  - Standard JSON response envelope (`ApiResponse<T>`).
  - Global error handler and HTTP status translation.
  - API route guards: `withAuth`, `withRoles`, `withValidation`.
- [ ] **Health Check Endpoints**:
  - `/api/v1/health/liveness`
  - `/api/v1/health/readiness` (verifies PostgreSQL connection and Redis PING).
- [ ] **Swagger / OpenAPI Documentation**:
  - OpenAPI 3.1 schema definition and interactive documentation viewer route (`/api/docs`).
- [ ] **Docker & Compose Environment**:
  - Multi-service `docker-compose.yml` (PostgreSQL with PostGIS, Redis 7, Next.js API, Realtime Socket.IO, BullMQ Worker).
  - Production-ready `Dockerfile`.

---

### PHASE 2: Identity, Access Management & Service Catalog
*Goal: Implement secure phone-based OTP authentication, JWT rotation, user profiles, KYC onboarding for service providers, service catalog, and back-office verification.*

- [ ] **Auth Module**:
  - Phone registration & OTP generation (5-minute TTL, bcrypt hashed in Redis).
  - OTP resend rate limiting (max 3 per hour) and brute-force lockout (max 5 invalid attempts).
  - JWT Access Token (15 min) and Refresh Token (7 days) with cryptographically secure token rotation and family revocation.
  - Logout and session invalidation.
- [ ] **Users Module**:
  - User profile management (name, email, avatar, locale preference).
  - Customer address book with coordinates (lat/lng) and default address flags.
  - Account deletion (soft delete & GDPR compliant data purge).
- [ ] **Providers Module**:
  - Provider onboarding with status lifecycle (`PENDING` -> `APPROVED` / `REJECTED` / `SUSPENDED`).
  - Provider KYC document upload and storage metadata (NID, trade license, certificates).
  - Provider service offering bindings (categories and skills).
  - Provider online/offline availability toggle.
- [ ] **Catalog Module**:
  - Hierarchical service categories (e.g., AC Repair, Plumbing, Electrical, Cleaning).
  - Service definitions with pricing types (`FIXED`, `HOURLY`, `CUSTOM_QUOTE`).
  - Category and service activation/deactivation.
- [ ] **Admin Provider Approval**:
  - Back-office review endpoints for KYC documents.
  - Status transition to `APPROVED` with audit logging (only approved providers enter dispatch).

---

### PHASE 3: Spatial Logistics, Dispatch Engine & Booking Lifecycle
*Goal: Build high-performance geospatial location tracking, intelligent dispatch ranking, distributed locking, and the rock-solid booking state machine.*

- [ ] **Location Module**:
  - Provider coordinate ingestion via HTTP endpoint and WebSocket gateway.
  - Redis GEO storage (`GEOADD`) partitioned by city and category.
  - PostGIS spatial query engine (`ST_DWithin`, `ST_DistanceSphere`) for historical snapshots and fallback search.
  - Stale coordinate eviction and freshness checking (15-minute TTL).
- [ ] **Dispatch Engine**:
  - Radius-based provider discovery (starting at 3km, expandable to 10km).
  - Provider ranking algorithm (rating, distance, acceptance rate).
  - Redis distributed lock (`redlock`) during job dispatch to eliminate double-booking.
  - Dispatch job creation with 45-second acceptance timer via BullMQ delayed jobs.
  - Automatic redispatch to candidate #2 if provider #1 rejects or times out.
- [ ] **Bookings Module & State Machine**:
  - Strict booking states: `DRAFT`, `REQUESTED`, `MATCHING`, `ASSIGNED`, `PROVIDER_EN_ROUTE`, `PROVIDER_ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `EXPIRED`.
  - Immutable `BookingEvent` ledger written inside atomic database transactions on every state change.
  - Start-job OTP (customer gives OTP to provider upon arrival to transition to `IN_PROGRESS`).
  - End-job confirmation (transitions to `COMPLETED` and initiates payment/invoice).
- [ ] **Booking Expiry & Background Workers**:
  - BullMQ queue `booking-expiry` to auto-expire unassigned bookings and notify customers.

---

### PHASE 4: Realtime Telemetry, Chat & Multi-Channel Notifications
*Goal: Deploy the standalone Socket.IO server with Redis adapter for live location tracking, customer-provider in-app chat, and reliable notifications.*

- [ ] **Socket.IO Realtime Server**:
  - Standalone server in `src/realtime/server.ts` binding to dedicated port (e.g., 4001).
  - Redis adapter (`@socket.io/redis-adapter`) for multi-replica broadcast synchronization.
  - JWT socket authentication middleware (reject unauthenticated connections).
- [ ] **Tracking Gateway**:
  - Dedicated namespace `/tracking`.
  - Room authorization: only the customer and assigned provider can join `booking:<bookingId>`.
  - High-frequency provider location broadcast (`provider:location:update`).
- [ ] **Chat Gateway**:
  - Dedicated namespace `/chat`.
  - Room authorization for active booking conversation.
  - Persistent message storage in PostgreSQL (`messages`, `conversations`).
  - Read receipts, delivery receipts, and typing indicators.
- [ ] **Notifications Module & Queue**:
  - Multi-channel delivery engine: Firebase Cloud Messaging (FCM) + SMS fallback (SSLWireless) + In-App Notification inbox.
  - BullMQ `notifications` queue with exponential backoff retries.
  - Customer/provider notification preference controls.

---

### PHASE 5: Payments, Double-Entry Wallet, Coupons, Reviews & Support
*Goal: Production payment gateway integrations, immutable financial ledger, dispute handling, coupons, and ratings.*

- [x] **Payment Adapters**:
  - Adapter pattern for Bangladeshi payment gateways: **bKash**, **Nagad**, and **SSLCommerz**.
  - Server-side payment initialization and redirect URL generation.
  - Secure webhook endpoints with HMAC-SHA256 signature verification and replay prevention.
  - Idempotency key tracking in PostgreSQL (`idempotency_keys`).
- [x] **Wallet & Payouts Module**:
  - Double-entry ledger architecture (`wallets`, `wallet_transactions`).
  - Credits and debits recorded with balance verification.
  - Provider earnings calculation, platform commission deduction, and withdrawal/payout requests.
  - Immutable ledger records (no `UPDATE` or `DELETE` allowed on historical transactions).
- [x] **Coupons & Promotions**:
  - Promo code validation engine (percentage discount, fixed discount, max cap).
  - Usage limits per user, expiration dates, and anti-abuse validation.
- [x] **Reviews & Ratings**:
  - Post-service review submission (restricted strictly to verified completed bookings).
  - 1-to-5 star rating with commentary and moderation flags.
  - Automated asynchronous recalculation of provider overall rating.
- [x] **Support Module**:
  - Ticket creation for customers and providers.
  - Ticket priority, status tracking (`OPEN`, `IN_REVIEW`, `RESOLVED`, `CLOSED`), and administrative assignment.

---

### PHASE 6: Analytics, Security Hardening, Verification & Deployment
*Goal: Business analytics, ClickHouse integration readiness, security audits, automated end-to-end testing, and production packaging.*

- [x] **Analytics Module**:
  - Booking conversion metrics, cancellation analysis, and revenue aggregation.
  - ClickHouse event stream adapter interface (ready for high-volume ingest).
  - Strict privacy rule enforcement: zero KYC/PII used in analytics.
- [x] **Admin RBAC & Audit Logging**:
  - Granular RBAC (`SuperAdmin`, `Operations`, `Support`, `Finance`).
  - Immutable audit logs capturing IP address, actor ID, action, and JSON payload diff.
- [x] **Security Hardening**:
  - Rate limiting with Redis token-bucket middleware.
  - Helmet-equivalent security headers, CORS origin whitelisting, input sanitization.
  - Structured logging with Pino (redacting passwords, tokens, and PII).
- [x] **Automated Testing Suite**:
  - Unit tests for services and state machines.
  - Integration tests for API routes, database repositories, and Redis locks.
  - Concurrency tests for double-assignment prevention and duplicate webhook handling.
- [x] **Deployment Deliverables**:
  - Production Docker Compose configuration.
  - Comprehensive documentation (`README.md`, `ARCHITECTURE.md`, `API_DOCUMENTATION.md`, `DATABASE_SCHEMA.md`, `SECURITY.md`, `DEPLOYMENT.md`, `IMPLEMENTATION_STATUS.md`).

---

## 3. Verification & Governance Checkpoints

At the conclusion of each phase, the following gating conditions must pass:
1. `npm run typecheck` passes with zero TypeScript errors.
2. `npm run lint` passes without unresolved warnings.
3. Test suite (`npm test`) passes with 100% success on phase-specific tests.
4. `IMPLEMENTATION_STATUS.md` updated with exact completions and pending items.
