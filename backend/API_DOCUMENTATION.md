# NEEDS BACKEND — REST & REALTIME API SPECIFICATION
**Version:** 1.0.0  
**Specification Standard:** OpenAPI 3.1 & Socket.IO  
**Base HTTP URL:** `http://localhost:3000/api/v1`  
**Swagger UI Interactive Documentation:** `http://localhost:3000/api/docs`  
**Realtime WebSocket URL:** `http://localhost:4001`  

---

## 1. Authentication & Security Standard

All protected endpoints require a valid JWT Access Token passed via HTTP Header:
```http
Authorization: Bearer <access_token>
```

Tokens are signed with `HS256`, `issuer: needs-backend`, `audience: needs-app`. Access tokens expire in 15 minutes; refresh tokens rotate on single use with automatic reuse family revocation.

---

## 2. API Endpoints Directory

### 2.1 Health & Probes
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/health/liveness` | Public | Process liveness check |
| `GET` | `/health/readiness` | Public | Deep probe verifying PostgreSQL, Redis, and BullMQ |

### 2.2 Identity & Authentication (`/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/auth/otp/send` | Public | Dispatches 6-digit OTP (5-min TTL, rate-limited to 3/hr) |
| `POST` | `/auth/otp/verify` | Public | Verifies OTP, registers user if new, issues access & refresh tokens |
| `POST` | `/auth/token/refresh` | Public | Rotates single-use refresh token |
| `POST` | `/auth/logout` | Authenticated | Revokes user session and refresh token |

### 2.3 User Management (`/users`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/users/profile` | Authenticated | Retrieves current authenticated user profile |
| `PUT` | `/users/profile` | Authenticated | Updates full name, avatar URL, language |
| `GET` | `/users/addresses` | Authenticated | Lists saved customer delivery addresses |
| `POST` | `/users/addresses` | Authenticated | Adds address with geocoded coordinates (lat, lon) |
| `DELETE` | `/users/addresses/:id` | Authenticated | Deletes saved address |

### 2.4 Service Providers & KYC (`/providers`, `/admin`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/providers/profile` | Provider | Retrieves provider rating, completed jobs, and KYC status |
| `POST` | `/providers/kyc` | Provider | Submits NID number, NID photos, and trade license |
| `PATCH` | `/providers/availability` | Provider | Toggles online availability (enforces BR-01: status must be `APPROVED`) |
| `POST` | `/providers/services` | Provider | Maps services offered by provider with optional custom rates |
| `POST` | `/admin/providers/verify` | Admin | Back-office KYC approval or rejection with reason |

### 2.5 Service Catalog (`/catalog`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/catalog/categories` | Public | Lists active service categories with hierarchy |
| `POST` | `/catalog/categories` | Admin | Creates new category with unique slug |
| `GET` | `/catalog/services` | Public | Lists services with optional category and search filters |
| `POST` | `/catalog/services` | Admin | Creates service offering with base price and duration |
| `GET` | `/catalog/services/:id` | Public | Retrieves specific service details |

### 2.6 Location & Geospatial Engine (`/location`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/location/providers/current` | Provider | Ingests real-time coordinates, updates Redis GEO and PostGIS snapshot |
| `GET` | `/location/providers/nearby` | Authenticated | Searches nearby approved & available providers via PostGIS `ST_DWithin` |

### 2.7 Dispatch Engine (`/dispatch`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/dispatch/bookings/:id/accept` | Provider | Accepts assignment within 45s timer; acquires Redis lock and updates booking to `ASSIGNED` |
| `POST` | `/dispatch/bookings/:id/reject` | Provider | Rejects assignment; triggers automated redispatch to candidate #2 |

