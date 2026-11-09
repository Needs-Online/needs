# NEEDS BACKEND — SECURITY ARCHITECTURE & AUDITED POLICY
**Document ID:** SEC-001  
**Author:** Senior Security & Backend Engineer  
**Date:** November 9, 2026  
**Status:** PHASE 1 HARDENED & AUDITED  

---

## 1. Security Principles

The Needs Backend enforces strict defense-in-depth security:
1. **Never trust client-supplied identity, headers or confirmations.**
2. **Fail fast on invalid or insecure production configuration.**
3. **No plain-text storage of credentials, refresh tokens or OTPs.**
4. **Zero hardcoded credentials in source control; `.env` strictly excluded.**
5. **Zero KYC / personal data exposure to marketing or analytics.**
6. **Database foreign key constraints prevent silent deletion of financial audit trails.**

---

## 2. Authentication & Session Security (Phase 1 Implemented Controls)

### 2.1 Dual-Token Architecture
- **Access Token:**
  - Explicit algorithm: `HS256`.
  - Configured Issuer: `needs-backend`.
  - Configured Audience: `needs-app`.
  - Short-lived: 15 minutes (`JWT_ACCESS_EXPIRY = 900`).
  - Strict Claims Validation: Rejects malformed tokens missing valid `userId`, `role`, or `phone`.
- **Refresh Token & Family Rotation:**
  - Long-lived: 7 days (`JWT_REFRESH_EXPIRY = 604800`).
  - Stored in PostgreSQL `user_sessions` exclusively as a SHA-256 cryptographic digest (`refreshTokenHash`).
  - **Family Revocation on Reuse:** If an expired or already-invalidated token is re-submitted, the system flags token theft and immediately revokes all active sessions for that user account (`authRepo.invalidateAllUserSessions`).

### 2.2 OTP Security & Abuse Prevention (BR-08)
- Cryptographic PRNG generation: `crypto.randomInt(100000, 999999)`.
- Stored exclusively in Redis hashed with `bcrypt` (salt rounds: 8).
- Strictly 5-minute validity (`OTP_EXPIRY_SECONDS = 300`).
- **Resend Limits:** Maximum 3 OTP requests per hour per phone number.
- **Brute-Force Lockout:** Maximum 5 failed verification attempts before the OTP is purged from Redis.
- **Zero Logging:** Plaintext OTP codes are never logged in production.

---

## 3. Rate Limiting & IP Spoofing Defense

Implemented via Redis sliding-window token bucket (`src/common/middleware/rate-limiter.ts`):
- **IP Extraction Defense:** To prevent attackers from bypassing IP rate limits by sending fake `X-Forwarded-For` headers, the system:
  1. Inspects trusted reverse proxy headers (`cf-connecting-ip`, `x-real-ip`).
  2. For multi-hop proxies, validates and selects the rightmost trusted proxy hop from `X-Forwarded-For`.
  3. Validates against strict IPv4 / IPv6 syntax.
- **Endpoint Limits:**
  - `rl:otp:send:<ip>`: Maximum 5 requests per 10 minutes per IP.
  - `rl:otp:verify:<ip>`: Maximum 10 attempts per 10 minutes per IP.
  - Global API: Throttles with HTTP 429 and `Retry-After` header.

---

## 4. Concurrency & Distributed Locking (BR-03)

- **Lock Implementation:** Single-instance atomic Redis distributed lock using `SET lockKey lockToken PX ttlMs NX` and atomic Lua script release:
  ```lua
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
  ```
- **Clarification:** This is a **single-instance Redis lock**, not a multi-master consensus Redlock cluster.
- **Final Correctness Guarantee:** Redis locks reduce race condition contention at the edge, but PostgreSQL transactions (`prisma.$transaction`), unique constraints (`booking_assignments`, `user_sessions`), and conditional row updates remain the ultimate transactional correctness guarantee.

---

## 5. Input Validation & SQL Injection Defense

- All HTTP bodies, queries, and route parameters are parsed and validated via strict **Zod schemas**.
- No raw string concatenation into SQL statements. Prisma ORM parameterized queries are used for relational operations, and tagged template literals (`prisma.$queryRaw<T>...`) are used for PostGIS functions to prevent SQL injection.

---

## 6. Audit Logging & Sensitive Data Redaction

- Structured logger (`pino`) automatically redacts sensitive fields using recursive wildcards:
  - `req.headers.authorization`
  - `password`, `*.password`
  - `token`, `*.token`, `refreshToken`, `*.refreshToken`
  - `otp`, `*.otp`, `rawOtp`, `*.rawOtp`, `startOtp`, `*.startOtp`, `endOtp`, `*.endOtp`
  - `nidNumber`, `*.nidNumber`, `tradeLicenseNumber`, `*.tradeLicenseNumber`
  - `nidFrontUrl`, `*.nidFrontUrl`, `nidBackUrl`, `*.nidBackUrl`

---

## 7. Data Retention & Integrity Protection

- Deletion policies on financial ledger tables (`wallets`, `wallet_transactions`, `payout_requests`, `payments`) and lifecycle history (`booking_events`) use `onDelete: Restrict`.
- Soft-deletion (`deletedAt`) is used on `users` to ensure account deactivations never trigger cascade deletion of financial transactions.
