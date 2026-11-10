# Needs Backend — KYC Security & Cryptographic Storage Specification
**Version:** 1.0.0  
**Phase:** 2  

---

## 1. Overview

Service providers on the Needs platform undergo mandatory identity verification (KYC) before being authorized to accept bookings. This document outlines the cryptographic standards, access controls, and data protection mechanisms enforced for sensitive identification materials.

---

## 2. National ID (NID) Validation

Before ingestion, provider NID numbers are strictly validated against national standards:
1. **Smart NID Card:** 10 numeric digits.
2. **Standard NID:** 13 numeric digits.
3. **Legacy NID with Birth Year:** 17 numeric digits (4-digit birth year + 13-digit sequence).

Any entry containing alphabetical characters, whitespace, or invalid digit counts is rejected at the API schema boundary (`422 Unprocessable Entity` / `400 Bad Request`).

---

## 3. Cryptographic Storage at Rest (AES-256-GCM)

National ID numbers represent sensitive Personally Identifiable Information (PII) subject to statutory data protection regulations.

- **Algorithm:** Authenticated AES-256-GCM (`aes-256-gcm`).
- **Key Derivation:** 256-bit symmetric key derived via `crypto.scryptSync` from system cryptographic secrets and a dedicated high-entropy salt.
- **Initialization Vector (IV):** Cryptographically random 96-bit (12-byte) IV generated per encryption operation (`crypto.randomBytes(12)`).
- **Authentication Tag:** 128-bit GCM authentication tag verifying ciphertext integrity and authenticity against tampering.
- **Database Serialization Format:** Stored in the `provider_kyc.nidNumber` column as `iv:authTag:ciphertext` in hexadecimal encoding.

Because a unique random IV is generated for every submission, identical NID numbers produce distinct ciphertexts, thwarting frequency analysis attacks on database dumps.

---

## 4. Zero Plaintext Leakage & Masking Policy

- **No Plaintext in API Responses:** Read endpoints (`GET /api/v1/providers/me/kyc`, `GET /api/v1/admin/kyc`, `GET /api/v1/admin/kyc/[id]`) automatically decrypt the stored ciphertext in-memory, mask the identifier, and discard the plaintext string.
- **Masking Format:** Only the last 4 digits are revealed, preceded by asterisks matching the original length (e.g., `******7890` or `*************0123`).
- **No Plaintext in Logs:** Application loggers explicitly filter and redact `nidNumber`, `tradeLicenseNumber`, and document authentication payloads.

---

## 5. Document URL Protection

- Documents (NID front/back images, trade licenses, professional certificates) are stored in private object storage buckets.
- Upload paths are generated using UUIDv4 filenames with short-lived presigned upload URLs.
- Public bucket traversal is prohibited.

---

## 6. Administrative Review Lifecycle

1. Provider submits KYC via `POST /api/v1/providers/me/kyc`.
2. State enters `KycStatus.PENDING`. Provider remains `ProviderStatus.PENDING` and offline (`isAvailable: false`).
3. Administrative personnel (`OPERATIONS` or `SUPER_ADMIN`) review submissions via `GET /api/v1/admin/kyc` and `GET /api/v1/admin/kyc/[id]`.
4. Decision executed via `PATCH /api/v1/admin/kyc/[id]/review`:
   - **Approval (`APPROVED`):** `provider_kyc.status` becomes `APPROVED`. `providers.status` transitions to `APPROVED`. Provider may now go online manually.
   - **Rejection (`REJECTED`):** Requires a non-empty `rejectionReason`. `provider_kyc.status` becomes `REJECTED`, and `providers.status` becomes `REJECTED`. Provider is prevented from going online.
   - **Audit Record:** An immutable audit log entry is written to `audit_logs` capturing the reviewer's ID, decision timestamp, and rationale.