### 2.8 Booking State Machine (`/bookings`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/bookings` | Customer | Creates booking in `REQUESTED` state, generates secure 4-digit startOtp and endOtp |
| `GET` | `/bookings` | Authenticated | Lists bookings scoped by user role (customer, provider, admin) |
| `GET` | `/bookings/:id` | Authenticated | Retrieves booking details (masks OTPs for provider until arrival) |
| `POST` | `/bookings/:id/transition` | Authenticated | Executes atomic state transition (`START_TRIP`, `ARRIVE`, `START_WORK` [with startOtp], `COMPLETE_WORK` [with endOtp], `CANCEL`) |
| `GET` | `/bookings/:id/events` | Authenticated | Retrieves immutable audit trail ledger events |

### 2.9 Realtime Chat & Messaging (`/chat`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/chat/conversations/:bookingId` | Authenticated | Retrieves message history for booking conversation |

### 2.10 Multi-Channel Notifications (`/notifications`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/notifications` | Authenticated | Retrieves user notifications inbox with unread counter |
| `PATCH` | `/notifications/:id/read` | Authenticated | Marks single notification as read |
| `POST` | `/notifications/read-all` | Authenticated | Marks all user notifications as read |

### 2.11 Payments (`/payments`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/payments/initiate` | Customer | Initiates payment checkout via bKash, Nagad, or SSLCommerz |
| `POST` | `/payments/webhooks/:gateway` | Public | Gateway IPN / Webhook callback with HMAC verification |

### 2.12 Double-Entry Wallet (`/wallet`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/wallet/balance` | Authenticated | Retrieves balance in BDT and locked balance |
| `GET` | `/wallet/transactions` | Authenticated | Retrieves paginated append-only double-entry ledger transactions |
| `POST` | `/wallet/topup` | Authenticated | Credits customer wallet balance |
| `POST` | `/wallet/payouts` | Provider | Requests withdrawal of earnings (minimum 500 BDT) |

### 2.13 Coupons & Promotions (`/coupons`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/coupons/validate` | Authenticated | Validates promo code, verifies usage limits, and computes discount |
| `POST` | `/coupons` | Admin | Creates new promotional coupon |

### 2.14 Reviews & Ratings (`/reviews`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/reviews` | Customer | Submits 1-5 star review for completed booking; recalculates provider score |
| `GET` | `/reviews/providers/:id` | Public | Lists verified customer reviews for a provider |

### 2.15 Customer Support (`/support`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/support/tickets` | Authenticated | Opens support ticket with priority |
| `GET` | `/support/tickets` | Authenticated | Lists support tickets |
| `GET` | `/support/tickets/:id` | Authenticated | Retrieves ticket details and thread messages |
| `POST` | `/support/tickets/:id/messages` | Authenticated | Sends message inside ticket thread |

### 2.16 Business Analytics (`/analytics`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/analytics/overview` | Admin | Returns system KPIs: completion rate, GMV, platform revenue, active providers |
| `GET` | `/analytics/revenue` | Admin | Returns gross merchandise value and platform 15% commission breakdown |

---

## 3. Realtime WebSocket Specification (Port 4001)

### Connection Handshake
```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:4001/tracking", {
  auth: {
    token: "<JWT_ACCESS_TOKEN>"
  }
});
```

### 3.1 `/tracking` Gateway
- **Join Booking Room:**
  - Event: `join_booking`
  - Payload: `{ bookingId: "uuid" }`
- **Location Updates (Provider -> Server):**
  - Event: `provider:location:update`
  - Payload: `{ bookingId: "uuid", latitude: 23.8103, longitude: 90.4125 }`
- **Location Broadcast (Server -> Customer):**
  - Event: `provider:location`
  - Payload: `{ providerId: "uuid", latitude: 23.8103, longitude: 90.4125, timestamp: "ISO" }`

### 3.2 `/chat` Gateway
- **Join Conversation:**
  - Event: `join_conversation`
  - Payload: `{ bookingId: "uuid" }`
- **Send Message:**
  - Event: `send_message`
  - Payload: `{ conversationId: "uuid", content: "Hello!" }`
- **Receive Message:**
  - Event: `new_message`
- **Read Receipts:**
  - Event: `mark_read` -> triggers `messages_read`
- **Typing Indicators:**
  - Event: `typing` -> triggers `user_typing`
