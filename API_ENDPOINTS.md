# Needs Backend — Complete API Endpoints Reference
**Version:** 2.0.0  
**Phase:** 2  

---

## 1. Authentication (`/api/v1/auth`)

| Method | Endpoint | Access | Description | Request Body / Parameters |
|:---|:---|:---|:---|:---|
| `POST` | `/api/v1/auth/otp/send` | Public | Dispatches 6-digit OTP via SMS | `{ "phone": "+8801712345678" }` |
| `POST` | `/api/v1/auth/otp/verify` | Public | Verifies OTP and returns JWT tokens | `{ "phone": "+8801712345678", "otp": "123456", "deviceInfo": "iPhone 15" }` |
| `POST` | `/api/v1/auth/token/refresh` | Public | Single-use refresh token rotation | `{ "refreshToken": "jwt...", "deviceInfo": "iPhone 15" }` |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revokes current session | Optional `{ "refreshToken": "jwt..." }` |
| `POST` | `/api/v1/auth/logout-all` | Authenticated | Revokes all active sessions for user | None |
| `GET` | `/api/v1/auth/sessions` | Authenticated | Lists all active device sessions | None |
| `DELETE` | `/api/v1/auth/sessions/:id` | Authenticated | Revokes specific session | Route parameter `id` |

---

## 2. User & Profile Management (`/api/v1/users`)

| Method | Endpoint | Access | Description | Request Body / Parameters |
|:---|:---|:---|:---|:---|
| `GET` | `/api/v1/users/me` | Authenticated | Retrieves current authenticated user profile | None |
| `PATCH` | `/api/v1/users/me` | Authenticated | Updates profile details | `{ "fullName": "Alice", "email": "alice@needs.com.bd", "language": "bn" }` |
| `DELETE` | `/api/v1/users/me` | Authenticated | Soft-deletes user account and revokes sessions | None |
| `GET` | `/api/v1/users/me/addresses` | Authenticated | Retrieves user's saved addresses | None |
| `POST` | `/api/v1/users/me/addresses` | Authenticated | Adds new address (enforces single default) | `{ "label": "Home", "addressLine": "House 1, Road 2", "area": "Dhanmondi", "city": "Dhaka", "latitude": 23.74, "longitude": 90.37, "isDefault": true }` |
| `PATCH` | `/api/v1/users/me/addresses/:id` | Authenticated | Updates address fields | `{ "addressLine": "House 10" }` |
| `DELETE` | `/api/v1/users/me/addresses/:id` | Authenticated | Removes saved address | Route parameter `id` |
| `PATCH` | `/api/v1/users/me/addresses/:id/default` | Authenticated | Sets target address as the single default | Route parameter `id` |

---

## 3. Provider Onboarding & Operations (`/api/v1/providers`)

| Method | Endpoint | Access | Description | Request Body / Parameters |
|:---|:---|:---|:---|:---|
| `POST` | `/api/v1/providers/apply` | Authenticated | Applies for provider status (`PENDING`) | `{ "bio": "...", "experienceYears": 5, "serviceIds": ["uuid..."] }` |
| `GET` | `/api/v1/providers/me` | Provider | Retrieves current provider profile, KYC, services | None |
| `PATCH` | `/api/v1/providers/me` | Provider | Updates provider bio, experience | `{ "bio": "Updated bio..." }` |
| `GET` | `/api/v1/providers/me/services` | Provider | Lists provider's registered services | None |
| `PUT` | `/api/v1/providers/me/services` | Provider | Updates active service offerings | `{ "serviceIds": ["uuid1", "uuid2"] }` |
| `PATCH` | `/api/v1/providers/me/availability` | Provider | Toggles online availability (BR-01 enforced) | `{ "isAvailable": true }` (Requires `APPROVED` status) |
| `POST` | `/api/v1/providers/me/kyc` | Provider | Submits encrypted KYC identification | `{ "nidNumber": "19901234567890123", "nidFrontUrl": "https://...", "nidBackUrl": "https://..." }` |
| `GET` | `/api/v1/providers/me/kyc` | Provider | Retrieves KYC submission status (masked NID) | None |

---

## 4. Service Catalog (`/api/v1/catalog`)

| Method | Endpoint | Access | Description | Request Body / Parameters |
|:---|:---|:---|:---|:---|
| `GET` | `/api/v1/catalog/categories` | Public | Lists active service categories with hierarchy | Query param `includeInactive=true` (optional) |
| `GET` | `/api/v1/catalog/categories/:slug` | Public | Retrieves category details and active services by slug | Route parameter `slug` |
| `GET` | `/api/v1/catalog/services` | Public | Searches and filters active services | Query params `categoryId`, `search` |
| `GET` | `/api/v1/catalog/services/:id` | Public | Retrieves service by UUID or slug | Route parameter `id` (supports UUID or slug) |

---

## 5. Administrative Controls (`/api/v1/admin`)

| Method | Endpoint | Access | Description | Request Body / Parameters |
|:---|:---|:---|:---|:---|
| `GET` | `/api/v1/admin/providers` | Admin | Lists all providers with filters and pagination | Query params `status`, `search`, `page`, `limit` |
| `GET` | `/api/v1/admin/providers/:id` | Admin | Retrieves provider profile, user details, KYC | Route parameter `id` |
| `PATCH` | `/api/v1/admin/providers/:id/review` | Admin | Approves or rejects provider application | `{ "status": "APPROVED", "reason": "All checks passed" }` |
| `PATCH` | `/api/v1/admin/providers/:id/suspend` | Admin | Suspends or reinstates provider | `{ "isSuspended": true, "reason": "Platform violation" }` |
| `GET` | `/api/v1/admin/kyc` | Admin | Lists KYC submissions with masked NID numbers | Query params `status`, `page`, `limit` |
| `GET` | `/api/v1/admin/kyc/:id` | Admin | Retrieves KYC submission details | Route parameter `id` |
| `PATCH` | `/api/v1/admin/kyc/:id/review` | Admin | Approves or rejects KYC documents | `{ "status": "APPROVED" }` or `{ "status": "REJECTED", "rejectionReason": "Blurry image" }` |
| `POST` | `/api/v1/admin/catalog/categories` | Admin | Creates service category | `{ "name": "Plumbing", "slug": "plumbing", "sortOrder": 1 }` |
| `PATCH` | `/api/v1/admin/catalog/categories/:id` | Admin | Updates category attributes | `{ "name": "Plumbing Solutions" }` |
| `POST` | `/api/v1/admin/catalog/services` | Admin | Creates new service offering | `{ "categoryId": "uuid...", "name": "Pipe Repair", "slug": "pipe-repair", "basePrice": 600 }` |
| `PATCH` | `/api/v1/admin/catalog/services/:id` | Admin | Updates service offering | `{ "basePrice": 650 }` |
| `GET` | `/api/v1/admin/audit-logs` | Admin | Queries immutable administrative audit trail | Query params `actorId`, `targetResource`, `page`, `limit` |
