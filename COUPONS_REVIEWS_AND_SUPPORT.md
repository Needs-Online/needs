# Needs Backend — Coupons, Reviews & Support Specifications
**Version:** 1.0.0  
**Phase:** 5  

---

## 1. Overview

This document details the architecture, business logic, data models, and verification constraints for the promotional marketing, trust & safety (reviews), and customer care (support) modules of the Needs platform.

---

## 2. Coupons & Promotions Engine

The coupons engine enables marketing campaigns and promo code redemptions with strict fraud and concurrency controls.

### 2.1 Discount Types & Calculations
1. **`PERCENTAGE` Discount:**
   $$\text{Discount} = \min\left(\frac{\text{Order Amount} \times \text{Discount Value}}{100}, \text{Max Discount}\right)$$
   Guarantees discount does not exceed the platform operator's configured ceiling.

2. **`FIXED` Discount:**
   $$\text{Discount} = \min(\text{Discount Value}, \text{Order Amount})$$
   Guarantees discount never exceeds the bill itself (final amount $\ge 0$).

### 2.2 Validation Rules
- **Temporal Validity:** `validFrom <= now() <= validUntil`.
- **Status:** `isActive == true`.
- **Minimum Spend:** `orderAmount >= minOrderAmount`.
- **Platform Usage Cap:** `usageCount < usageLimit`.
- **Per-User Abuse Limit:** Count of records in `coupon_redemptions` for `(couponId, userId) < perUserLimit`.

### 2.3 Concurrency & Atomic Redemption
When a coupon is redeemed, an interactive PostgreSQL transaction (`prisma.$transaction`) checks remaining quota and increments `usageCount` atomically to prevent race conditions during flash sales.

---

## 3. Verified Reviews & Ratings (BR-07)

The review system establishes mutual trust between customers and service providers.

### 3.1 Business Rule 07 Enforcement
1. **Completed Bookings Only:** A review can only be submitted if `booking.status === BookingStatus.COMPLETED`. Any attempt to review in-progress, draft, or cancelled bookings is rejected with `400 Bad Request`.
2. **Customer Identity Verification:** Only the authenticated customer who booked the service (`booking.customerId === userId`) is authorized to rate.
3. **Single Review Constraint:** Exactly one review is permitted per booking (`bookingId` is unique in `reviews` table). Duplicate submissions return `409 Conflict`.
4. **Rating Scale:** Integer rating strictly bounded between 1 and 5 stars.

### 3.2 Atomic Provider Rating Aggregation
Upon successful review submission, the provider's overall score is updated within the same transaction:
$$\text{Total Ratings}_{\text{new}} = \text{Total Ratings}_{\text{old}} + 1$$
$$\text{Rating}_{\text{new}} = \frac{(\text{Rating}_{\text{old}} \times \text{Total Ratings}_{\text{old}}) + \text{New Rating}}{\text{Total Ratings}_{\text{new}}}$$
The new aggregate rating is rounded to 2 decimal places and saved to `Provider.rating`.

---

## 4. Customer Support & Dispute Resolution

The support module provides multi-party dispute management, communication threads, and automated lifecycle transitions.

### 4.1 Ticket Architecture
- **Ticket Number:** Unique tracking format: `TKT-YYYYMMDD-XXXX`.
- **Optional Booking Link:** Links disputes directly to a specific booking ID (`bookingId`).
- **Priority:** `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
- **Status Workflow:** `OPEN` $\to$ `IN_REVIEW` $\to$ `RESOLVED` $\to$ `CLOSED`.

### 4.2 Threaded Messages & Auto-Reopening
- Customers and support personnel exchange threaded messages in `ticket_messages`.
- **Auto-Reopening Invariant:** If a customer posts a reply to a ticket in `RESOLVED` status, the platform automatically transitions the ticket status back to `OPEN`, immediately re-alerting support personnel.

### 4.3 FAQs Engine
Public knowledgebase queries categorized by domain (`PAYMENTS`, `BOOKING`, `SAFETY`, `REFUND`) ordered by `sortOrder` for instant self-service resolution.

---

## 5. Endpoints Summary

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/coupons` | `GET` | Authenticated | List available coupons (active for users, all for admin) |
| `/api/v1/coupons` | `POST` | `ADMIN` | Create new promotional coupon |
| `/api/v1/coupons/validate` | `POST` | Authenticated | Validate coupon against order amount & return calculated discount |
| `/api/v1/reviews` | `POST` | `CUSTOMER` | Submit 1-5 star review for completed booking |
| `/api/v1/reviews/booking/:id` | `GET` | Authenticated | Retrieve review submitted for a booking |
| `/api/v1/reviews/providers/:id` | `GET` | Public | Paginated list of verified reviews for a provider |
| `/api/v1/support/tickets` | `POST` | Authenticated | Open new support / dispute ticket |
| `/api/v1/support/tickets` | `GET` | Authenticated | List tickets (user's own, or all for support/admin) |
| `/api/v1/support/tickets/:id` | `GET` | Authenticated | Ticket details with chronological message thread |
| `/api/v1/support/tickets/:id/messages` | `POST` | Authenticated | Post message to ticket thread (auto-reopens if resolved) |
| `/api/v1/support/tickets/:id/status` | `PATCH` | `SUPPORT`, `ADMIN` | Update ticket status and assign staff member |
| `/api/v1/support/faqs` | `GET` | Public | Retrieve active FAQs by category |
