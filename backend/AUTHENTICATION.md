# Needs Backend — Authentication & Session Management
**Version:** 1.0.0  
**Phase:** 2  

---

## 1. Overview

The Needs platform implements an OTP-based passwordless authentication flow tailored for mobile users in Bangladesh. Users authenticate using their mobile phone number via SMS OTP, after which short-lived JWT access tokens and long-lived rotating refresh tokens are issued.

---

## 2. Phone Number Validation & Normalization

All phone numbers are validated and converted into canonical E.164 format: `+8801[3-9]\d{8}` (14 characters total).

Supported input formats:
- Local national format: `01712345678`
- National with prefix: `8801712345678`
- International E.164: `+8801712345678`
- Formats with whitespace, hyphens, or parentheses: `01712-345 678`

Supported Bangladesh mobile operator prefixes:
- **Grameenphone / Skitto:** `013`, `017`
- **Banglalink:** `014`, `019`
- **Teletalk:** `015`
- **Robi / Airtel:** `016`, `018`

Invalid prefixes (such as `010`, `011`, `012`) and non-Bangladeshi numbers are strictly rejected with a `400 Bad Request`.

---

## 3. OTP Flow & Abuse Protection (BR-08)

1. **Generation:** Cryptographically secure 6-digit random integer generated using Node.js `crypto.randomInt(100000, 1000000)`.
2. **Storage:**
   - Stored in Redis under key `otp:data:{phone}`.
   - OTP values are hashed using bcrypt before Redis insertion; plaintext OTPs are never stored.
   - Time-To-Live (TTL): 300 seconds (5 minutes).
3. **Resend Throttling:**
   - Redis key `otp:resend:{phone}` tracks dispatch frequency.
   - Maximum 3 OTP requests per hour per phone number.
4. **Attempt Limits:**
   - Maximum 5 failed verification attempts per OTP session.
   - Exceeding 5 attempts immediately deletes the session from Redis.
5. **Provider Abstraction:**
   - Defined via `OtpProvider` interface.
   - Development environment utilizes `MockOtpAdapter` which logs redacted dispatch information.
   - Production environment routes through `SmsOtpAdapter` connected to licensed Bangladesh SMS aggregators.

---

## 4. JWT Dual-Token & Refresh Token Rotation

| Token Type | Lifetime | Algorithm | Storage / Transport | Purpose |
|:---|:---|:---|:---|:---|
| **Access Token** | 15 Minutes | HS256 | `Authorization: Bearer <token>` | Stateless request authorization with claims (`userId`, `role`, `phone`) |
| **Refresh Token** | 7 Days | HS256 | JSON payload / Secure Cookie | Single-use token exchange for session renewal |

### Single-Use Refresh Token Rotation
- When `POST /api/v1/auth/token/refresh` is called:
  1. The incoming refresh token is verified for signature and expiration.
  2. The SHA-256 hash of the token is matched against the database `user_sessions` table.
  3. If valid, the current session is marked `isValid: false`.
  4. A new access token and a new refresh token are generated.
  5. The new refresh token's SHA-256 hash is recorded in a new session record.

### Token Reuse / Theft Detection
If an invalidated refresh token is presented for refresh:
- The system recognizes this as an attempt to reuse a consumed token (a signature of token theft).
- **Security Action:** All active sessions belonging to that user's token family are immediately revoked (`isValid: false`).
- A `401 Unauthorized` is returned, forcing all client devices to re-authenticate via OTP.

---

## 5. Session Management Endpoints

- `POST /api/v1/auth/otp/send`: Request a 6-digit OTP.
- `POST /api/v1/auth/otp/verify`: Verify OTP; returns access token, refresh token, and user profile.
- `POST /api/v1/auth/token/refresh`: Exchange refresh token for fresh token pair.
- `POST /api/v1/auth/logout`: Revoke current session.
- `POST /api/v1/auth/logout-all`: Invalidate all active sessions across all devices for the user.
- `GET /api/v1/auth/sessions`: List active device sessions (deviceInfo, IP, user-agent, createdAt, expiresAt).
- `DELETE /api/v1/auth/sessions/[id]`: Revoke a specific active session.
