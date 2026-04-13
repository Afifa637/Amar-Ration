# 🇧🇩 Smart OMS — Amar Ration Distribution System
### Complete Project Report & Technical Documentation

> **"The OMS ration card with QR-based validation ensures that only verified and active beneficiaries receive ration. Combined with tokenized distribution, family-level duplicate detection, NID encryption, instant token revocation, and post-distribution audit, the system guarantees transparency, prevents duplication, and enforces accountability — without relying on confidential government databases."**

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Actors & Roles](#3-actors--roles)
4. [Core Security Design](#4-core-security-design)
5. [Technology Stack](#5-technology-stack)
6. [Repository Structure](#6-repository-structure)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Feature Status Tracker](#9-feature-status-tracker)
10. [Admin Web Dashboard](#10-admin-web-dashboard)
11. [Distributor Web Dashboard](#11-distributor-web-dashboard)
12. [Fraud Detection & Prevention](#12-fraud-detection--prevention)
13. [Security Implementation Deep Dive](#13-security-implementation-deep-dive)
14. [Division & Ward Normalization Engine](#14-division--ward-normalization-engine)
15. [Notification System](#15-notification-system)
16. [QR Card Lifecycle](#16-qr-card-lifecycle)
17. [Distribution Workflow](#17-distribution-workflow)
18. [Offline Mode](#18-offline-mode)
19. [IoT Weight Scale Integration](#19-iot-weight-scale-integration)
20. [Setup & Running the Project](#20-setup--running-the-project)
21. [Environment Configuration](#21-environment-configuration)
22. [Security Hardening Checklist](#22-security-hardening-checklist)
23. [Pending & Roadmap Features](#23-pending--roadmap-features)
24. [Project Presentation Summary](#24-project-presentation-summary)

---

## 1. Project Overview

**Smart OMS (Open Market Sale) Ration Distribution System** — codenamed *Amar Ration* — is an end-to-end digital platform designed to eliminate fraud, duplication, and mismanagement in government ration distribution operations across Bangladesh.

### Problems Being Solved

| Problem | Solution Implemented |
|---|---|
| Duplicate ration claims from one family | Family-level NID fingerprint (`familyKey = SHA-256(fatherNID+motherNID)`) + `flaggedDuplicate` block |
| Ghost beneficiaries | Admin-only consumer activation; every consumer starts as `Inactive` |
| Corrupt distributor manipulation | Revocable, time-bound authority; session-scoped workflow; immutable audit |
| Paper token forgery | Digital tokenization; one token per consumer per session (compound DB unique index) |
| No accountability post-distribution | Immutable audit log (no DELETE/UPDATE route ever); session reconciliation |
| Ward-boundary violation | Distributor can only serve consumers in their exact assigned ward **and** division |
| Same ward number across different divisions | Every scope check uses **both** `division` AND `wardNo` together |
| Consumer blacklisted but still served | Blacklist check is one of 10 layers at every QR scan before token issuance |
| Distributor authority expired | `authorityTo` date checked at login AND at every distribution scan |
| Suspended distributor keeps API access | `tokenVersion` increments on suspend — existing JWT rejected immediately |
| Distributor never changes temp password | `mustChangePassword` flag enforced at login; frontend redirects to change screen |
| Full NID numbers stored in database | AES-256-GCM encryption on all NID fields; HMAC-SHA-256 hash for search |
| Family duplicate not reviewed | `flaggedDuplicate` blocks token issuance until admin resolves at scan time |
| Session closed but tokens still issuable | Session status is one of the 10 pre-issuance checks |
| Stock over-distribution | Append-only StockLedger; session reconciliation on close |
| Two distributors for same ward | Compound unique DB index on `(division, wardNo)` in both `users` and `distributors` collections |

### Key Design Philosophy

> *The system prioritizes transparency and accountability while remaining independent of confidential government databases. Distributor access is privilege-based, time-bound, and revocable. No actor can grant themselves elevated access. Every action is permanently recorded. Every suspension takes effect in real time — not after JWT expiry.*

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            SMART OMS SYSTEM                                   │
│                                                                                │
│  ┌───────────────────┐              ┌──────────────────────┐                  │
│  │  ADMIN WEB APP    │              │ DISTRIBUTOR WEB APP   │                  │
│  │  (React + TS)     │              │ (React + TS)          │                  │
│  │  Full management  │              │ Session mgmt +        │                  │
│  │  dashboards       │              │ QR scan + monitoring  │                  │
│  └─────────┬─────────┘              └──────────┬────────────┘                 │
│            │                                    │                              │
│            └───────────────────┬────────────────┘                             │
│                                │                                               │
│                ┌───────────────▼───────────────┐                              │
│                │       BACKEND API SERVER        │                             │
│                │  Node.js + Express.js v4        │                             │
│                │  MongoDB Atlas via Mongoose v8  │                             │
│                │  JWT Auth + tokenVersion guard  │                             │
│                │  RBAC Middleware (4 roles)       │                             │
│                │  Fraud Detection Service        │                             │
│                │  NID Encryption Service          │                             │
│                │  Audit Service (append-only)    │                             │
│                │  Division+Ward Normalizer       │                             │
│                └──┬──────────┬──────────┬───────┘                             │
│                   │          │          │                                      │
│          ┌────────▼───┐ ┌────▼─────┐ ┌─▼──────────────┐                     │
│          │ MongoDB    │ │ In-App   │ │ Email Service   │                     │
│          │ Atlas      │ │ Notifs   │ │ (Credentials,   │                     │
│          │ (17 colls) │ │ + TTL    │ │  Status, PW     │                     │
│          └────────────┘ └──────────┘ │  Change Alert)  │                     │
│                                      └─────────────────┘                     │
│                                                                                │
│  ┌─────────────────┐          ┌──────────────────────┐                        │
│  │  IoT Weight     │          │  Field User App       │                        │
│  │  Scale Device   │          │  (Mobile/Web)         │                        │
│  │  x-iot-api-key  │          │  Scan + Confirm       │                        │
│  └─────────────────┘          └──────────────────────┘                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Distribution Day

```
Consumer presents physical OMS Card
         │
         ▼
Distributor/FieldUser scans QR code
POST /api/distribution/scan { qrPayload }
         │
         ▼
Backend: resolveConsumerFromPayload()

Check 1:  QR payload resolves to a Consumer + valid QRCode ──No──► Reject + Audit [Warning]
Check 2:  QRCode.status = "Valid" and not expired          ──No──► Reject + Audit [Warning]
Check 3:  Division + Ward scope match                      ──No──► Reject + Audit [Warning]
Check 4:  Consumer.blacklistStatus = "None"                ──No──► Reject + Audit [Critical]
Check 5:  Family.flaggedDuplicate = false                  ──No──► Reject + Audit [Critical]
Check 6:  Consumer.status = "Active"                       ──No──► Reject + Audit [Warning]
Check 7:  OMSCard.cardStatus = "Active"                    ──No──► Reject + Audit [Warning]
Check 8:  Distributor.authorityTo not expired              ──No──► Reject + Audit [Critical]
Check 9:  DistributionSession.status = "Planned/Open"      ──No──► Reject + Audit [Warning]
Check 10: MongoDB unique index (consumerId + sessionId)    ──No──► Reject + Audit [Warning]
         │
         ▼ All checks pass
Token auto-generated (unique tokenCode, status: Issued)
MongoDB transaction commits atomically
         │
         ▼
Ration distributed
         │
         ▼
POST /api/distribution/complete { tokenId, actualKg }
    ├── Token.status = "Issued"? ──No──► Reject (replay prevention) + Audit [Critical]
    ├── Weight within threshold? ──Yes──► Confirm + stockOut() + Audit [Info]
    └── Mismatch? ─────────────────────► Alert Admin + Audit [Critical]
                                         checkDistributorMismatchCount()
                                         Auto-blacklist if threshold exceeded
         │
         ▼
Session Closure → QR Token Rotation → Reconciliation → Audit Summary
```

---

## 3. Actors & Roles

### 3.1 Central Admin

**Access:** Admin Web Dashboard (full access — all divisions, all wards)

**Responsibilities:**
- Create distributor accounts (admin-generated system email + temp password)
- Approve / Suspend / Revoke distributors with immediate effect
- Reset distributor password (generates new temp password, sends by email, sets `mustChangePassword = true`)
- Activate / Inactivate / Revoke consumer OMS cards (**only admin can activate**)
- Review and resolve family duplicate flags
- View system-wide immutable audit log
- Configure all system settings (weight threshold, QR expiry, fraud rules, ration allocation)
- Review distribution reconciliation reports
- Request and review formal audit reports from distributors
- Manage blacklist entries (create, deactivate for appeals)
- Force-close any distributor's active session
- Allocate stock (StockLedger IN entries)
- View real-time session monitoring across all wards and divisions

**Cannot be created by self-signup.** Admin accounts are created only through `src/setup/create-admin.js` — a one-time setup script that reads credentials from environment variables and exits if an admin already exists.

---

### 3.2 Distributor (Ward + Division Scoped)

**Access:** Distributor Web Dashboard (own ward + division only)

**Lifecycle:** Admin-created → `mustChangePassword = true` on first login → forced password change → full access

**Responsibilities:**
- Register new consumers into the Long List (ward-specific only)
- Open and manage daily distribution sessions
- Scan consumer OMS card / enter consumer code to issue tokens
- View issued tokens for current session
- Cancel a token with mandatory reason
- Submit post-session closure with remaining stock confirmation
- Respond to formal audit report requests from admin
- View own audit log, monitoring stats, and blacklist entries
- Change own password (current password required; old sessions invalidated instantly via `tokenVersion`)

**Distributor CANNOT:**
- Activate a consumer's OMS card (admin-only privilege)
- Modify system-level settings or weight thresholds
- Access any other division's or ward's data
- Self-signup and become active (admin creates the account)
- Issue a token if their authority has expired or is suspended
- Issue a token if their session is Closed, Paused, or doesn't exist
- Keep API access after being suspended (tokenVersion check on every request)

---

### 3.3 Field User (Ward-Scoped Scanner)

**Access:** Lightweight field scanning interface (`/api/field`)

**Responsibilities:**
- Scan QR and issue tokens (same 10-check pipeline as Distributor)
- Confirm distribution with actual weight
- View session status
- Submit offline scan records for sync
- View own notifications

Field Users share the same ward+division scope as their associated Distributor. They operate through the same `scanAndIssueToken()` and `completeDistribution()` functions — no separate logic.

---

### 3.4 Consumer (Beneficiary)

**No app or web login.** Consumers are registered by distributors and interact only through their **physical OMS Ration Card** with embedded QR code.

**Consumer Identity:**
- `consumerCode` — unique auto-generated: C0001, C0002…
- `qrToken` — 64-character cryptographically random hex, embedded as QR on physical card
- `nidLast4` — last 4 digits of NID (only digits ever stored in plain text)
- `nidFull` — full NID encrypted with **AES-256-GCM** (prefix-guarded to prevent double-encryption)
- `nidHash` — HMAC-SHA-256 of full NID (used for duplicate search without decryption)
- `fatherNidFull`, `motherNidFull` — same AES-256-GCM encryption
- `familyKey` — SHA-256(fatherNID + motherNID) stored in `Family` collection
- Ration Category: **A** (5 kg), **B** (4 kg), **C** (3 kg)

---

## 4. Core Security Design

### 4.1 Authentication — JWT with Instant Invalidation

| Mechanism | Implementation |
|---|---|
| Password hashing | bcryptjs, 10 salt rounds |
| JWT generation | `jsonwebtoken` — includes `userId`, `userType`, `tokenVersion`, `jti` (unique nonce) |
| JWT expiry | 2 hours (configurable via `JWT_EXPIRES_IN`) |
| DB re-check on every request | `protect` middleware fetches `status`, `authorityStatus`, `tokenVersion` from DB on **every authenticated request** |
| Instant suspend/revoke | When admin suspends → `tokenVersion++` — all existing tokens rejected in milliseconds |
| Instant password-reset invalidation | Admin reset or own password change → `tokenVersion++` — all other sessions invalidated |
| Fresh token on own password change | Distributor who just changed their password receives a new token with the new `tokenVersion` — stays logged in seamlessly |

**tokenVersion flow:**

```
Admin suspends distributor
  → user.tokenVersion++ saved to DB
  → Distributor's next API request:
      protect() → DB fetch: tokenVersion = 2
      JWT payload: tokenVersion = 1
      1 ≠ 2 → 401 SESSION_INVALIDATED
      → Distributor is logged out immediately
```

### 4.2 mustChangePassword — Forced Password Change Flow

Distributors are **created by admin**, not by self-signup. They receive a system-generated temporary password by email. The backend enforces a change on first login:

```
1. Admin creates distributor
   → User.mustChangePassword = true
   → Temporary password emailed to contactEmail

2. Distributor logs in
   → Login response includes: { mustChangePassword: true }
   → Frontend intercepts: redirects to /change-password screen
   → Dashboard is inaccessible until password is changed

3. Distributor submits new password (PUT /api/auth/change-password)
   → currentPassword validated against hash
   → new passwordHash saved
   → mustChangePassword = false
   → tokenVersion++ (invalidates all other sessions)
   → Fresh JWT returned (distributor stays logged in)
   → Password change alert email sent to distributor's contactEmail
     with two action links: "Yes, I changed it" | "Not me — flag as unauthorized"

4. Admin resets distributor password
   → Same flow: mustChangePassword = true again
   → tokenVersion++ (previous JWT immediately rejected)
   → New temp password emailed

5. Admin re-enables a previously suspended/revoked distributor
   → New temp password generated + emailed
   → mustChangePassword = true
   → tokenVersion++ (forces fresh login)
```

### 4.3 Password Change Acknowledgement (Email Security)

When a distributor's password is changed (by themselves or by admin), the system sends a security alert email with two clickable links backed by a signed JWT:

```
GET /api/auth/password-change/ack?action=yes&token=<signed_jwt>
  → Renders HTML confirmation page: "Thank you. Change recorded."

GET /api/auth/password-change/ack?action=not-me&token=<signed_jwt>
  → Renders HTML alert page: "Flagged as unauthorized. Admin has been notified."
  → Writes audit log: PASSWORD_CHANGE_UNAUTHORIZED_FLAG [Critical]
  → Notifies all admins
```

The acknowledgement JWT has a 7-day validity and contains `purpose: "PASSWORD_CHANGE_ACK"`, `userId`, `changedAt`, and `changedByType`. It cannot be reused for any other purpose.

### 4.4 NID Data Protection — AES-256-GCM Encryption

All three NID fields (`nidFull`, `fatherNidFull`, `motherNidFull`) on the `Consumer` model are encrypted at rest using **AES-256-GCM** symmetric encryption:

```
Encryption:  AES-256-GCM, random 12-byte IV per record, 16-byte auth tag
Format:      "enc:v1:<iv_base64>:<tag_base64>:<ciphertext_base64>"
Key:         SHA-256 of NID_ENCRYPTION_KEY env var (32 bytes)
Guard:       Prefix "enc:v1:" prevents double-encryption on re-save
Hash:        HMAC-SHA-256 of normalized NID for duplicate search
```

**Key separation enforced at startup:** `app.js` exits with a FATAL error if `NID_ENCRYPTION_KEY === JWT_SECRET`. These must be different secrets.

**Consumer model pre-save hook:** Automatically encrypts NID fields before every `save()`. The pre-save hook decrypts first (if already encrypted), re-normalizes, then re-encrypts — making updates idempotent.

### 4.5 QR Code Security

- Each consumer has a `qrToken`: 64-character cryptographically random hex (`crypto.randomBytes(32)`)
- Physical OMS card embeds this token as a scannable QR code
- `QRCode` collection stores payload hash, `validFrom`, `validTo`, and status (`Valid`/`Expired`/`Revoked`)
- Token auto-expires based on `qrCycleDays` system setting (default: 30 days)
- Session close triggers automatic QR rotation for all served consumers
- If a consumer's card is revoked: even a genuine physical card scan is rejected in real time
- Card reissue generates a new `qrToken` — old token is immediately invalid at DB level

### 4.6 Family Duplicate Detection

During consumer registration:
1. Distributor provides father's NID + mother's NID (full numbers used only for fingerprinting)
2. Backend computes `familyKey = SHA-256(fatherNidFull + motherNidFull)`
3. Full NIDs are encrypted and stored; `nidLast4` retained for display
4. If a `Family` document with this `familyKey` already exists → `Family.flaggedDuplicate = true`
5. Admin must review and resolve the flag
6. **Scan-time enforcement:** `flaggedDuplicate === true` blocks token issuance even if admin previously activated the consumer

### 4.7 Audit Trail — Immutable, Append-Only

Every significant action writes to `AuditLog`. The collection has:
- **No DELETE route** — ever
- **No UPDATE route** — logs are immutable after creation
- `writeAudit()` uses Mongoose sessions where available for atomicity
- 5-year legal retention via TTL index

| Action Code | Severity | Trigger |
|---|---|---|
| `QR_SCAN_REJECT_QR_INVALID` | Warning | QR payload not found |
| `QR_SCAN_REJECT_QR_EXPIRED` | Warning | QRCode.validTo exceeded |
| `QR_SCAN_REJECT_BLACKLIST` | Critical | Consumer blacklisted |
| `QR_SCAN_REJECT_FAMILY_DUPLICATE` | Warning | Family flaggedDuplicate |
| `QR_SCAN_REJECT_INACTIVE` | Warning | Consumer not active |
| `QR_SCAN_REJECT_WARD_MISMATCH` | Warning | Division/ward boundary violation |
| `TOKEN_ISSUED` | Info | Successful token issuance |
| `TOKEN_CANCELLED` | Warning | Token manually cancelled |
| `DISTRIBUTION_SUCCESS` | Info | Distribution completed normally |
| `WEIGHT_MISMATCH` | Critical | Actual weight outside threshold |
| `AUTO_FRAUD_FLAG` | Critical | Distributor auto-blacklisted |
| `SESSION_OPENED` | Info | Session started |
| `SESSION_CLOSED` | Info | Session closed with reconciliation |
| `SESSION_FORCE_CLOSED` | Warning | Admin forced session close |
| `SESSION_RECONCILIATION_MISMATCH` | Critical | Stock vs tokens discrepancy |
| `CONSUMER_ACTIVATED` | Info | Admin activated consumer |
| `CONSUMER_REVOKED` | Critical | Consumer revoked |
| `DISTRIBUTOR_SUSPENDED` | Warning | Distributor suspended |
| `BLACKLIST_CREATED` | Warning | Blacklist entry created |
| `STOCK_ALLOCATED` | Info | Stock IN recorded |
| `PASSWORD_CHANGE_UNAUTHORIZED_FLAG` | Critical | "Not me" acknowledgement clicked |

### 4.8 Blacklist System

- Target: `Consumer` or `Distributor`
- Block type: `Temporary` (with `expiresAt`) or `Permanent`
- **Auto-blacklist:** After configurable mismatch count (default: 3 in 30 days), `fraud.service.js` auto-creates a Temporary entry, suspends the distributor, increments `tokenVersion`, and notifies admin
- Manual blacklist by admin for both consumers and distributors
- Admin can deactivate for appeals
- ⏳ **Planned:** Cron job to auto-deactivate expired temporary entries

### 4.9 Security Middleware Stack

Every request passes through the following layers in `app.js`:

```
Request
  │
  ├─ express-rate-limit (300 req / 15 min global)
  ├─ express-rate-limit (10 req / 15 min on /api/auth/login only)
  ├─ helmet (X-Frame-Options, HSTS, Content-Security-Policy, X-XSS-Protection...)
  ├─ cors (only ALLOWED_ORIGINS env var; rejects unknown origins)
  ├─ express.json (body limit: 2 MB)
  ├─ morgan (request logging)
  ├─ Cache-Control: no-store on all /api routes
  │
  ├─ protect() — JWT verify → DB re-check tokenVersion + status + authorityStatus
  ├─ authorize(...roles) — RBAC role whitelist
  │
  └─ Controller
```

---

## 5. Technology Stack

### Backend

| Component | Technology | Status |
|---|---|---|
| Runtime | Node.js v18+ (CommonJS) | ✅ |
| Framework | Express.js v4 | ✅ |
| Database | MongoDB Atlas via Mongoose v8 | ✅ |
| Authentication | JWT (`jsonwebtoken`) — with `jti` + `tokenVersion` | ✅ |
| Password Security | `bcryptjs` (10 rounds) | ✅ |
| Security Headers | `helmet` | ✅ |
| Rate Limiting | `express-rate-limit` (global + login-specific) | ✅ |
| NID Encryption | Node.js native `crypto` — AES-256-GCM | ✅ |
| Email Service | `nodemailer` (credential delivery, status alerts, PW change alert) | ✅ |
| QR Generation | `qrcode` (token QR payloads + consumer card QR) | ✅ |
| Logging | `morgan` | ✅ |
| Dev Server | `nodemon` | ✅ |
| Scheduled Jobs | `node-cron` | ⏳ Planned (blacklist expiry + QR rotation) |
| Input Validation | `zod` | ⏳ Partial |
| Refresh Tokens | — | ⏳ Planned |

### Frontend (Web Dashboard)

| Component | Technology | Status |
|---|---|---|
| Framework | React 18 + TypeScript | ✅ |
| Build Tool | Vite | ✅ |
| Styling | Tailwind CSS | ✅ |
| HTTP Client | Axios with interceptors | ✅ |
| Routing | React Router DOM | ✅ |
| Auth Context | React Context API (with `mustChangePassword` redirect) | ✅ |
| QR Scanner | Camera-based component (`jsQR` / `html5-qrcode`) | ✅ |

---

## 6. Repository Structure

```
Smart-OMS/
│
├── backend/
│   ├── server.js                       ✅ Entry point
│   ├── .env                            ✅ Environment variables
│   ├── .env.example                    ✅ Template
│   └── src/
│       ├── app.js                      ✅ Express app — all 13 route modules mounted
│       ├── config/
│       │   └── db.js                   ✅ MongoDB Atlas connection
│       │
│       ├── controllers/
│       │   ├── auth.controller.js       ✅ login, signup, changePassword, acknowledgePasswordChange
│       │   ├── admin.controller.js      ✅ Full admin management suite
│       │   ├── consumer.controller.js   ✅ Register, status, card management
│       │   ├── distribution.controller.js ✅ scan (10-check pipeline), complete, session close, QR rotation
│       │   ├── distributor.controller.js ✅ Distributor self-service dashboard
│       │   ├── monitoring.controller.js  ✅ Blacklist, offline queue, sync
│       │   ├── reports.controller.js     ✅ Session reports, distribution records
│       │   ├── stock.controller.js       ✅ Stock IN + summary
│       │   ├── settings.controller.js    ✅ Global settings CRUD
│       │   ├── notification.controller.js ✅ List, mark read, delete, clear-all, clear-read
│       │   ├── audit-report.controller.js ✅ Formal audit request workflow
│       │   └── iot.controller.js         ✅ Weight reading + threshold endpoint
│       │
│       ├── models/                      (17 collections)
│       │   ├── User.js                  ✅ tokenVersion, mustChangePassword, pre-save normalization
│       │   ├── Distributor.js           ✅ Unique (division, wardNo) index; pre-save normalization
│       │   ├── Consumer.js              ✅ NID encryption pre-save hook; ward normalization
│       │   ├── Family.js                ✅ familyKey, flaggedDuplicate
│       │   ├── OMSCard.js               ✅ cardStatus checked at every scan
│       │   ├── QRCode.js                ✅ payload, payloadHash, validFrom, validTo, status
│       │   ├── Token.js                 ✅ Unique (consumerId, sessionId)
│       │   ├── DistributionSession.js   ✅ dateKey, status, reconciliation fields
│       │   ├── DistributionRecord.js    ✅ expectedKg, actualKg, mismatch, source
│       │   ├── StockLedger.js           ✅ Append-only IN/OUT/ADJUST
│       │   ├── AuditLog.js              ✅ Immutable — no delete/update routes
│       │   ├── BlacklistEntry.js        ✅ Consumer + Distributor targets
│       │   ├── Notification.js          ✅ TTL index: Read notifications expire after 30 days
│       │   ├── SmsOutbox.js             ✅ SMS queue model (gateway integration pending)
│       │   ├── AuditReportRequest.js    ✅ Formal distributor audit request lifecycle
│       │   ├── OfflineQueue.js          ✅ Offline scan records + sync status
│       │   └── SystemSetting.js         ✅ Global system configuration key-value
│       │
│       ├── routes/                      (13 route modules, all mounted)
│       │   ├── auth.routes.js           ✅ login, signup, change-password, ack
│       │   ├── admin.routes.js          ✅ Admin-only management
│       │   ├── consumer.routes.js       ✅ Consumer CRUD + card
│       │   ├── distribution.routes.js   ✅ scan, complete, session, tokens, records
│       │   ├── distributor.routes.js    ✅ Distributor self-service
│       │   ├── monitoring.routes.js     ✅ Blacklist + offline queue
│       │   ├── reports.routes.js        ✅ Session + distribution reports
│       │   ├── settings.routes.js       ✅ System settings
│       │   ├── stock.routes.js          ✅ Stock IN + summary
│       │   ├── notification.routes.js   ✅ Notifications with delete support
│       │   ├── iot.routes.js            ✅ IoT weight scale (x-iot-api-key auth)
│       │   ├── field.routes.js          ✅ FieldUser scan + confirm + sync
│       │   └── users.routes.js          ✅ User profile management
│       │
│       ├── middleware/
│       │   ├── auth.js                  ✅ protect() — DB re-check tokenVersion every request
│       │   ├── rbac.js                  ✅ authorize() role whitelist
│       │   ├── error.js                 ✅ 404 + global error handler (no stack traces in prod)
│       │   └── iotAuth.js               ✅ x-iot-api-key validation
│       │
│       ├── services/
│       │   ├── audit.service.js         ✅ writeAudit() — transaction-safe
│       │   ├── fraud.service.js         ✅ checkDistributorMismatchCount() + auto-blacklist
│       │   ├── stock.service.js         ✅ stockOut() — appends immutable StockLedger entry
│       │   ├── token.service.js         ✅ rationQtyByCategory(), makeTokenCode()
│       │   ├── notification.service.js  ✅ notifyAdmins(), notifyUser()
│       │   ├── email.service.js         ✅ credential email, status email, password change alert
│       │   └── nid-security.service.js  ✅ encryptNid(), decryptNid(), hashNid()
│       │
│       ├── utils/
│       │   ├── ward.utils.js            ✅ normalizeWardNo, buildWardMatchQuery, isSameWard
│       │   └── division.utils.js        ✅ normalizeDivision, buildDivisionMatchQuery (Bangla + English)
│       │
│       └── setup/
│           ├── create-admin.js          ✅ One-time admin account creation from env vars
│           ├── ensure-indexes.js        ✅ Syncs all compound and unique indexes
│           ├── verify-collections.js    ✅ Validates collection existence
│           └── create-missing-enterprise-collections.js ✅ Bootstrap utility
│
├── frontend/
│   └── src/
│       ├── App.tsx                      ✅ Route definitions
│       ├── context/AuthContext.tsx      ✅ Auth state + mustChangePassword gate
│       ├── services/api.ts              ✅ Axios + interceptors (401 auto-logout)
│       ├── layouts/
│       │   ├── AdminLayout.tsx          ✅ Admin shell with sidebar + notification bell
│       │   └── DistributorLayout.tsx    ✅ Distributor shell
│       └── pages/
│           ├── admin/                   ✅ Dashboard, Distributors, Consumers, Cards,
│           │                              Distribution, Audit, Reports, Settings
│           └── distributor/             ✅ Dashboard, Beneficiaries, Cards,
│                                          Stock/Distribution (QR scan), Audit,
│                                          Monitoring, Reports
│
└── seed/
    └── seed.js                          ✅ Dev-only (blocked in production)
                                           Dhaka Ward 01 + Khulna Ward 02 datasets
                                           Bangla and English location variants
```

---

## 7. Database Schema

### 17 MongoDB Collections

#### `users`
```javascript
{
  userType: enum["Admin", "Distributor", "FieldUser", "Consumer"],
  name: String,
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  contactEmail: String,               // Receives credential + alert emails (not login email)
  passwordHash: String,               // bcrypt — NEVER returned in any API response
  passwordChangedAt: Date,
  tokenVersion: { type: Number, default: 0 },       // Incremented on suspend/reset
  mustChangePassword: { type: Boolean, default: false },
  status: enum["Active", "Inactive", "Suspended"],
  lastLoginAt: Date,
  wardNo: String,                     // Normalized 2-digit English: "01", "02"
  ward: String,                       // Same normalized value
  division: String,                   // Canonical English: "Khulna", "Dhaka"
  district, upazila, unionName: String,
  officeAddress: String,
  authorityStatus: enum["Pending", "Active", "Revoked", "Suspended"],
  authorityFrom: Date,
  authorityTo: Date                   // Checked at login + every distribution scan
}
// Compound unique index: { division: 1, wardNo: 1, userType: 1 }
//   partialFilterExpression: { userType: "Distributor" }
// Pre-save hook: normalizes division + wardNo + ward on every save/update
```

#### `distributors`
```javascript
{
  userId: ObjectId → User,            // unique
  division: String,                   // Canonical English
  wardNo: String,                     // Normalized 2-digit: "01"
  ward: String,
  district, upazila, unionName: String,
  authorityStatus: enum["Pending", "Active", "Revoked", "Suspended"],
  authorityFrom: Date,
  authorityTo: Date
}
// Compound unique index: { division: 1, wardNo: 1 }
//   One distributor per ward per division enforced at DB level
// Pre-save hook: normalizes division + wardNo + ward
```

#### `consumers`
```javascript
{
  consumerCode: { type: String, unique: true },    // C0001, C0002…
  qrToken: { type: String, unique: true },         // 64-char hex — QR payload
  name: String,
  nidLast4: String,
  nidFull: String,                    // AES-256-GCM encrypted
  nidHash: String,                    // HMAC-SHA-256 for search
  fatherNidFull: String,              // AES-256-GCM encrypted
  fatherNidHash: String,
  motherNidFull: String,              // AES-256-GCM encrypted
  motherNidHash: String,
  status: enum["Active", "Inactive", "Revoked"],   // Default: Inactive
  category: enum["A", "B", "C"],                   // A=5kg, B=4kg, C=3kg
  familyId: ObjectId → Family,
  createdByDistributor: ObjectId → Distributor,
  blacklistStatus: enum["None", "Temp", "Permanent"],
  ward: String,                       // Normalized — matches distributor.wardNo
  division: String                    // Canonical English
}
// Pre-save hook: encrypts NIDs, normalizes ward + division
// Indexes: nidHash, fatherNidHash, motherNidHash
```

#### `families`
```javascript
{
  familyKey: { type: String, unique: true },   // SHA-256(fatherNID + motherNID)
  fatherNidLast4: String,
  motherNidLast4: String,
  flaggedDuplicate: { type: Boolean, default: false }  // Blocks token issuance at scan
}
```

#### `omscards`
```javascript
{
  consumerId: ObjectId → Consumer,
  cardStatus: enum["Active", "Inactive", "Revoked"],   // Checked at every scan
  qrCodeId: ObjectId → QRCode
}
```

#### `qrcodes`
```javascript
{
  payload: String,                    // qrToken value
  payloadHash: String,                // SHA-256(payload) for lookup
  validFrom: Date,
  validTo: Date,                      // Checked at scan — auto-expired
  status: enum["Valid", "Expired", "Revoked"]
}
```

#### `tokens`
```javascript
{
  tokenCode: String,                  // Unique: TKN-2026-0001
  qrPayload: String,                  // Token-specific QR (for receipt printing)
  qrPayloadHash: String,
  sessionDateKey: String,             // "2026-04-08"
  consumerId: ObjectId → Consumer,
  distributorId: ObjectId → Distributor,
  sessionId: ObjectId → DistributionSession,
  rationQtyKg: Number,
  status: enum["Issued", "Used", "Cancelled", "Expired"],
  issuedAt: Date,
  usedAt: Date
}
// CRITICAL INDEX: { consumerId: 1, sessionId: 1 } UNIQUE
// Prevents double-issuance even under race conditions
// MongoDB transaction wraps token creation
```

#### `distributionsessions`
```javascript
{
  distributorId: ObjectId → Distributor,
  dateKey: String,                    // "2026-04-08" — one session per distributor per day
  status: enum["Planned", "Open", "Paused", "Closed", "Cancelled"],
  openedAt: Date,
  closedAt: Date,
  closedByUserId: ObjectId → User,
  reconciliationFlag: Boolean,        // Set if stock vs tokens mismatch on close
  reconciliationNote: String
}
```

#### `distributionrecords`
```javascript
{
  tokenId: ObjectId → Token,
  expectedKg: Number,
  actualKg: Number,
  mismatch: Boolean,                  // |actual - expected| > threshold
  source: enum["manual", "iot"]
}
```

#### `stockledgers`
```javascript
{
  distributorId: ObjectId → Distributor,
  type: enum["IN", "OUT", "ADJUST"],
  item: String,                       // "Rice"
  qtyKg: Number,
  dateKey: String,
  ref: String                         // tokenCode for OUT, batch ID for IN
}
// APPEND-ONLY — no update or delete routes exist
```

#### `auditlogs`
```javascript
{
  actorUserId: ObjectId → User,
  actorType: enum["Central Admin", "Distributor", "FieldUser", "System"],
  action: String,
  entityType: String,
  entityId: String,
  severity: enum["Info", "Warning", "Critical"],
  meta: Object
}
// IMMUTABLE — no delete, no update
// TTL index: 5-year retention
```

#### `blacklistentries`
```javascript
{
  distributorId: ObjectId → Distributor,
  createdByUserId: ObjectId → User,
  targetType: enum["Consumer", "Distributor"],
  targetRefId: String,
  blockType: enum["Temporary", "Permanent"],
  reason: String,
  active: Boolean,
  expiresAt: Date                     // For Temporary entries
}
```

#### `notifications`
```javascript
{
  userId: ObjectId → User,
  channel: enum["App"],
  title: String,
  message: String,
  status: enum["Unread", "Read"],
  meta: Object
}
// Index: { userId: 1, status: 1, createdAt: -1 }
// TTL index: Read notifications auto-deleted after 30 days
```

#### `systemsettings`
```javascript
// Key-value store. Key: "distributor:global:settings"
{
  distribution: { weightThresholdKg: 1, autoPauseOnMismatch: true, tokenPerConsumerPerDay: 1 },
  qr: { expiryCycleDays: 30, autoRotation: true, revokeBehavior: "StrictReject" },
  fraud: { autoBlacklistMismatchCount: 3, temporaryBlockDays: 7 },
  allocation: { A: 5, B: 4, C: 3 },
  offline: { enabled: true, conflictPolicy: "ServerWins" },
  notifications: { sms: true, app: true },
  audit: { retentionYears: 5, immutable: true }
}
```

#### `auditreportrequests`
```javascript
{
  requestedByUserId: ObjectId → User,       // Admin who requested
  targetDistributorId: ObjectId → User,     // Distributor asked to respond
  title: String,
  description: String,
  status: enum["Pending", "Submitted", "Approved", "Rejected", "Escalated"],
  response: String,
  reviewedByUserId: ObjectId → User,
  reviewedAt: Date
}
```

#### `smsoutboxes`
```javascript
{
  to: String,                        // Phone number
  message: String,
  status: enum["Queued", "Sent", "Failed"],
  retryCount: Number,
  sentAt: Date
}
// SMS gateway integration pending — model and queue ready
```

#### `offlinequeues`
```javascript
{
  distributorId: ObjectId → Distributor,
  payload: Object,                   // { action, consumerCode, ... }
  status: enum["Pending", "Synced", "Failed"],
  conflictNote: String,
  syncedAt: Date
}
```

---

## 8. API Reference

### Base URL
```
http://localhost:5000/api
```

All protected routes require:
```http
Authorization: Bearer <JWT_TOKEN>
```

---

### 8.1 Auth Routes `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/signup` | ❌ | Distributor self-registration (creates Pending user) |
| POST | `/login` | ❌ | Login → JWT (includes `mustChangePassword` flag) |
| GET | `/me` | ✅ | Get current user profile |
| PUT | `/change-password` | ✅ | Change own password (tokenVersion++, fresh JWT returned) |
| GET | `/password-change/ack` | ❌ | Email acknowledgement link handler (public HTML page) |

**Login response includes:**
```json
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "user": { "_id": "...", "name": "...", "userType": "Distributor", "wardNo": "01", "division": "Khulna" },
    "mustChangePassword": true
  }
}
```
Frontend checks `mustChangePassword` and redirects to `/change-password` before allowing dashboard access.

---

### 8.2 Admin Routes `/api/admin` (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Dashboard stats: pending distributors, fraud alerts, active sessions |
| GET | `/distributors` | List all distributors (filter by status, division, ward) |
| POST | `/distributors/create` | Create distributor (system email auto-generated, temp password emailed) |
| PATCH | `/distributors/:userId/status` | Approve / Suspend / Revoke (tokenVersion++ on suspend) |
| PATCH | `/distributors/:userId/reset-password` | Reset temp password (tokenVersion++, mustChangePassword=true) |
| DELETE | `/distributors/:userId` | Delete distributor record |
| GET | `/consumers/review` | Consumers with `flaggedDuplicate = true` |
| GET | `/cards/summary` | OMS card status overview |
| GET | `/distribution/monitoring` | Live session view across all distributors |
| PATCH | `/distribution/session/:sessionId/force-close` | Force-close any session |
| GET | `/audit` | Full audit log with filters (severity, actor, date range, action) |
| GET | `/audit/:id/detail` | Single audit event detail |
| GET | `/audit/requests` | List all formal audit report requests |
| POST | `/audit/requests` | Request formal audit report from a distributor |
| PATCH | `/audit/requests/:id/review` | Approve / Reject / Escalate audit report |

**Admin-created distributor login email format:**
```
distributor.{divisionSlug}.ward{nn}@amar-ration.local
Example: distributor.khulna.ward02@amar-ration.local
```

---

### 8.3 Consumer Routes `/api/consumers`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin, Distributor | List (filter: ward, division, status, category) |
| POST | `/` | Distributor | Register new consumer (NID encrypted, family fingerprinted) |
| GET | `/:id` | Admin, Distributor | Consumer detail (NIDs decrypted for authorized viewers) |
| PATCH | `/:id/status` | **Admin only** | Activate / Inactivate / Revoke |
| GET | `/:id/card` | Admin, Distributor | OMS card info + QR data URL |
| POST | `/:id/card/reissue` | **Admin only** | Reissue QR — new token, old instantly invalid |

---

### 8.4 Distribution Routes `/api/distribution`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/scan` | Distributor, FieldUser | 10-check scan pipeline → issue token (MongoDB transaction) |
| POST | `/complete` | Distributor, FieldUser | Complete distribution (weight, stock deducted) |
| GET | `/tokens` | Admin, Distributor, FieldUser | List tokens |
| PATCH | `/tokens/:id/cancel` | Distributor | Cancel token (reason required) |
| GET | `/records` | Admin, Distributor, FieldUser | Distribution records with weight data |
| GET | `/stats` | Admin, Distributor, FieldUser | Session statistics |
| GET | `/quick-info` | Admin, Distributor, FieldUser | Today's session summary |
| POST | `/session/close` | Distributor | Close session + reconciliation + QR rotation |
| GET | `/sessions` | Admin, Distributor | List sessions with filters |

---

### 8.5 Distributor Routes `/api/distributor`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | Ward stats, session info, consumer count |
| GET | `/beneficiaries` | Consumer list scoped to distributor's division + ward |
| GET | `/tokens` | Tokens issued by this distributor |
| GET | `/audit` | Own audit log |
| GET | `/reports` | Own session reports |
| GET | `/monitoring` | Blacklist + offline queue summary |

---

### 8.6 Stock Routes `/api/stock`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/in` | Admin, Distributor | Record incoming stock (StockLedger IN entry) |
| GET | `/summary` | Admin, Distributor, FieldUser | Running balance by distributor + date |

---

### 8.7 Notification Routes `/api/notifications`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List own notifications (paginated, filterable by status) |
| GET | `/unread-count` | Unread count for topbar bell |
| PATCH | `/:id/read` | Mark single notification as read |
| PATCH | `/read-all` | Mark all as read |
| DELETE | `/:id` | Delete a single notification |
| DELETE | `/clear-all` | Delete ALL notifications (fresh start) |
| DELETE | `/clear-read` | Delete only already-read notifications |

Read notifications are also auto-deleted after 30 days by a MongoDB TTL index.

---

### 8.8 Monitoring Routes `/api/monitoring`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Blacklist count, offline queue count, alert summary |
| GET | `/blacklist` | List blacklist entries (Admin sees all; Distributor sees own) |
| POST | `/blacklist` | Create blacklist entry |
| POST | `/blacklist/:id/deactivate` | Remove from blacklist (appeal) |
| GET | `/offline-queue` | View offline cached records |
| POST | `/offline-queue` | Submit offline scan record |
| POST | `/offline-queue/sync-all` | Sync all pending records |

---

### 8.9 IoT Routes `/api/iot` (x-iot-api-key auth — no JWT)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/weight-reading` | Weight scale pushes reading → updates active token |
| GET | `/weight-threshold` | Scale pulls current tolerance setting |

---

### 8.10 Field Routes `/api/field` (FieldUser JWT only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/session-status` | Current session status for field operator |
| POST | `/scan` | Same 10-check pipeline as Distributor scan |
| POST | `/confirm` | Same as distribution complete |
| GET | `/notifications` | Field user notifications |
| POST | `/offline-sync` | Sync offline queue |

---

## 9. Feature Status Tracker

### ✅ Fully Implemented

#### Backend
- [x] All 13 route modules mounted in `app.js`
- [x] `helmet` security headers
- [x] `express-rate-limit` — global (300/15min) + login-specific (10/15min)
- [x] CORS restricted to `ALLOWED_ORIGINS` env var
- [x] JWT with `tokenVersion` + `jti` — instant invalidation on suspend/reset
- [x] `mustChangePassword` flag — forced change flow on first login and after admin reset
- [x] `protect()` middleware — DB re-check on **every** authenticated request
- [x] Password change acknowledgement email with clickable JWT-signed links
- [x] Admin-created distributor with system-generated login email (division.ward format)
- [x] Admin reset distributor password (temp password, email delivery)
- [x] NID AES-256-GCM encryption with prefix-guard and HMAC hash
- [x] Consumer model pre-save NID encryption hook
- [x] Division+Ward normalization — Bangla and English both accepted everywhere
- [x] `ward.utils.js` — `normalizeWardNo()`, `buildWardMatchQuery()`, `isSameWard()`
- [x] `division.utils.js` — `normalizeDivision()`, `buildDivisionMatchQuery()`, Bangla aliases
- [x] Pre-save normalization hooks on `User`, `Distributor`, `Consumer` models
- [x] Compound unique index `(division, wardNo)` on both `users` and `distributors`
- [x] Duplicate ward+division check before creating distributor
- [x] 10-layer scan validation pipeline (QR validity → QR expiry → division+ward scope → blacklist → family flag → consumer active → card active → authority expiry → session status → DB duplicate index)
- [x] MongoDB transaction wrapping token creation + audit log
- [x] Token replay prevention (`status === 'Issued'` required for complete)
- [x] Auto-fraud detection service (30-day rolling mismatch window)
- [x] Auto-blacklist + suspend + tokenVersion++ on fraud threshold breach
- [x] Session close with reconciliation (expected vs actual kg) + QR rotation
- [x] Admin force-close session
- [x] StockLedger append-only (IN + OUT + ADJUST)
- [x] AuditLog — no delete, no update routes
- [x] Notification delete (single, clear-all, clear-read)
- [x] Notification TTL — Read notifications auto-expired after 30 days
- [x] Email service — credential delivery, status change, password change alert
- [x] IoT weight scale endpoints (`x-iot-api-key` authentication)
- [x] Field User routes (scan, confirm, session-status, offline-sync)
- [x] Offline queue model + sync with ServerWins conflict policy
- [x] Formal audit report request lifecycle (Admin request → Distributor submit → Admin review)
- [x] `create-admin.js` — one-time admin bootstrap from env vars (refuses if admin exists)
- [x] `ensure-indexes.js` — syncs all compound and unique DB indexes
- [x] `seed.js` — blocked in production; includes Dhaka Ward 01 + Khulna Ward 02 datasets with session history, tokens, records, stock ledger, audit logs, blacklist entries

#### Frontend
- [x] Admin Dashboard, Distributors, Consumers, Cards, Distribution, Audit, Reports, Settings pages
- [x] Distributor Dashboard, Beneficiaries, Cards & Tokens, Stock/Distribution (QR scan), Audit, Monitoring, Reports pages
- [x] QR scanner component (camera-based)
- [x] `mustChangePassword` redirect gate in `AuthContext`
- [x] Axios interceptors — auto-logout on 401 `TOKEN_INVALIDATED` or `SESSION_INVALIDATED`

---

### ⏳ Planned / Roadmap

#### Medium Priority
- [ ] `node-cron` job — auto-deactivate expired Temporary blacklist entries
- [ ] `node-cron` job — QR auto-rotation per `expiryCycleDays` setting
- [ ] CSV / Excel export for admin reports and audit log
- [ ] Zod validation on all route inputs (partially applied)
- [ ] JWT refresh token rotation (currently 2hr single-use)
- [ ] Admin 2FA (TOTP with `speakeasy`)
- [ ] OMS Card printable PDF (`pdfkit` or browser-side `jsPDF`)

#### Lower Priority / Future
- [ ] SMS gateway integration (`SmsOutbox` model and queue ready; gateway not wired)
- [ ] WebSocket / SSE real-time push for weight alerts and fraud events
- [ ] Dashboard auto-refresh polling (60s interval)
- [ ] Field Distributor Mobile App (React Native / Flutter — partner scope)
- [ ] MongoDB Atlas automatic backups + point-in-time recovery
- [ ] Winston logger with daily file rotation
- [ ] External auditor read-only access to AuditLog

---

## 10. Admin Web Dashboard

### Page-by-Page Feature Map

#### `/admin/dashboard`
- Summary cards: active consumers, pending distributors, open sessions, Critical audit events today
- Fraud alert count (mismatches in last 30 days)
- Offline sync queue status
- Recent Critical audit events

#### `/admin/distributors`
- Filterable list by status, division, ward
- **Create distributor**: name, contactEmail, wardNo, division → system login email auto-generated, temp password emailed
- **Approve**: sets `authorityFrom = today`, `authorityTo = today + N months`, `mustChangePassword = true`
- **Suspend**: `tokenVersion++` → immediate effect; active session auto-paused
- **Revoke**: permanent, no reinstatement
- **Reset password**: new temp password generated, emailed, `mustChangePassword = true`, `tokenVersion++`
- View authority expiry date, mismatch count, last login

#### `/admin/consumers`
- Filter by: division, ward, status, category, duplicate flag
- **Activate**: `Consumer.status = 'Active'` + `OMSCard.cardStatus = 'Active'`
- **Inactivate** / **Revoke**
- View `flaggedDuplicate` consumers → resolve or confirm duplication

#### `/admin/cards`
- OMS card status overview
- **Reissue card**: new 64-char `qrToken`, old token immediately invalid, new card for physical printing

#### `/admin/distribution`
- Live session monitoring across all distributors and divisions
- Per-session: tokens issued, stock used, mismatch count, status
- **Force-close** any session (with reason) → `SESSION_FORCE_CLOSED` audit event

#### `/admin/audit`
- Full audit log: filter by severity, actor, date range, action code
- View full `meta` object per event
- Request formal audit report from a specific distributor
- Review submitted reports → Approve / Reject / Escalate
- "Not me" flag alerts visible here

#### `/admin/reports`
- Distribution summary by date range, ward, division, distributor
- Reconciliation report: StockLedger IN vs OUT per session
- Per-session mismatch count, cancelled tokens, reconciliation flag

#### `/admin/settings`
| Setting | Default | Description |
|---|---|---|
| `weightThresholdKg` | 1 kg | Max tolerated difference |
| `autoPauseOnMismatch` | true | Auto-pause session on weight mismatch |
| `expiryCycleDays` | 30 | Days before QR token auto-rotated |
| `autoBlacklistMismatchCount` | 3 | Mismatches in 30 days → auto-blacklist |
| `temporaryBlockDays` | 7 | Duration of auto temporary block |
| `categoryA/B/C` | 5/4/3 kg | Ration allocation per category |
| `smsEnabled` | true | Toggle SMS notifications |
| `appEnabled` | true | Toggle in-app notifications |
| `offlineEnabled` | true | Allow offline mode |
| `authorityMonths` | 12 | Default authority duration for new distributors |

---

## 11. Distributor Web Dashboard

### Page-by-Page Feature Map

#### `/dashboard`
- Session status (Open / Planned / Closed), tokens issued today, mismatches, stock used
- Ward consumer count, pending card activations
- Notification bell with unread count

#### `/beneficiaries`
- Consumer list scoped to own division + ward
- **Register new consumer**: NID + family NID form, ward auto-filled
- View consumer status, card status, last distribution date
- Flag consumer for admin review

#### `/cards`
- OMS cards for ward consumers; QR validity, issue date
- Consumers served today highlighted with green badge

#### `/stock` (Distribution page)
- **Open session** → creates `DistributionSession`
- QR scanner + manual consumer code entry fallback
- After scan: consumer info + ration qty + token code displayed
- Issued tokens list for current session
- **Cancel token** (reason required)
- **Close session**: reconciliation → `SESSION_CLOSED` audit

#### `/audit`
- Own action log; formal audit report requests from admin
- **Submit report response**

#### `/monitoring`
- Blacklist entries; offline queue count; **Trigger manual sync**

#### `/reports`
- Session history with date range filter; per-session reconciliation data

---

## 12. Fraud Detection & Prevention

### Layer 1: Identity Fingerprinting (Registration)

```javascript
familyKey = SHA256(fatherNidFull + motherNidFull)
// If Family with this key already exists → flaggedDuplicate = true
// Blocks token issuance at scan time regardless of Consumer.status
```

### Layer 2: Ten-Check QR Scan Pipeline

```
1. QR payload resolves to Consumer + QRCode document
2. QRCode.status = "Valid" and QRCode.validTo not exceeded
3. Consumer is within distributor's division AND ward
4. Consumer.blacklistStatus = "None"
5. Family.flaggedDuplicate = false
6. Consumer.status = "Active"
7. OMSCard.cardStatus = "Active"
8. Distributor.authorityTo > now()
9. DistributionSession.status = "Planned" (auto-opened on first scan)
10. MongoDB unique index rejects duplicate (consumerId + sessionId)
```

All checks are wrapped in a MongoDB transaction. Failure at any layer writes an immutable audit entry.

### Layer 3: Token Replay Prevention

```javascript
// Before completing distribution:
if (token.status !== "Issued") {
  // Token is Used, Cancelled, or Expired
  writeAudit({ action: "TOKEN_REPLAY_ATTEMPT", severity: "Critical" });
  return 400; // Replay rejected
}
```

### Layer 4: Weight Mismatch Detection

`|actualKg − expectedKg| > weightThresholdKg` triggers:
1. `DistributionRecord.mismatch = true`
2. Admin notified in-app
3. Distributor notified in-app
4. Audit: `WEIGHT_MISMATCH` [Critical]
5. Session auto-paused (if `autoPauseOnMismatch = true`)
6. `checkDistributorMismatchCount()` called asynchronously

### Layer 5: Auto-Blacklist After Repeated Mismatches

`fraud.service.js` — rolling 30-day window:
```
mismatch count in 30 days ≥ threshold (default: 3)?
  → Create BlacklistEntry { blockType: "Temporary", expiresAt: +7 days }
  → User.authorityStatus = "Suspended"
  → User.status = "Suspended"
  → user.tokenVersion++ (existing JWT rejected immediately)
  → Audit: AUTO_FRAUD_FLAG [Critical]
  → notifyAdmins (with ward + division info)
  → notifyUser (account suspended)
```

### Layer 6: Session Reconciliation

On `POST /api/distribution/session/close`:
```
totalExpectedKg = SUM(token.rationQtyKg WHERE session = this AND status IN ["Used"])
totalActualKg   = SUM(stockledger.qtyKg WHERE distributor = this AND type = "OUT" AND dateKey = today)

|totalExpectedKg − totalActualKg| > threshold?
  → session.reconciliationFlag = true
  → Audit: SESSION_RECONCILIATION_MISMATCH [Critical]
  → notifyAdmins

Then: QR tokens for all served consumers are rotated (new qrToken per expiryCycleDays setting)
```

### Layer 7: Immutable Audit Trail

- No DELETE, no UPDATE on `AuditLog` — ever
- Every rejection, approval, suspension, fraud event is permanent
- Includes `meta` object with full context
- 5-year TTL retention index

### Complete Fraud Scenario Coverage

| Scenario | Prevention |
|---|---|
| Duplicate family registration | familyKey SHA-256 + flaggedDuplicate blocks distribution |
| Ghost consumer by corrupt distributor | Admin-only activation |
| Distributor scanning another division's ward | Division + ward boundary check (Check 3) |
| Expired authority distributor | authorityTo check at login + scan (Check 8) |
| Same consumer twice in one day | consumerId+sessionId unique DB index (Check 10) |
| Revoked physical card | Consumer.status + OMSCard.cardStatus (Checks 6+7) |
| Blacklisted consumer | blacklistStatus (Check 4) |
| Short-changing ration weight | Weight mismatch detection + auto-suspend |
| Repeated short-changing | Auto-blacklist after threshold |
| Session stock discrepancy | Reconciliation on session close |
| Token reuse / replay | token.status must be "Issued" |
| Concurrent race condition double-scan | MongoDB unique index is atomic |
| Suspended distributor keeps API access | tokenVersion check on every request — sub-second effect |
| Distributor denies changing their password | mustChangePassword gate blocks dashboard |
| Unauthorized password change from account | Email ack link → "Not me" flags admin |
| Running seed in production | NODE_ENV === "production" → process.exit(1) |

---

## 13. Security Implementation Deep Dive

### 13.1 tokenVersion — Sub-Second Session Invalidation

Every User document has a `tokenVersion: Number` field (default: 0).

**When tokenVersion increments:**
- Admin suspends a distributor
- Admin revokes a distributor
- Admin resets a distributor's password
- Distributor changes their own password
- Distributor is re-enabled after suspension (new temp password issued)
- Auto-fraud suspension by `fraud.service.js`

**How it works:**
```javascript
// auth.js protect() — runs on EVERY authenticated request
const user = await User.findById(decoded.userId)
  .select("status authorityStatus userType tokenVersion")
  .lean();

if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion || 0)) {
  return res.status(401).json({
    code: "TOKEN_INVALIDATED",
    message: "Session invalidated. Please login again."
  });
}
```

The DB fetch is minimal (4 fields only). For very high-traffic deployments, a Redis cache with 30-second TTL can be added as an optimization layer.

### 13.2 NID Encryption — AES-256-GCM

```javascript
// Key derivation
const key = crypto.createHash("sha256").update(NID_ENCRYPTION_KEY).digest(); // 32 bytes

// Encryption (unique IV per record)
const iv  = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
// Stored as: "enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>"

// Double-encryption guard
if (plain.startsWith("enc:v1:")) return plain; // already encrypted — skip
```

**Key separation:** `app.js` validates at startup:
```javascript
if (process.env.NID_ENCRYPTION_KEY === process.env.JWT_SECRET) {
  console.error("FATAL: NID_ENCRYPTION_KEY must be different from JWT_SECRET");
  process.exit(1);
}
```

### 13.3 Division + Ward Canonical Normalization

See [Section 14](#14-division--ward-normalization-engine) for the full engine documentation.

### 13.4 Email Security Patterns

The `email.service.js` provides three email types:

| Email | Trigger | Content |
|---|---|---|
| **Credential delivery** | Admin creates distributor | Login email, temp password, portal URL |
| **Status change** | Admin suspends/revokes/re-enables | Status reason, contact info |
| **Password change alert** | Any password change | Change details + "Yes/Not me" clickable links |

The "Not me" action is backed by a 7-day signed JWT. Clicking it:
1. Writes `PASSWORD_CHANGE_UNAUTHORIZED_FLAG` [Critical] to AuditLog
2. Notifies all admins in-app
3. Renders a confirmation HTML page

---

## 14. Division & Ward Normalization Engine

Bangladesh has 8 divisions, each with multiple wards. The same ward number (e.g., "02") can legally exist in every division. The system uses both `division` AND `wardNo` together in every scope check.

### 14.1 Ward Normalization (`ward.utils.js`)

```javascript
normalizeWardNo("০২")         // Bangla digits  → "02"
normalizeWardNo("ওয়ার্ড-০১")  // Full Bangla    → "01"
normalizeWardNo("Ward-05")    // English prefix → "05"
normalizeWardNo("7")          // No leading zero → "07"
normalizeWardNo("02")         // Already clean  → "02"
```

**Fuzzy DB query builder:**
```javascript
buildWardMatchQuery("02")
// Returns: { $or: [{ wardNo: /^02$/ }, { ward: /^02$/ }, { ward: /^ওয়ার্ড.*02$/ }] }
```

### 14.2 Division Normalization (`division.utils.js`)

| Input | Canonical Output |
|---|---|
| `"খুলনা"` | `"Khulna"` |
| `"khulna"` | `"Khulna"` |
| `"KHULNA"` | `"Khulna"` |
| `"ঢাকা"` | `"Dhaka"` |
| `"chittagong"` | `"Chattogram"` |
| `"চট্টগ্রাম"` | `"Chattogram"` |

Supported divisions and all aliases:

| Canonical | Bangla | Common Variants |
|---|---|---|
| Dhaka | ঢাকা | dhaka |
| Chattogram | চট্টগ্রাম | chittagong, chattagram |
| Rajshahi | রাজশাহী | rajshahi |
| Khulna | খুলনা | khulna |
| Barishal | বরিশাল | barishal |
| Sylhet | সিলেট | sylhet |
| Rangpur | রংপুর | rangpur |
| Mymensingh | ময়মনসিংহ | mymensingh |

**DB query builder for aliases:**
```javascript
buildDivisionMatchQuery("খুলনা")
// Returns: { $in: [/^Khulna$/i, /^খুলনা$/i, /^khulna$/i] }
```

### 14.3 Pre-Save Normalization Hooks

`User`, `Distributor`, and `Consumer` models all have pre-save hooks that normalize before writing to MongoDB:

```javascript
DistributorSchema.pre("save", function (next) {
  if (this.division) this.division = normalizeDivision(this.division);
  if (this.wardNo)   this.wardNo   = normalizeWardNo(this.wardNo);
  if (this.ward)     this.ward     = normalizeWardNo(this.ward);
  next();
});
// Same hooks for findOneAndUpdate, updateOne, updateMany
```

This means the unique index `(division, wardNo)` always works correctly regardless of input language — `"খুলনা"` and `"Khulna"` produce the same canonical `"Khulna"` before hitting the index.

### 14.4 Scope Enforcement in All Controllers

Every controller that filters by distributor scope uses both:
```javascript
const divisionQuery = buildDivisionMatchQuery(distributor.division);
const wardQuery     = buildWardMatchQuery(distributor.wardNo);
// Both applied together — not either/or
```

---

## 15. Notification System

### In-App Notifications

- `Notification` model with `userId`, `title`, `message`, `status` (Unread/Read), `meta`
- `notifyAdmins(payload)` — broadcasts to all Admin users
- `notifyUser(userId, payload)` — sends to a specific user

### Notification Management

| Action | Endpoint |
|---|---|
| List (paginated) | `GET /api/notifications` |
| Unread count (for bell) | `GET /api/notifications/unread-count` |
| Mark one read | `PATCH /api/notifications/:id/read` |
| Mark all read | `PATCH /api/notifications/read-all` |
| Delete one | `DELETE /api/notifications/:id` |
| Clear all | `DELETE /api/notifications/clear-all` |
| Clear read only | `DELETE /api/notifications/clear-read` |

### Auto-Expiry

A MongoDB TTL index auto-deletes Read notifications after 30 days:
```javascript
NotificationSchema.index(
  { updatedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60,
    partialFilterExpression: { status: "Read" },
    name: "ttl_read_notifications_30d" }
);
```
Unread notifications persist until explicitly deleted by the user.

### Notification Triggers

| Event | Recipients |
|---|---|
| Family duplicate detected at registration | All admins |
| Weight mismatch on distribution | Admin + distributor |
| Auto-fraud flag / distributor suspended | All admins + distributor |
| Session reconciliation mismatch | All admins |
| Token issued | Distributor (confirmation) |
| Stock insufficient | Admin + distributor |
| Password change (unauthorized flag) | All admins |

---

## 16. QR Card Lifecycle

```
Consumer Registration
  → qrToken = crypto.randomBytes(32).toString("hex")  [64 chars]
  → QRCode created: { payload: qrToken, validFrom: now, validTo: now+30d, status: "Valid" }
  → OMSCard created: { cardStatus: "Inactive" }

Admin Activates Consumer
  → Consumer.status = "Active"
  → OMSCard.cardStatus = "Active"
  → Physical card printed with QR code image

Distribution Day
  → Distributor scans QR → 10-check pipeline → Token issued
  → Token.status: "Issued" → "Used" on complete

Session Close
  → rotateOmsQrAfterSessionClose() runs for all served consumers
  → New qrToken generated per consumer
  → Old QRCode.status = "Revoked"
  → New QRCode created with validTo = now + expiryCycleDays

Consumer Revoked
  → Consumer.status = "Revoked"
  → OMSCard.cardStatus = "Revoked"
  → QRCode.status = "Revoked"
  → Physical card is now worthless — scan rejected in real time

Card Reissue (Admin)
  → New qrToken generated
  → Old QRCode.status = "Revoked"
  → New QRCode + OMSCard created
  → New physical card must be printed and delivered
```

---

## 17. Distribution Workflow

### Session States

```
Planned ──[first scan]──► Open ──[mismatch + autoPause]──► Paused
                                                               │
                            ◄───────[admin resume]────────────┘
                              │
                              ▼
                           Closed ──[admin force]──► (from any state)
```

### Daily Workflow

```
1. Distributor logs in — authorityTo check at login
   If mustChangePassword=true → forced to /change-password first

2. Distributor starts distribution (first scan auto-creates Planned session)

3. Consumer presents physical OMS card
   → QR scanned by camera or code entered manually
   → 10-check pipeline
   → Token issued (MongoDB transaction)

4. Distributor hands over ration
   → POST /complete { tokenId, actualKg }
   → If IoT scale connected → weight auto-populated from /api/iot/weight-reading
   → StockLedger OUT entry appended
   → mismatch check

5. Session close
   → Reconciliation computed
   → QR tokens rotated for all served consumers
   → SESSION_CLOSED audit

6. Admin reviews
   → Reconciliation flag visible on admin distribution page
   → Can request formal audit report
```

---

## 18. Offline Mode

The `OfflineQueue` collection holds scan records captured when connectivity is lost.

### Offline Flow

```
Network lost
  → Distributor scans QR → stored in OfflineQueue { status: "Pending" }

Network restored
  → POST /api/monitoring/offline-queue/sync-all
  → Each pending record is replayed through the full 10-check pipeline
  → ServerWins policy: if consumer was revoked/blacklisted between scan and sync
    → OfflineQueue.status = "Failed", conflictNote set
    → Admin can review and manually resolve
  → Successful records: OfflineQueue.status = "Synced"
```

**Key constraint:** Offline scans are not automatically approved. They are validated against current DB state at sync time. A consumer revoked while the distributor was offline will have their offline token rejected.

---

## 19. IoT Weight Scale Integration

### Architecture

```
Weight Scale Hardware
  → POST https://backend/api/iot/weight-reading
  → Headers: { x-iot-api-key: <IOT_API_KEY_env> }
  → Body: { weightKg: 4.98, deviceId: "SCALE-001" }

Backend:
  → protectIotDevice() validates x-iot-api-key
  → Finds active Issued token for this distributor's current session
  → Updates token with weight reading
  → Returns: { threshold, tokenId, expectedKg }
```

### Threshold Endpoint

```
GET /api/iot/weight-threshold
→ Returns current weightThresholdKg from SystemSetting
→ Scale uses this to calibrate its own alert LED/buzzer
```

The IoT integration uses a **separate authentication key** (`x-iot-api-key`) that is not a JWT — hardware devices don't have user sessions. The key is validated by `iotAuth.js` middleware and stored in the `IOT_API_KEY` environment variable.

---

## 20. Setup & Running the Project

### Prerequisites

- Node.js v18+
- MongoDB Atlas account (or local MongoDB v6+)
- npm v9+

### Quick Start

```bash
# 1. Clone and install
git clone <repository-url>
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in MONGO_URI, JWT_SECRET, NID_ENCRYPTION_KEY

# 3. Sync all database indexes
node src/setup/ensure-indexes.js

# 4. Seed development data (blocked in production)
NODE_ENV=development node src/seed/seed.js

# 5. Start server
npm run dev       # Development (nodemon)
npm start         # Production
```

### First-Time Production Setup

```bash
# 1. Set environment variables (see §21)
# 2. Create admin account (reads from env vars — fails if admin already exists)
node src/setup/create-admin.js
# → Remove ADMIN_PASSWORD from .env immediately after running

# 3. Sync indexes
node src/setup/ensure-indexes.js

# 4. Start server
NODE_ENV=production npm start
```

### Development Seed Data

After running `seed.js`, the following accounts are available:

| Account | Email | Phone | Password |
|---|---|---|---|
| Admin | `admin@amar-ration.local` | 01700000000 | `admin123` |
| Distributor (Dhaka, Ward 01) | `distributor.dhaka.ward01@amar-ration.local` | 01800000000 | `dist123` |
| Distributor (Khulna, Ward 02) | `distributor.khulna.ward02@amar-ration.local` | 01800000002 | `dist123` |
| Field User (Dhaka, Ward 01) | `field@amar-ration.local` | 01900000000 | `field123` |
| Field User (Khulna, Ward 02) | `field-khulna@amar-ration.local` | 01900000002 | `field123` |

Seed creates 24 consumers across 3 wards (8 each), 6 distribution sessions, 12 tokens, 8 distribution records, 14 stock ledger entries, 9 audit log entries, and 2 blacklist entries.

---

## 21. Environment Configuration

```bash
# Database
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/smart-oms

# JWT Authentication
JWT_SECRET=<minimum 64 char cryptographically random string>
JWT_EXPIRES_IN=2h

# NID Encryption (MUST be different from JWT_SECRET)
NID_ENCRYPTION_KEY=<minimum 64 char cryptographically random string>

# IoT Weight Scale
IOT_API_KEY=<random key for weight scale hardware>

# CORS (comma-separated)
ALLOWED_ORIGINS=https://admin.amar-ration.gov.bd,https://distributor.amar-ration.gov.bd

# Rate Limiting
RATE_LIMIT_MAX=300        # Global requests per 15 minutes
RATE_LIMIT_LOGIN_MAX=10   # Login attempts per 15 minutes

# Server
PORT=5000
NODE_ENV=production
BACKEND_PUBLIC_URL=https://api.amar-ration.gov.bd  # Used in email acknowledgement links

# Email (nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@amar-ration.gov.bd
SMTP_PASS=<app password>
SMTP_FROM="Amar Ration System <noreply@amar-ration.gov.bd>"

# Admin Setup (remove after running create-admin.js)
# ADMIN_EMAIL=admin@amar-ration.gov.bd
# ADMIN_PHONE=01XXXXXXXXX
# ADMIN_PASSWORD=<minimum 12 chars>
# ADMIN_NAME=Central Admin
```

---

## 22. Security Hardening Checklist

### ✅ Implemented

- [x] `helmet` — security headers (CSP, HSTS, X-Frame-Options, X-XSS-Protection)
- [x] `express-rate-limit` — global 300/15min + login-specific 10/15min
- [x] CORS restricted via `ALLOWED_ORIGINS` env var (rejects unknown origins)
- [x] JWT `tokenVersion` — instant invalidation on suspend/reset/password-change
- [x] JWT `jti` (unique nonce per token) — prevents token sharing
- [x] DB re-check on every authenticated request (no stale trust)
- [x] NID encryption with AES-256-GCM (unique IV per record, auth tag)
- [x] Key separation enforced at startup (`NID_ENCRYPTION_KEY ≠ JWT_SECRET`)
- [x] `passwordHash` never returned in any API response (`.select("-passwordHash")`)
- [x] No verbose error details in production 500 responses (`console.error` only)
- [x] `Cache-Control: no-store` on all API responses
- [x] Admin accounts only via `create-admin.js` script — no self-signup path
- [x] Signup blocked for `userType: "Admin"` in auth controller
- [x] `express.json({ limit: "2mb" })` — request body size cap
- [x] Compound unique DB index prevents duplicate ward+division distributors
- [x] MongoDB transactions on token creation (atomicity under race conditions)
- [x] `seed.js` blocked with `process.exit(1)` when `NODE_ENV=production`
- [x] Remote DB seed confirmation prompt (type "yes" to proceed)
- [x] Authority expiry auto-detected at login + at every scan

### ⏳ Recommended Before Production

- [ ] **Change `JWT_SECRET`** to 64+ char cryptographically random value
- [ ] **Enable HTTPS / TLS** — nginx reverse proxy + Let's Encrypt
- [ ] **MongoDB Atlas IP whitelist** — only backend server IP allowed
- [ ] **JWT refresh token flow** — current 2hr single token has no rotation
- [ ] **Admin 2FA (TOTP)** — `speakeasy` + QR code for admin login
- [ ] **Zod validation** — complete coverage of all route inputs
- [ ] **Audit log TTL** — verify 5-year index is applied in production
- [ ] **Log rotation** — Winston logger with daily rotate
- [ ] **Set `NODE_ENV=production`** — disables verbose stack traces

### Non-Negotiable Code Constraints

- `AuditLog` has **NO delete route** and **NO update route** — ever
- `StockLedger` entries are **never updated or deleted** — only appended
- `passwordHash` must **never appear** in any API JSON response
- Full NID numbers are **AES-256-GCM encrypted** at rest — never stored plaintext
- IoT endpoint must reject all requests without valid `x-iot-api-key` header
- `NID_ENCRYPTION_KEY` and `JWT_SECRET` must always be different values

---

## 23. Pending & Roadmap Features

### Cron Jobs (Planned — `node-cron`)

```javascript
// Auto-deactivate expired temporary blacklist entries (run every hour)
cron.schedule("0 * * * *", async () => {
  await BlacklistEntry.updateMany(
    { blockType: "Temporary", active: true, expiresAt: { $lte: new Date() } },
    { $set: { active: false } }
  );
  // Sync Consumer.blacklistStatus and Distributor.authorityStatus
});

// QR auto-rotation (run daily at midnight)
cron.schedule("0 0 * * *", async () => {
  // Find consumers whose QRCode.validTo is in the past
  // Rotate tokens per rotateOmsQrAfterSessionClose() logic
});
```

### JWT Refresh Token Flow (Planned)

Current implementation: single 2-hour JWT. Planned:
- Short-lived access token (15 min)
- Long-lived refresh token (7 days, stored in httpOnly cookie)
- `POST /api/auth/refresh` endpoint to issue new access token
- Refresh token invalidated on logout or `tokenVersion` change

### Admin 2FA (Planned)

```bash
npm install speakeasy qrcode
```
- Admin enables TOTP via `GET /api/admin/2fa/setup` → QR code to scan with Authenticator app
- Login requires 6-digit TOTP code after password
- Backup codes generated and stored encrypted

### Field Distributor Mobile App (Partner Scope)

A React Native or Flutter mobile app for field operators. Backend API is already fully prepared:
- `POST /api/field/scan` — same 10-check pipeline
- `POST /api/field/confirm` — same distribution complete
- `POST /api/field/offline-sync` — offline record sync
- `GET /api/field/session-status` — current session

### SMS Gateway Integration

`SmsOutbox` model and notification queue are ready. Requires:
- Integration with an SMS API (e.g., SSL Wireless, Shohoz SMS, Twilio Bangladesh)
- Worker process to dequeue `SmsOutbox` records and send via gateway

### CSV / Excel Export

Reports page export buttons exist in the UI. Backend needs:
- `GET /api/reports/distribution/export?format=csv&from=...&to=...`
- `GET /api/admin/audit/export?format=csv`
- `exceljs` or `papaparse` for file generation

---

## 24. Project Presentation Summary

### What This System Is

The **Smart OMS Ration Distribution System (Amar Ration)** is a full-stack, security-first digital platform that replaces Bangladesh's paper-based, fraud-prone OMS ration distribution with a transparent, tamper-proof, and accountability-enforced workflow. It operates across two web interfaces — Admin Dashboard and Distributor Dashboard — backed by a single secure API server, with IoT weight scale integration and a field user scanning interface.

### What Makes It Different

**1. Instant account suspension — no waiting for JWT expiry.**
Every authentication request re-checks `tokenVersion` from the database. When an admin suspends a distributor at 9:00 AM, that distributor's API calls are rejected from 9:00:01 AM onwards — not at 11:00 AM when their 2-hour JWT would have expired. The same mechanism fires when a password is reset, when fraud is auto-detected, or when a distributor changes their own password.

**2. Forced first-login password change with email confirmation.**
Distributors never choose their own initial password — admin creates it. The `mustChangePassword` flag gates dashboard access until the distributor sets their own password. After any password change, a security alert email with a signed acknowledgement link ("Yes, I did this" / "Not me — flag as unauthorized") is sent. The "Not me" path writes a Critical audit event and alerts all admins.

**3. Both division and ward required for every scope check.**
Bangladesh's 8 divisions each contain wards. Two different divisions can have the same ward number. Every single consumer query, distributor lookup, token issuance check, and session scope operation uses **both** `division` AND `wardNo` together. Division names are accepted in both Bangla (খুলনা) and English (Khulna) — a normalization engine converts all inputs to canonical form before any comparison or DB write.

**4. NID encryption at rest — not just hashing.**
Full NID numbers (10/13/17 digits) are encrypted with AES-256-GCM before storage. Each record has a unique 12-byte IV and a 16-byte authentication tag. A separate HMAC-SHA-256 hash supports duplicate search without decryption. The encryption key and JWT secret are required to be different and both at least 64 characters, validated at server startup.

**5. No self-signup, no self-activation — anywhere in the system.**
Distributors cannot activate themselves; they start as Pending. Consumers cannot activate themselves; they start as Inactive. Admin accounts cannot be created through any API endpoint at all — only through a one-time setup script. Every actor's access is explicitly granted by a higher-privileged actor through a controlled chain.

**6. Ten-layer scan-time fraud prevention.**
Before a single token is issued, the system runs ten sequential checks: QR validity, QR expiry, division+ward boundary, blacklist status, family duplicate flag, consumer active status, OMS card active status, distributor authority expiry, session open status, and MongoDB duplicate token index. A single failure at any layer rejects the scan and writes an immutable audit entry. Layers 9 and 10 use MongoDB transactions and unique indexes to be race-condition-proof.

**7. Auto-fraud detection without human intervention.**
The fraud service monitors weight mismatch counts per distributor over a rolling 30-day window. When the configurable threshold is exceeded, the system automatically suspends the distributor (setting `tokenVersion++` for immediate effect), creates a blacklist entry, alerts all admins, and logs a Critical audit event — in under 100 milliseconds.

**8. Immutable audit trail — the system's permanent memory.**
Every action from every actor is permanently recorded in `AuditLog`. There is no delete route and no update route for this collection — by design, enforced in code. Audit logs survive distributor suspension, consumer revocation, and data corrections. They are the legal record of the system.

**9. Session reconciliation + automatic QR rotation on close.**
When a distribution session is closed, the system computes total expected ration (from token quantities) against total actual stock dispensed (from StockLedger OUT entries). Any discrepancy flags the session for admin review. Simultaneously, all QR tokens for consumers served in that session are automatically rotated — preventing replay attacks with captured QR images.

**10. Notifications are manageable — not just stack-able.**
The notification system supports delete (single and bulk), clear-all, clear-read, and a TTL index that auto-expires Read notifications after 30 days. Notifications are not a one-way fire-and-forget — they are a managed inbox.

### System Statistics

| Metric | Value |
|---|---|
| MongoDB collections | 17 |
| Route modules | 13 (all mounted) |
| Scan-time validation checks | 10 layers |
| Fraud detection layers | 7 (identity → family → QR → blacklist → ward+division → weight → reconciliation) |
| Actor types | 4 (Admin, Distributor, FieldUser, Consumer) |
| Security middleware layers | 6 (rate-limit → helmet → cors → jwt → tokenVersion → RBAC) |
| NID fields encrypted | 3 per consumer (nidFull, fatherNidFull, motherNidFull) |
| Delete routes on AuditLog | **0** — permanent, immutable, forever |
| Delete routes on StockLedger | **0** — append-only, forever |
| Email notification types | 3 (credentials, status, password-change alert) |

### Components Status

| Component | Platform | Status |
|---|---|---|
| Backend API | Node.js + Express + MongoDB | ✅ Core complete |
| Admin Web Dashboard | React + TypeScript + Vite | ✅ All pages built |
| Distributor Web Dashboard | React + TypeScript + Vite | ✅ All pages built |
| Fraud Detection Service | Node.js Service | ✅ Complete |
| NID Encryption Service | Node.js + AES-256-GCM | ✅ Complete |
| Division+Ward Normalizer | Utility modules | ✅ Complete (Bangla + English) |
| Email Service | nodemailer | ✅ Complete |
| IoT Weight Scale Endpoints | Node.js | ✅ Backend ready |
| Field User Routes | Node.js | ✅ Complete |
| Cron Jobs | node-cron | ⏳ Planned |
| SMS Gateway | SmsOutbox queue ready | ⏳ Gateway not integrated |
| Field Distributor Mobile App | React Native / Flutter | 📋 Partner scope |

---

*Last updated: April 2026*
*Project: Smart OMS Ration Distribution System — Amar Ration*
*Team: Afifa + Shormi*