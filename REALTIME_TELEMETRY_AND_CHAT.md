# Needs Backend — Real-Time Telemetry & Chat Gateway Specification
**Version:** 1.0.0  
**Phase:** 4  

---

## 1. Overview

Real-time interactions on the Needs platform are handled by a dedicated Socket.IO daemon (`src/realtime/server.ts`) operating independently of the Next.js HTTP server. Horizontally scaled across multiple replicas via `@socket.io/redis-adapter`, the server provides sub-second location telemetry broadcasting and end-to-end booking chat.

---

## 2. Authentication Handshake

Every socket connection must present a valid JWT access token during handshake:
- **Transport:** Handshake `auth.token` or `headers.authorization: Bearer <token>`.
- **Validation:** Enforces strict algorithm (`HS256`), issuer (`needs-backend`), audience (`needs-app`), and claims (`userId`, `role`, `phone`).
- **Context Injection:** Attaches authenticated payload to `socket.data.user`. Unauthenticated connections are terminated before namespace routing.

---

## 3. `/tracking` Gateway Specification

### Events Emitted by Client
| Event | Payload | Scope / Permission | Description |
|:---|:---|:---|:---|
| `join_booking` | `{ "bookingId": "uuid" }` | Customer, Assigned Provider, Admin | Authorizes entry into room `booking:{bookingId}` |
| `leave_booking` | `{ "bookingId": "uuid" }` | Any participant in room | Leaves tracking room cleanly |
| `provider:location:update` | `{ "bookingId": "uuid", "latitude": 23.75, "longitude": 90.38, "heading": 90, "speed": 25, "accuracy": 4 }` | Assigned Provider only | Broadcasts live GPS coordinate to room participants and updates Redis GEO |

### Events Emitted by Server
| Event | Payload | Target | Description |
|:---|:---|:---|:---|
| `provider:location` | `{ "providerId": "uuid", "latitude": float, "longitude": float, "heading": float, "speed": float, "accuracy": float, "timestamp": string }` | Room `booking:{bookingId}` | Real-time provider movement coordinate for map animation |

---

## 4. `/chat` Gateway Specification

### Events Emitted by Client
| Event | Payload | Scope / Permission | Description |
|:---|:---|:---|:---|
| `join_conversation` | `{ "bookingId": "uuid" }` | Customer, Assigned Provider, Support Admin | Initializes/joins room `conversation:{conversationId}` and hydrates previous 50 messages |
| `leave_conversation` | `{ "conversationId": "uuid" }` | Any participant in room | Leaves conversation room |
| `send_message` | `{ "conversationId": "uuid", "content": "string" }` | Customer, Assigned Provider, Support Admin | Persists message in PostgreSQL, emits to room, and queues offline push notification |
| `mark_read` | `{ "conversationId": "uuid" }` | Conversation participant | Marks unread messages as read in database and notifies peer |
| `typing` | `{ "conversationId": "uuid", "isTyping": boolean }` | Conversation participant | Broadcasts peer typing indicator |

### Events Emitted by Server
| Event | Payload | Target | Description |
|:---|:---|:---|:---|
| `new_message` | Message object (id, senderId, senderRole, content, sender metadata, createdAt) | Room `conversation:{id}` | Real-time chat message delivery |
| `messages_read` | `{ "conversationId": "uuid", "readerId": "uuid", "readAt": string }` | Room `conversation:{id}` | Real-time read receipt delivery |
| `user_typing` | `{ "conversationId": "uuid", "userId": "uuid", "isTyping": boolean }` | Room `conversation:{id}` | Dynamic typing indicator |

---

## 5. Offline Push Notification Integration

When a message is sent in `/chat`, the gateway verifies whether the recipient has an active socket in the conversation room:
- If offline or inactive, a message payload is immediately enqueued into BullMQ queue `notifications` (`attempts: 3`, exponential backoff).
- The background worker dispatches a mobile push notification via FCM to alert the recipient.
