# Needs Backend — Phase 3 Implementation Report
**Document ID:** NEEDS-PHASE3-REPORT  
**Phase:** 3 of 6 (Spatial Logistics, Dispatch Engine & Booking State Machine)  
**Date:** November 10, 2026  
**Status:** COMPLETE & VERIFIED  

---

## 1. Executive Summary

Phase 3 of the Needs Backend has been fully implemented, rigorously verified, and hardened. The platform now possesses high-throughput spatial telemetry tracking, an intelligent multi-factor dispatch engine with dynamic radius expansion, distributed concurrency locking, a strict finite state machine enforcing Appendix A transitions, and cryptographic job verification OTPs.

All deliverables were verified against strict TypeScript compiler checks (`tsc --noEmit`), ESLint standards, a 151-test unit suite (`vitest run`), and Next.js App Router production compilation.

---

## 2. Architecture & Modules Delivered

### 2.1 Spatial Logistics & Telemetry (`src/modules/location/`)
- **Telemetry Ingestion:** Coordinate ingestion endpoint validates Bangladesh geographic bounds (Lat: `20.5`–`26.7`, Lon: `88.0`–`92.7`) with telemetry metadata (`heading`, `speed`, `accuracy`).
- **Partitioned Redis GEO Storage:** High-frequency provider coordinates are saved into partitioned Redis geospatial indexes (`geo:providers:{city}` and `geo:providers:{city}:{categoryId}`) with a 15-minute TTL (`900s`) ensuring coordinate freshness.
- **PostGIS Primary & Fallback Search:** Spatial proximity querying uses PostGIS spherical distance functions (`ST_DWithin`, `ST_DistanceSphere`) backed by spatial GiST indexes on geography points.
- **Pub/Sub Telemetry Streaming:** Every coordinate update dispatches a real-time event to Redis channel `provider:location:{providerId}` for WebSocket broadcast on the `/tracking` gateway.

### 2.2 Intelligent Dispatch Engine (`src/modules/dispatch/`)
- **Dynamic Radius Expansion:** Initial provider discovery scans a 3km window (`3000m`). If fewer than two eligible candidates are found, the engine automatically expands the search radius to 10km (`10000m`).
- **Multi-Factor Ranking Formula:** Candidate providers are scored using a normalized weighted model:
  $$\text{Score} = (\text{Rating Norm} \times 0.40) + (\text{Proximity Norm} \times 0.40) + (\text{Experience Norm} \times 0.20)$$
  - Rating Normalized: $\text{rating} / 5.0$
  - Proximity Normalized: $1 - (\text{distanceMeters} / \text{maxRadius})$
  - Experience Normalized: $\min(\text{completedJobs}, 100) / 100.0$
- **Atomic Concurrency Protection (BR-03):** Assignment operations are guarded with Redis distributed locks (`lock:booking:assign:{bookingId}`) preventing double-booking race conditions between concurrent provider acceptances.
- **45-Second Acceptance Timer (BR-02):** Dispatched offers schedule a BullMQ delayed job (`dispatch-timeout`) with a 45,000ms delay.
- **Automated Redispatch:**
  - If provider declines (`POST /api/v1/dispatch/bookings/:id/reject`), the system immediately marks the assignment `REJECTED` and auto-redispatches to Candidate #2 (excluding already-contacted candidates).
  - If the 45-second timer expires, the BullMQ worker processor marks the assignment `TIMEOUT` and auto-redispatches to Candidate #2.

### 2.3 Booking State Machine & Ledger (`src/modules/bookings/`)
- **Strict State Transitions (Appendix A):**
  - Allowed sequence: `DRAFT` $\to$ `REQUESTED` $\to$ `MATCHING` $\to$ `ASSIGNED` $\to$ `PROVIDER_EN_ROUTE` $\to$ `PROVIDER_ARRIVED` $\to$ `IN_PROGRESS` $\to$ `COMPLETED`.
  - Terminal states: `CANCELLED`, `EXPIRED`.
  - Invalid transitions (e.g. `REQUESTED` directly to `COMPLETED`) are strictly rejected.
- **Cryptographic Job Verification OTPs:**
  - 4-digit numeric cryptographic Start OTP and End OTP are generated upon booking creation (`crypto.randomInt(1000, 10000)`).
  - **Start OTP:** Customer reveals Start OTP to provider upon arrival. Transition to `IN_PROGRESS` requires providing the exact Start OTP.
  - **Masking Policy:** Provider queries cannot see the Start OTP or End OTP until arrival, preventing premature completion fraud.
- **Immutable State Event Ledger (`booking_events`):** Every state transition executes inside an atomic `prisma.$transaction` that records an immutable `BookingEvent` with timestamp, actor ID, actor role, notes, and metadata. Database `ON DELETE RESTRICT` constraints ensure event history cannot be modified.
- **15-Minute Unassigned Expiry Worker:** Delayed BullMQ job (`booking-expiry`) marks unassigned bookings as `EXPIRED` if matching cannot be fulfilled within 15 minutes.

---

## 3. Verification & Quality Gates Summary

| Verification Suite | Target | Result | Notes |
|:---|:---|:---|:---|
| **TypeScript Strictness** | `tsc --noEmit` | **PASS (0 errors)** | Full type safety across Next.js 15 route parameters and DTOs |
| **ESLint** | `next lint` | **PASS (0 warnings)** | Clean code standards |
| **Vitest Unit Suite** | `vitest run` | **PASS (36 files, 151 tests)** | 100% passing across location, dispatch, bookings, OTPs, ranking |
| **Next.js Production Build** | `next build` | **PASS (Exit 0)** | 71 dynamic server-rendered API routes compiled |

---

## 4. Key Endpoints Verified

- `POST /api/v1/location/providers/current`: Ingest provider GPS coordinate with heading, speed, and accuracy.
- `GET /api/v1/location/providers/nearby`: Discover active nearby providers via PostGIS / Redis GEO.
- `POST /api/v1/dispatch/bookings/:id/accept`: Atomically accept job offer under distributed lock.
- `POST /api/v1/dispatch/bookings/:id/reject`: Decline job offer and trigger auto-redispatch.
- `POST /api/v1/bookings`: Create on-demand booking with Bangladesh coordinate boundaries.
- `GET /api/v1/bookings`: List bookings filtered by role, status, and pagination.
- `GET /api/v1/bookings/:id`: Retrieve full booking state (OTPs masked for providers).
- `PATCH /api/v1/bookings/:id/transition`: Execute state transition with action, OTP, or cancellation.
- `GET /api/v1/bookings/:id/events`: Retrieve immutable audit history ledger.

---

## 5. Next Phase Authorization

With Phase 3 verified and fully tested, the backend is structurally prepared for **Phase 4: Realtime Telemetry, Chat & Multi-Channel Notifications**.
