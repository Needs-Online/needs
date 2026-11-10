# Needs Backend — Administrative Role-Based Access Control (RBAC) & Audit Specifications
**Version:** 1.0.0  
**Phase:** 2  

---

## 1. Overview

Administrative operations in the Needs backend are governed by strict Role-Based Access Control (RBAC). Actions performed by staff members are authorized according to organizational responsibility and recorded in an immutable audit ledger.

---

## 2. Administrative Roles & Permission Matrix

| Role | Scope & Responsibilities | Key Permissions |
|:---|:---|:---|
| **`SUPER_ADMIN`** | Complete administrative sovereignty | Full system access, staff account management, role assignment, platform configuration, financial approvals. |
| **`OPERATIONS`** | Day-to-day marketplace management | Provider onboarding, KYC verification, provider status management (suspensions/reinstatements), manual dispatch adjustments, service catalog updates. |
| **`SUPPORT`** | Dispute handling & customer care | Customer and provider support tickets, viewing non-sensitive booking details, initiating standard customer refunds. |
| **`FINANCE`** | Fiscal controls & payouts | Provider payout approvals, transaction reconciliation, ledger audit, commission rate reviews. |

---

## 3. Last Super Admin Protection Invariant

To prevent operational lockout or malicious orphan scenarios, the system enforces a protective constraint on super administrator accounts:

- **Invariant:** The total count of active `SUPER_ADMIN` accounts must never fall below `1`.
- **Enforcement:** Any administrative request to deactivate, delete, or demote a `SUPER_ADMIN` account executes `assertCanDeactivateSuperAdmin`. If `countActiveSuperAdmins() <= 1`, the operation is aborted with a `403 ForbiddenError`:
  > *"Action rejected: Cannot delete or deactivate the last remaining SUPER_ADMIN account"*

---

## 4. Immutable Audit Logging (`audit_logs`)

All administrative mutations are recorded in the `audit_logs` database table. Audit logs are append-only; updates and deletions are disabled at the repository and schema levels.

### Recorded Fields
- `id`: Unique UUIDv4 identifier.
- `actorId`: ID of the administrative user initiating the action.
- `actorType`: Entity type (`ADMIN`).
- `action`: Specific operational action code (e.g., `PROVIDER_REVIEW`, `PROVIDER_SUSPENDED`, `KYC_REVIEW`, `CATALOG_UPDATE`).
- `targetResource`: Name of the modified entity table (e.g., `providers`, `provider_kyc`, `services`).
- `targetId`: Unique ID of the modified entity.
- `ipAddress`: Client IP address captured from headers (`X-Forwarded-For`).
- `userAgent`: Client device/browser user agent.
- `payload`: Structured JSON snapshot of the state changes, review reasons, or updated attributes (with PII and credentials redacted).
- `createdAt`: UTC timestamp of the operation.

---

## 5. Administrative Endpoints

### Provider Governance
- `GET /api/v1/admin/providers`: List all providers with filtering by `status`, search query, and pagination.
- `GET /api/v1/admin/providers/[id]`: Retrieve comprehensive provider details including user data, KYC status, and service offerings.
- `PATCH /api/v1/admin/providers/[id]/review`: Review provider application (`APPROVED` or `REJECTED`).
- `PATCH /api/v1/admin/providers/[id]/suspend`: Suspend or reinstate provider account with mandatory reason.

### KYC Verification
- `GET /api/v1/admin/kyc`: List pending or reviewed KYC submissions with masked NID numbers.
- `GET /api/v1/admin/kyc/[id]`: Retrieve detailed KYC verification files and provider profile.
- `PATCH /api/v1/admin/kyc/[id]/review`: Approve or reject KYC documents.

### Catalog Administration
- `POST /api/v1/admin/catalog/categories`: Create new service category with slug and parent category support.
- `PATCH /api/v1/admin/catalog/categories/[id]`: Update category attributes, slug, icon, or active status.
- `POST /api/v1/admin/catalog/services`: Create new service offering with base price and pricing type.
- `PATCH /api/v1/admin/catalog/services/[id]`: Update service parameters, pricing, or status.

### Audit Inspection
- `GET /api/v1/admin/audit-logs`: Query immutable administrative audit trail with pagination and filters.
