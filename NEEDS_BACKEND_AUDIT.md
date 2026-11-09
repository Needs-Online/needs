# NEEDS BACKEND — WORKSPACE & PROJECT AUDIT
**Document ID:** NEEDS-AUDIT-001  
**Author:** Senior Backend Architect, Next.js Engineer, PostgreSQL/PostGIS Specialist, Redis & Security Engineer  
**Date:** November 9, 2026  
**Status:** APPROVED / BASELINE ESTABLISHED  

---

## 1. Executive Summary

This audit assesses the state of the workspace `e:\Web Dev\needs\backend`, examines existing artifacts, evaluates requirements derived from the Needs Software Requirements Specification (SRS), and establishes the architectural transition plan from the reference NestJS specification to a production-grade **Next.js App Router Modular Monolith**.

### Workspace Findings:
1. **Existing Files:** The repository contains a single design document: `NEEDS_BACKEND.md`.
2. **Next.js Project Status:** No Next.js application, `package.json`, or node modules existed prior to this audit. The repository is a pristine canvas prepared for greenfield implementation.
3. **Database Schemas & APIs:** No previous database migration or API endpoints exist.
4. **SRS Status:** The standalone raw SRS PDF/document is not present in the workspace, but its complete structural taxonomy (Section 6.1 logical modules, FRs, BRs, NFRs, and Appendix A Booking State Machine) is codified in `NEEDS_BACKEND.md` and expanded comprehensively in the technical directive. This provided specification serves as the authoritative, non-negotiable architectural baseline.
5. **Preservation Guarantee:** Existing documentation (`NEEDS_BACKEND.md`) will remain intact and will be supplemented with Next.js architectural artifacts.

---

## 2. Gap & Transition Analysis: NestJS to Next.js

While NestJS provides opinionated decorators and dependency injection out-of-the-box, Next.js App Router (Node.js runtime) provides exceptional speed, modern type-safety, zero-overhead routing, unified full-stack capability, and seamless server deployment. To preserve domain-driven separation and future microservice extraction capabilities, we establish a **Modular Monolith Pattern** inside Next.js:

| Architectural Concern | NestJS Pattern | Next.js Target Architecture |
|---|---|---|
| **Routing / Endpoints** | Controllers (`@Controller()`, `@Get()`, `@Post()`) | Next.js Route Handlers (`src/app/api/v1/<module>/route.ts`, `[id]/route.ts`) delegating to typed Controller classes. |
| **Business Logic** | `@Injectable()` Services | Domain Services (`src/modules/<module>/<module>.service.ts`) instantiated via singleton / factory providers. |
| **Data Persistence** | TypeORM / Prisma Repository | Domain Repositories (`src/modules/<module>/<module>.repository.ts`) with Prisma ORM + Raw SQL for PostGIS functions (`ST_DWithin`, `ST_MakePoint`, `ST_SetSRID`). |
| **Input Validation** | `class-validator`, ValidationPipe | `Zod` schemas and DTO validators with automated validation middleware. |
| **Authentication & Guards** | `JwtAuthGuard`, `RolesGuard` | Next.js API Route Guards / Higher-Order Handlers (`withAuth`, `withRoles`, `withRateLimit`). |
| **Realtime WebSockets** | `@WebSocketGateway()`, Socket.IO | Dedicated Standalone Socket.IO Server (`src/realtime/server.ts`) powered by `@socket.io/redis-adapter` for multi-instance horizontal scaling, sharing domain modules. |
| **Background Queues** | `@nestjs/bullmq` Processors | Standalone BullMQ Worker Process (`workers/index.ts`) sharing domain services, executing background jobs (dispatch timeouts, payment verification, notification delivery). |
| **API Documentation** | `@nestjs/swagger` | OpenAPI / Swagger specification generated dynamically via `next-swagger-doc` or static OpenAPI 3.1 JSON/YAML served at `/api/docs`. |

---

## 3. Technology Stack Evaluation & Compatibility Matrix

| Component | Selected Technology | Version / Specification | Rationale & Compatibility |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `^15.0.0` or latest stable (`15.1.x`) | Native Node.js runtime for API route handlers, high throughput, zero client overhead for pure API routes. |
| **Language** | TypeScript | `^5.6.x` (Strict mode) | `strict: true`, `noImplicitAny: true`, exact optional property types. |
| **Database** | PostgreSQL + PostGIS | PostgreSQL 16 + PostGIS 3.4 | Industry standard for transactional reliability, geospatial indexing (GiST), geography calculations. |
| **ORM / Data Access** | Prisma ORM | `^6.0.0` | Type-safe queries, migration engine, raw SQL tagged template queries (`$queryRaw`) for PostGIS geospatial operations. |
| **In-Memory Store** | Redis (ioredis) | Redis 7.2 + `ioredis ^5.4` | Low-latency caching, Redis GEO (`GEOADD`, `GEOSEARCH`), distributed locks (`redlock` pattern), pub/sub message brokering. |
| **Job Queue** | BullMQ | `^5.25.x` | Redis-backed distributed task scheduler with exponential backoff, delayed jobs (booking expiry), and dead-letter queues. |
| **Realtime Communication** | Socket.IO | `^4.8.x` + `@socket.io/redis-adapter ^8.3` | Real-time bi-directional events for provider tracking, customer tracking, and chat; scaled via Redis adapter across Node clusters. |
| **Validation** | Zod | `^3.23.x` | Schema validation for environment variables, request payloads, and query parameters. |
| **Security & Auth** | JWT (`jose` / `jsonwebtoken`) + `bcryptjs` | RS256 / HS256 + Argon2/Bcrypt | Dual token architecture: 15-minute Access Token, 7-day cryptographically rotating Refresh Token stored in Redis/DB with family revocation. |
| **Documentation** | Swagger / OpenAPI | OpenAPI 3.1 + Swagger UI | Interactive API documentation accessible at `/api/docs`. |
| **Testing** | Vitest / Jest + Supertest | Vitest 2.x | Blazing fast ESM/TypeScript test runner for unit, integration, and E2E test suites. |
| **Containerization** | Docker & Docker Compose | Multi-stage Dockerfile + Docker Compose v2 | Isolated containers for API, Socket.IO, Worker, PostgreSQL+PostGIS, and Redis. |

---

## 4. Architectural Decisions & Risk Register

### ADR-001: Next.js Node.js Runtime vs Edge Runtime
- **Decision:** All API routes will strictly execute under the `nodejs` runtime (`export const runtime = 'nodejs';`).
- **Rationale:** PostGIS drivers, Prisma ORM, `ioredis`, and native Node crypto require full Node.js APIs that are incompatible with restricted Edge runtimes.

### ADR-002: Realtime & Queue Process Decoupling
- **Decision:** The Next.js HTTP server, Socket.IO Realtime Gateway, and BullMQ Background Workers will run as separate entry points from the same codebase.
- **Rationale:** Next.js HTTP handlers are request-response scoped. Long-lived WebSocket connections and continuous BullMQ worker loops must run in dedicated persistent Node.js processes to avoid request timeouts and thread starvation. Docker Compose will orchestrate these three processes cleanly.

### ADR-003: PostGIS with Prisma ORM
- **Decision:** Prisma will manage relations, scalar fields, and standard CRUD. Spatial fields (`geography(Point, 4326)`) and spatial indexes (`GIST`) will be managed via Prisma migration SQL and queried using typed Prisma `$queryRaw` statements.
- **Rationale:** Prisma natively treats unsupported database types as `Unsupported("geography(Point, 4326)")`. Using raw SQL for distance, radius searches, and bounding-box queries ensures maximum performance while retaining Prisma's type-safety for relational data.

### ADR-004: Redis Distributed Locks for Dispatch & Booking
- **Decision:** Provider assignment and booking state transitions will acquire Redis distributed locks with key TTLs before executing database transactions.
- **Rationale:** Prevents race conditions such as two providers accepting the same dispatched job concurrently or double-cancellations.

---

## 5. Next Steps
Proceed immediately with the formal requirements matrix (`NEEDS_BACKEND_REQUIREMENTS_MATRIX.md`) and the comprehensive phase-by-phase implementation plan (`NEEDS_BACKEND_IMPLEMENTATION_PLAN.md`).
