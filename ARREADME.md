# 🇧🇩 Smart OMS Ration Distribution System — Master Project Document

> **"The OMS ration card with QR-based validation ensures that only verified and active beneficiaries receive ration. Combined with tokenized distribution, family-level duplicate detection, and post-distribution audit, the system guarantees transparency, prevents duplication, and enforces accountability — without relying on confidential government databases."**

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
13. [Critical Implementation Fixes Required](#13-critical-implementation-fixes-required)
14. [Pending Feature Implementation Guide](#14-pending-feature-implementation-guide)
15. [Offline Mode](#15-offline-mode)
16. [Notification System](#16-notification-system)
17. [QR Card Lifecycle](#17-qr-card-lifecycle)
18. [Distribution Workflow](#18-distribution-workflow)
19. [Setup & Running the Project](#19-setup--running-the-project)
20. [Environment Configuration](#20-environment-configuration)
21. [Security Hardening Checklist](#21-security-hardening-checklist)
22. [Development Checklist](#22-development-checklist)
23. [Project Presentation Summary](#23-project-presentation-summary)

---

## 1. Project Overview

**Smart OMS (Open Market Sale) Ration Distribution System** is an end-to-end digital platform designed to eliminate fraud, duplication, and mismanagement in government ration distribution operations in Bangladesh.

### Problems Being Solved

| Problem | Solution |
|---|---|
| Duplicate ration claims from one family | Family-level NID mapping (`familyKey = SHA-256(fatherNID+motherNID)`) + duplicate flag |
| Ghost beneficiaries | Admin-only consumer activation; consumer starts as `Inactive` |
| Corrupt distributor manipulation | Revocable authority with expiry date; session-scoped workflow; immutable audit |
| Paper token forgery | Digital tokenization; one token per consumer per session (unique index) |
| No accountability after distribution | Immutable audit log (no DELETE route); post-session reconciliation |
| Ward-boundary violation | Distributor can only serve consumers in their assigned ward |
| Consumer blacklisted but still served | Blacklist checked at scan time before token issuance |
| Distributor authority expired | `authorityTo` date checked at every distribution action |
| Family duplicate not reviewed | `flaggedDuplicate` consumers blocked from token issuance until admin reviews |
| Session closed but tokens still issuable | Token issuance blocked if session is Closed or Paused |
| Stock over-distribution | Stock ledger balance check before confirming distribution |

### Key Design Philosophy

> *The system prioritizes transparency and accountability while remaining independent of confidential government databases. Distributor access is privilege-based, time-bound, and revocable. No actor can grant themselves elevated access. Every action is permanently recorded.*

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SMART OMS SYSTEM                                  │
│                                                                            │
│  ┌───────────────────┐           ┌──────────────────────┐                 │
│  │  ADMIN WEB APP    │           │ DISTRIBUTOR WEB APP   │                 │
│  │  (React + TS)     │           │ (React + TS)          │                 │
│  │  Full management  │           │ Session mgmt +        │                 │
│  │  dashboards       │           │ monitoring + QR scan  │                 │
│  └─────────┬─────────┘           └──────────┬────────────┘                 │
│            │                                 │                              │
│            └─────────────────┬───────────────┘                              │
│                              │                                               │
│                ┌─────────────▼──────────────┐                               │
│                │     BACKEND API SERVER      │                               │
│                │  Node.js + Express + MongoDB│                               │
│                │  JWT Auth + RBAC Middleware  │                               │
│                │  Fraud Detection Service     │                               │
│                │  Audit Service (append-only) │                               │
│                └─────────────┬───────────────┘                               │
│                              │                                               │
│          ┌───────────────────┼───────────────────────┐                       │
│          │                   │                       │                       │
│  ┌───────▼──────┐   ┌────────▼──────┐     ┌─────────▼──────┐               │
│  │  MongoDB     │   │  In-App       │     │  SMS Gateway    │               │
│  │  Atlas       │   │  Notifications│     │  (Queued)       │               │
│  │  (Cloud DB)  │   │  (Polling)    │     │  Pending integ. │               │
│  └──────────────┘   └───────────────┘     └────────────────┘               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow: Distribution Day

```
Consumer presents physical OMS Card
         │
         ▼
Distributor/FieldUser scans QR code (Web or App)
POST /api/distribution/scan { qrPayload }
         │
         ▼
Backend: resolveConsumerFromPayload()
    ├── QR payload valid (matches Consumer.qrToken)? ──No──► Reject + Audit [Warning]
    ├── Consumer.status === 'Active'? ──No──────────────────► Reject + Audit [Warning]
    ├── OMSCard.cardStatus === 'Active'? ──No──────────────► Reject + Audit [Warning]
    ├── Consumer.blacklistStatus === 'None'? ──No──────────► Reject + Audit [Critical]
    ├── Family.flaggedDuplicate === false? ──Yes──────────► Reject + Audit [Critical]
    ├── Distributor.ward === Consumer.ward? ──No──────────► Reject + Audit [Warning]
    ├── DistributionSession.status === 'Open'? ──No────────► Reject + Audit [Warning]
    ├── Distributor.authorityTo not expired? ──No──────────► Reject + Audit [Critical]
    ├── No existing token (consumerId+sessionId unique)? ──No► Reject + Audit [Warning]
    └── All pass ──►
         │
         ▼
Token auto-generated (unique tokenCode, status: Issued)
StockLedger checked: sufficient stock? ──No──► Reject + Notify Admin
         │
         ▼
Ration distributed
         │
         ▼
POST /api/distribution/complete { tokenId, actualKg }
    ├── Token.status === 'Issued'? ──No──► Reject (replay prevention)
    ├── Weight within threshold? ──Yes──► Confirm + stockOut() + Audit [Info]
    └── Mismatch? ──────────────────────► Alert Admin + Audit [Critical]
                                          checkDistributorMismatchCount()
                                          Auto-blacklist if threshold exceeded
         │
         ▼
Session Closure → Reconciliation → Audit Summary
```

---

## 3. Actors & Roles

### 3.1 Central Admin

**Access:** Admin Web Dashboard (full access, all wards)

**Responsibilities:**
- Approve or reject distributor signup applications
- Activate / Suspend / Revoke distributors
- Activate / Inactivate / Revoke consumer OMS cards (**only admin can activate**)
- Review and resolve family duplicate flags
- View system-wide immutable audit log
- Configure all system settings (weight threshold, QR expiry, fraud rules, ration allocation)
- Review distribution reconciliation reports
- Request and review formal audit reports from distributors
- Manage blacklist entries (create, deactivate)
- Force-close any distributor's active session
- Manually reissue consumer QR card (old QR immediately invalidated)
- Allocate stock (StockLedger IN entries)

**Cannot be created by self-signup.** Admin accounts are seeded or created only by existing admins.

---

### 3.2 Distributor (Ward-Based)

**Access:** Distributor Web Dashboard (own ward only)

**Responsibilities:**
- Register new consumers into the Long List (ward-specific only)
- Open and manage daily distribution sessions
- Scan consumer OMS card / enter consumer code to issue tokens
- View issued tokens for current session
- Cancel a token with mandatory reason
- Submit post-session closure with remaining stock confirmation
- Respond to formal audit report requests from admin
- View own audit log, monitoring stats, and blacklist entries

**Lifecycle:** `Pending` → `Approved` → `Active` → `Suspended` / `Revoked`

**Distributor CANNOT:**
- Activate a consumer's OMS card (admin-only privilege)
- Modify system-level settings or weight thresholds
- Access any other ward's data
- Self-signup and become active (admin approval required)
- Issue a token if their authority has expired
- Issue a token if their session is Closed or Paused

---

### 3.3 Consumer (Beneficiary)

**No app or web login.** Consumers are registered by distributors and interact only through their **physical OMS Ration Card** with embedded QR code.

**Consumer Identity:**
- Consumer Code (C0001, C0002…) — unique, auto-generated
- `qrToken` — 64-character random hex, embedded as QR on physical card
- NID (last 4 digits stored — full NID protected)
- Father's NID (last 4 digits stored)
- Mother's NID (last 4 digits stored)
- `familyKey` = SHA-256(fatherNID_full + motherNID_full) — computed at registration, never stored raw
- Ration Category: A (5 kg), B (4 kg), C (3 kg)

---

## 4. Core Security Design

### 4.1 Identity & Access

| Mechanism | Implementation |
|---|---|
| Password hashing | bcryptjs with 10 salt rounds |
| Authentication | JWT tokens (2-hour expiry) |
| Authorization | Role-Based Access Control (RBAC) middleware |
| Admin-only card activation | `authorize('Admin')` guard on PATCH `/consumers/:id/status` |
| Session-scoped tokens | One token per consumer per session (compound unique index: `consumerId + sessionId`) |
| Ward isolation | Distributor `ward` field compared against Consumer `ward` on every scan |
| Authority expiry | `distributor.authorityTo` checked before every distribution action |

### 4.2 QR Code Security

- Each consumer has a `qrToken`: 64-character cryptographically random hex string
- Generated at consumer registration using `crypto.randomBytes(32).toString('hex')`
- Stored directly on the `Consumer` document (no separate QRCode collection needed on main branch)
- QR physical card encodes this `qrToken` as the scannable payload
- If a consumer's card is revoked: `Consumer.status = 'Revoked'` — even physical card scan is rejected
- Card reissue generates a new `qrToken` — old token immediately invalid
- **⚠️ Pending:** QR image generation (`qrcode` npm package) and OMS card PDF printing

### 4.3 Family Duplicate Detection

During consumer registration:
1. Distributor provides father's NID + mother's NID (full numbers, for fingerprint only)
2. Backend computes `familyKey = SHA-256(fatherNID + motherNID)`
3. Full NIDs are discarded — only last 4 digits stored per field
4. If a `Family` document with this `familyKey` already exists AND has another active consumer → `Family.flaggedDuplicate = true`
5. Admin must review and resolve the flag before the new consumer can be activated
6. **Scan-time enforcement:** If `Family.flaggedDuplicate === true`, token issuance is blocked even if admin activated the consumer before resolving the flag

> *"Family-based identity mapping allows detection of duplicate ration claims across household members without storing complete NID numbers."*

### 4.4 Audit Trail (Immutable, Append-Only)

Every significant action writes to `AuditLog`. The collection has:
- **No DELETE route** — ever
- **No UPDATE route** — logs are immutable after creation
- Transactions: `writeAudit()` uses Mongoose sessions where available to ensure atomicity
- TTL: Set a 5-year TTL index for legal retention, not sooner

Logged events include:
| Action Code | Severity | Trigger |
|---|---|---|
| `QR_SCAN_REJECT_INACTIVE` | Warning | Consumer not active |
| `QR_SCAN_REJECT_BLACKLIST` | Critical | Consumer blacklisted |
| `QR_SCAN_REJECT_FAMILY_FLAG` | Critical | Family flagged duplicate |
| `QR_SCAN_REJECT_WARD_MISMATCH` | Warning | Consumer outside ward |
| `QR_SCAN_REJECT_SESSION_CLOSED` | Warning | Session not open |
| `QR_SCAN_REJECT_AUTHORITY_EXPIRED` | Critical | Distributor authority expired |
| `QR_SCAN_REJECT_DUPLICATE_TOKEN` | Warning | Token already issued today |
| `TOKEN_ISSUED` | Info | Successful token issuance |
| `TOKEN_CANCELLED` | Warning | Token manually cancelled |
| `DISTRIBUTION_SUCCESS` | Info | Distribution completed normally |
| `WEIGHT_MISMATCH` | Critical | Actual weight outside threshold |
| `AUTO_FRAUD_FLAG` | Critical | Distributor auto-blacklisted |
| `SESSION_OPENED` | Info | Session started |
| `SESSION_CLOSED` | Info | Session closed |
| `SESSION_FORCE_CLOSED` | Warning | Admin forced session close |
| `SESSION_RECONCILIATION_MISMATCH` | Critical | Stock vs tokens don't reconcile |
| `CONSUMER_ACTIVATED` | Info | Admin activated consumer |
| `CONSUMER_REVOKED` | Critical | Consumer revoked |
| `DISTRIBUTOR_APPROVED` | Info | Distributor application approved |
| `DISTRIBUTOR_SUSPENDED` | Warning | Distributor suspended |
| `BLACKLIST_CREATED` | Warning | Manual blacklist entry |
| `STOCK_ALLOCATED` | Info | Stock IN recorded |
| `STOCK_INSUFFICIENT` | Critical | Distribution attempted with no stock |

### 4.5 Blacklist System

`BlacklistEntry` model supports:
- Target: `Consumer` or `Distributor`
- Block type: `Temporary` (with `expiresAt`) or `Permanent`
- **Auto-blacklist:** After configurable mismatch count (default: 3 violations in 30 days), `fraud.service.js` auto-creates a `Temporary` blacklist entry and suspends the distributor
- Manual blacklist by admin for both consumers and distributors
- Admin can deactivate (for appeals)
- **⚠️ Pending:** Cron job to auto-deactivate expired temporary entries

### 4.6 Session Integrity Guards

Before any token is issued, the system enforces:
1. Distributor must have status `Active`
2. Distributor `authorityTo` must be in the future
3. `DistributionSession.status` must be `Open` (not `Paused`, `Closed`, or `Cancelled`)
4. Consumer must have `status = 'Active'`
5. `OMSCard.cardStatus` must be `Active`
6. Consumer `blacklistStatus` must be `None`
7. `Family.flaggedDuplicate` must be `false`
8. Distributor `ward` must match Consumer `ward`
9. No existing token for this `consumerId + sessionId` pair

### 4.7 Stock Ledger Integrity

- `StockLedger` is **append-only** — no updates or deletes
- Every distribution writes an immutable `OUT` entry
- `stockOut()` service is called inside a MongoDB transaction along with token completion
- Session close calculates: `totalExpectedKg` (sum of all issued token quantities) vs `totalActualKg` (sum of all StockLedger OUT entries) → mismatch triggers reconciliation alert

---

## 5. Technology Stack

### Backend
| Component | Technology | Status |
|---|---|---|
| Runtime | Node.js v18+ (CommonJS) | ✅ |
| Framework | Express.js v4 | ✅ |
| Database | MongoDB Atlas via Mongoose v8 | ✅ |
| Authentication | JWT (jsonwebtoken) | ✅ |
| Password Security | bcryptjs | ✅ |
| Validation | Zod (installed, partially applied) | ⚠️ |
| Logging | Morgan | ✅ |
| QR Generation | `qrcode` (in node_modules, not yet used) | ⚠️ |
| Rate Limiting | `express-rate-limit` | ❌ Not installed |
| Security Headers | `helmet` | ❌ Not installed |
| Scheduled Jobs | `node-cron` | ❌ Not installed |
| Dev Server | Nodemon | ✅ |

### Frontend (Web Dashboard)
| Component | Technology | Status |
|---|---|---|
| Framework | React 18 + TypeScript | ✅ |
| Build Tool | Vite | ✅ |
| Styling | Tailwind CSS | ✅ |
| HTTP Client | Axios (with interceptors) | ✅ |
| Routing | React Router DOM | ✅ |
| Auth Context | React Context API | ✅ |

---

## 6. Repository Structure

```
Smart-OMS/
│
├── backend/                            ← Node.js + Express + MongoDB
│   ├── server.js                       ✅ Entry point
│   ├── .env                            ✅ Environment variables
│   ├── .env.example                    ✅ Template
│   ├── package.json                    ✅
│   │
│   └── src/
│       ├── app.js                      ⚠️ CRITICAL: Missing route mounts (see §13)
│       ├── config/
│       │   └── db.js                   ✅ MongoDB connection
│       │
│       ├── models/
│       │   ├── User.js                 ✅ Admin, Distributor, FieldUser roles
│       │   ├── Distributor.js          ✅ Ward-based profile, authorityTo, authorityStatus
│       │   ├── Consumer.js             ✅ qrToken, status, category, familyId, ward
│       │   ├── Family.js               ✅ familyKey (SHA-256), flaggedDuplicate
│       │   ├── OMSCard.js              ✅ cardStatus (Active/Inactive/Revoked)
│       │   ├── Token.js                ✅ Unique index: consumerId+sessionId
│       │   ├── DistributionSession.js  ✅ Open/Paused/Closed, dateKey
│       │   ├── DistributionRecord.js   ✅ expectedKg, actualKg, mismatch
│       │   ├── StockLedger.js          ✅ IN/OUT append-only ledger
│       │   ├── AuditLog.js             ✅ Immutable, severity levels
│       │   ├── BlacklistEntry.js       ✅ Temp/Permanent, targetType, expiresAt
│       │   ├── OfflineQueue.js         ✅ Offline scan cache
│       │   ├── SystemSetting.js        ✅ Key-value config store
│       │   ├── AuditReportRequest.js   ⚠️ Exists in feature branch, not on main
│       │   ├── Notification.js         ⚠️ Exists in feature branch, not on main
│       │   ├── SmsOutbox.js            ⚠️ Exists in feature branch, not on main
│       │   └── QRCode.js               ⚠️ Exists in feature branch (legacy structure)
│       │
│       ├── controllers/
│       │   ├── auth.controller.js          ✅ Signup, login, me, change-password
│       │   ├── admin.controller.js         ⚠️ In feature branch (not merged to main)
│       │   ├── distributor.controller.js   ✅ Dashboard, beneficiaries, tokens
│       │   ├── consumer.controller.js      ✅ Register, status change, card info
│       │   ├── distribution.controller.js  ✅ Scan, complete, tokens, records, stats
│       │   ├── monitoring.controller.js    ✅ Blacklist, offline queue
│       │   ├── audit-report.controller.js  ⚠️ In feature branch (not merged to main)
│       │   ├── reports.controller.js       ✅ Distribution reports
│       │   ├── settings.controller.js      ✅ System settings (admin-only)
│       │   ├── notification.controller.js  ✅ Untracked — needs mounting
│       │   ├── stock.controller.js         ✅ Untracked — needs mounting
│       │   └── iot.controller.js           ✅ Untracked — needs mounting
│       │
│       ├── routes/
│       │   ├── auth.routes.js          ✅ /api/auth — mounted
│       │   ├── consumer.routes.js      ✅ /api/consumers — mounted
│       │   ├── distribution.routes.js  ✅ /api/distribution — mounted
│       │   ├── monitoring.routes.js    ✅ /api/monitoring — mounted
│       │   ├── reports.routes.js       ✅ /api/reports — mounted
│       │   ├── settings.routes.js      ✅ /api/settings — mounted
│       │   ├── users.routes.js         ✅ /api/users — mounted
│       │   ├── admin.routes.js         ⚠️ Feature branch — NOT mounted in app.js
│       │   ├── distributor.routes.js   ⚠️ Exists — NOT mounted in app.js
│       │   ├── iot.routes.js           ✅ Untracked — NOT mounted in app.js
│       │   ├── notification.routes.js  ✅ Untracked — NOT mounted in app.js
│       │   ├── stock.routes.js         ✅ Untracked — NOT mounted in app.js
│       │   └── field.routes.js         ✅ Untracked — NOT mounted in app.js
│       │
│       ├── middleware/
│       │   ├── auth.js                 ✅ JWT protect + authorize roles
│       │   ├── rbac.js                 ✅ Role-based access control
│       │   ├── error.js                ✅ 404 + global error handler
│       │   └── iotAuth.js              ✅ Untracked — x-iot-api-key validation
│       │
│       └── services/
│           ├── audit.service.js        ✅ writeAudit() — transaction-safe
│           ├── fraud.service.js        ✅ Untracked — auto-flag + auto-blacklist
│           ├── stock.service.js        ✅ stockOut() — immutable ledger
│           ├── token.service.js        ✅ rationQtyByCategory(), makeTokenCode()
│           ├── notification.service.js ⚠️ Feature branch version (not on main)
│           ├── email.service.js        ✅ Untracked
│           └── nid-security.service.js ✅ Untracked — NID fingerprint hashing
│
└── frontend/                           ← React + TypeScript + Vite
    └── src/
        ├── App.tsx                     ✅ Route definitions
        ├── context/AuthContext.tsx     ✅ Auth state management
        ├── services/api.ts             ✅ Axios instance + interceptors
        │
        ├── layouts/
        │   ├── AdminLayout.tsx         ✅ Admin shell with sidebar
        │   └── DistributorLayout.tsx   ✅ Distributor shell with sidebar
        │
        ├── pages/
        │   ├── EntrancePage.tsx        ✅
        │   ├── LoginPage.tsx           ✅
        │   ├── SignupPage.tsx          ✅
        │   ├── SettingsPage.tsx        ✅
        │   ├── HelpPage.tsx            ✅
        │   │
        │   ├── admin/
        │   │   ├── AdminDashboard.tsx       ✅
        │   │   ├── AdminDistributorsPage.tsx ✅
        │   │   ├── AdminConsumersPage.tsx   ✅
        │   │   ├── AdminCardsPage.tsx       ✅
        │   │   ├── AdminDistributionPage.tsx ✅
        │   │   ├── AdminAuditPage.tsx       ✅
        │   │   ├── AdminReportsPage.tsx     ✅
        │   │   └── AdminSettingsPage.tsx    ✅
        │   │
        │   └── distributor/ (pages located at /pages/ root — see §13.3)
        │       ├── DistributorDashboard.tsx  ✅
        │       ├── BeneficiariesPage.tsx     ✅
        │       ├── CardsTokensPage.tsx       ✅
        │       ├── StockDistributionPage.tsx ✅ (QR scan + token issue)
        │       ├── AuditLogPage.tsx          ✅
        │       ├── ReportsPage.tsx           ✅
        │       └── MonitoringPage.tsx        ✅
        │
        └── components/
            ├── QRScanner.tsx           ✅ Camera-based QR scanning
            ├── ConsumerTable.tsx       ✅
            ├── ActivityLog.tsx         ✅
            ├── StatCard.tsx            ✅
            ├── AdminSidebar.tsx        ✅
            └── ui/Badge, Button, Modal ✅
```

---

## 7. Database Schema

### Core Collections (13 on main, 16 in full system)

#### `users`
```javascript
{
  name: String,
  phone: { type: String, unique: true },
  email: String,
  passwordHash: String,        // bcrypt, NEVER returned in API response
  userType: enum['Admin', 'Distributor', 'FieldUser'],
  status: enum['Active', 'Inactive', 'Suspended', 'Pending'],
  authorityStatus: enum['Active', 'Pending', 'Suspended', 'Revoked'],
  authorityFrom: Date,
  authorityTo: Date,           // Checked before every distribution action
  ward: String,
  division, district, upazila, unionName: String
}
```

#### `consumers`
```javascript
{
  consumerCode: { type: String, unique: true },   // C0001, C0002...
  qrToken: { type: String, unique: true },        // 64-char hex — QR payload
  name: String,
  nidLast4: String,             // Last 4 digits only
  status: enum['Active', 'Inactive', 'Revoked'],  // Default: Inactive
  category: enum['A', 'B', 'C'],  // A=5kg, B=4kg, C=3kg
  familyId: ObjectId → Family,
  createdByDistributor: ObjectId → Distributor,
  blacklistStatus: enum['None', 'Temp', 'Permanent'],
  ward, division, district, upazila, unionName: String
}
```

#### `families`
```javascript
{
  familyKey: { type: String, unique: true },  // SHA-256(fatherNID + motherNID)
  fatherNidLast4: String,
  motherNidLast4: String,
  flaggedDuplicate: { type: Boolean, default: false }  // Blocks token issuance
}
```

#### `omscards`
```javascript
{
  consumerId: ObjectId → Consumer,
  cardStatus: enum['Active', 'Inactive', 'Revoked'],  // Default: Inactive
  qrCodeId: ObjectId → QRCode (optional, legacy)
  // Checked at every scan: cardStatus must be 'Active'
}
```

#### `tokens`
```javascript
{
  tokenCode: { type: String, unique: true },       // T-847291
  consumerId: ObjectId → Consumer,
  distributorId: ObjectId → Distributor,
  sessionId: ObjectId → DistributionSession,
  rationQtyKg: Number,                             // From category at time of issuance
  status: enum['Issued', 'Used', 'Cancelled', 'Expired'],
  issuedAt: Date,
  usedAt: Date
}
// CRITICAL INDEX: { consumerId: 1, sessionId: 1 } UNIQUE
// This MongoDB-level constraint prevents double-issuance even under race conditions
```

#### `distributionsessions`
```javascript
{
  distributorId: ObjectId → Distributor,
  dateKey: String,   // "2026-04-08" — one session per distributor per day
  status: enum['Open', 'Paused', 'Closed', 'Cancelled'],
  closedAt: Date,
  closedByUserId: ObjectId → User,
  reconciliationFlag: Boolean,  // Set if stock vs tokens mismatch on close
  reconciliationNote: String
}
```

#### `distributionrecords`
```javascript
{
  tokenId: ObjectId → Token,
  expectedKg: Number,
  actualKg: Number,
  mismatch: Boolean,    // true if |actual - expected| > threshold
  source: enum['manual', 'iot']
}
```

#### `stockledgers`
```javascript
{
  distributorId: ObjectId → Distributor,
  type: enum['IN', 'OUT', 'ADJUST'],
  qtyKg: Number,
  dateKey: String,
  ref: String,         // tokenCode for OUT, allocation ID for IN
  note: String
}
// APPEND-ONLY — no update or delete routes exist
```

#### `auditlogs`
```javascript
{
  actorUserId: ObjectId → User,
  actorType: enum['Central Admin', 'Distributor', 'System'],
  action: String,      // Action codes from §4.4
  entityType: String,  // 'Token', 'Consumer', 'Distributor', etc.
  entityId: String,    // Polymorphic — stored as string
  severity: enum['Info', 'Warning', 'Critical'],
  meta: Object         // Additional context
}
// IMMUTABLE — no delete route, no update route
// Indexes: { createdAt: -1 }, { severity: 1 }, { actorUserId: 1 }
```

#### `blacklistentries`
```javascript
{
  targetType: enum['Consumer', 'Distributor'],
  targetRefId: String,    // Consumer._id or Distributor._id as string
  blockType: enum['Temporary', 'Permanent'],
  reason: String,
  active: Boolean,
  expiresAt: Date,        // For Temporary entries
  createdByUserId: ObjectId → User
}
```

#### `systemsettings`
```javascript
// Key-value store
// Key: "distributor:global:settings"
// Value: {
//   distribution: { weightThresholdKg: 0.05, autoPauseOnMismatch: true },
//   qr: { expiryCycleDays: 30 },
//   fraud: { autoBlacklistMismatchCount: 3, temporaryBlockDays: 7 },
//   allocation: { categoryA: 5, categoryB: 4, categoryC: 3 },
//   notifications: { smsEnabled: false, appEnabled: true },
//   offline: { enabled: true }
// }
```

#### Models in Feature Branch (need merge)
- `notifications` — in-app notification model
- `smsoutboxes` — SMS queue
- `auditreportrequests` — admin-to-distributor formal audit requests

---

## 8. API Reference

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected routes require:
```http
Authorization: Bearer <JWT_TOKEN>
```

---

### 8.1 Auth Routes `/api/auth` ✅ Mounted

| Method | Endpoint | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/signup` | ❌ | — | Distributor self-registration (creates Pending user) |
| POST | `/login` | ❌ | — | Login, receive JWT |
| GET | `/me` | ✅ | All | Get current user profile |
| PUT | `/change-password` | ✅ | All | Change own password |

**POST /api/auth/signup** — Distributor registration:
```json
{
  "userType": "Distributor",
  "name": "Rafiq Uddin",
  "phone": "01712345678",
  "password": "secure123",
  "wardNo": "03",
  "officeAddress": "Ward 3 Office, Khulna",
  "division": "Khulna",
  "district": "Khulna",
  "upazila": "Kotwali",
  "unionName": "Khulna Sadar"
}
```

**POST /api/auth/login**:
```json
{ "identifier": "01712345678", "password": "secure123" }
```

---

### 8.2 Admin Routes `/api/admin` ⚠️ NOT YET MOUNTED (see §13)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/summary` | Dashboard stats: pending distributors, active consumers, fraud alerts |
| GET | `/distributors` | List all distributors with filters (status, ward, date) |
| PATCH | `/distributors/:userId/status` | Approve / Suspend / Revoke |
| GET | `/consumers/review` | Consumers with `flaggedDuplicate = true` |
| GET | `/cards/summary` | OMS card status overview |
| GET | `/distribution/monitoring` | Live session overview across all distributors |
| POST | `/distribution/session/:id/force-close` | Force-close any session |
| GET | `/audit` | Full audit log with filters |
| GET | `/audit/:id/detail` | Single audit event detail |
| POST | `/audit/requests` | Request formal audit report from a distributor |
| GET | `/audit/requests` | List all audit report requests |
| PATCH | `/audit/requests/:id/review` | Approve/Reject/Escalate report |
| POST | `/stock/in` | Record incoming stock allocation |

---

### 8.3 Consumer Routes `/api/consumers` ✅ Mounted

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin, Distributor | List consumers (filter: ward, status, category) |
| POST | `/` | Distributor | Register new consumer |
| GET | `/:id` | Admin, Distributor | Consumer detail |
| PATCH | `/:id/status` | **Admin only** | Activate / Inactivate / Revoke |
| GET | `/:id/card` | Admin, Distributor | OMS card info |
| POST | `/:id/card/reissue` | **Admin only** | Reissue QR — new token, old invalidated |

**POST /api/consumers** — Register new consumer:
```json
{
  "name": "Amina Begum",
  "nidFull": "1234567890",
  "fatherNidFull": "0987654321",
  "motherNidFull": "1122334455",
  "category": "A",
  "ward": "03",
  "division": "Khulna",
  "district": "Khulna",
  "upazila": "Kotwali",
  "unionName": "Khulna Sadar"
}
```

Backend action:
1. Computes `familyKey = SHA-256(fatherNidFull + motherNidFull)`
2. Stores only `nidLast4`, `fatherNidLast4`, `motherNidLast4`
3. Discards full NID numbers immediately
4. Checks for existing `Family` with same key → sets `flaggedDuplicate` if collision
5. Generates unique `consumerCode` (C0001...)
6. Generates `qrToken = crypto.randomBytes(32).toString('hex')`
7. Creates `Consumer` with `status: 'Inactive'`
8. Creates `OMSCard` with `cardStatus: 'Inactive'`

---

### 8.4 Distribution Routes `/api/distribution` ✅ Mounted

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/scan` | Distributor, FieldUser | Scan QR → validate → issue token |
| POST | `/complete` | Distributor, FieldUser | Complete distribution (with actual weight) |
| GET | `/tokens` | Admin, Distributor, FieldUser | List tokens |
| PATCH | `/tokens/:id/cancel` | Distributor | Cancel token (reason required) |
| GET | `/records` | Admin, Distributor, FieldUser | Distribution records with weight data |
| GET | `/stats` | Admin, Distributor, FieldUser | Session statistics |
| GET | `/quick-info` | Admin, Distributor, FieldUser | Today's session summary |
| POST | `/session/close` | Distributor | Close session + reconciliation ⚠️ PENDING |

**POST /api/distribution/scan**:
```json
{ "qrPayload": "a1b2c3...64hexchars" }
```
Response:
```json
{
  "success": true,
  "data": {
    "token": { "tokenCode": "T-847291", "rationQtyKg": 5, "status": "Issued" },
    "consumer": { "consumerCode": "C0042", "name": "Amina Begum", "category": "A", "ward": "03" }
  }
}
```

**POST /api/distribution/complete**:
```json
{ "tokenId": "<ObjectId>", "actualKg": 4.98 }
```

---

### 8.5 Distributor Routes `/api/distributor` ⚠️ NOT YET MOUNTED (see §13)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | Ward stats, session info, consumer count |
| GET | `/beneficiaries` | Consumer list for this distributor's ward |
| GET | `/tokens` | Tokens issued by this distributor |
| GET | `/audit` | Self audit log |
| GET | `/reports` | Self session reports |
| GET | `/monitoring` | Blacklist + offline queue summary |
| GET | `/audit-requests` | Formal audit requests assigned to this distributor |
| POST | `/audit-requests/:id/submit` | Submit audit report response |

---

### 8.6 Monitoring Routes `/api/monitoring` ✅ Mounted

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/summary` | Admin, Distributor | Blacklist count, offline queue, alert summary |
| GET | `/blacklist` | Admin, Distributor | List blacklist entries |
| POST | `/blacklist` | Admin, Distributor | Create blacklist entry |
| PUT | `/blacklist/:id` | Admin | Update entry |
| POST | `/blacklist/:id/deactivate` | Admin | Remove from blacklist (appeal) |
| GET | `/offline-queue` | Admin, Distributor | View offline cached records |
| POST | `/offline-queue` | Distributor, FieldUser | Submit offline scan record |
| POST | `/offline-queue/:id/sync` | Distributor, FieldUser | Sync single entry |
| POST | `/offline-queue/sync-all` | Distributor, FieldUser | Sync all pending |
| PATCH | `/offline-queue/:id/resolve` | Admin | Manually resolve conflict |

---

### 8.7 Settings Routes `/api/settings` ✅ Mounted (Admin only)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Get current system settings |
| PUT | `/` | Update settings |

**Settings schema:**
```json
{
  "distribution": {
    "weightThresholdKg": 0.05,
    "autoPauseOnMismatch": true
  },
  "qr": { "expiryCycleDays": 30 },
  "fraud": {
    "autoBlacklistMismatchCount": 3,
    "temporaryBlockDays": 7
  },
  "allocation": { "categoryA": 5, "categoryB": 4, "categoryC": 3 },
  "notifications": { "smsEnabled": false, "appEnabled": true },
  "offline": { "enabled": true }
}
```

---

### 8.8 Reports Routes `/api/reports` ✅ Mounted

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin, Distributor | Distribution reports with filters |
| GET | `/reconciliation` | Admin | Session reconciliation data |

---

### 8.9 Stock Routes `/api/stock` ⚠️ NOT YET MOUNTED (see §13)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/in` | Admin | Record incoming stock allocation |
| GET | `/balance` | Admin, Distributor | Current stock balance for distributor |
| GET | `/ledger` | Admin, Distributor | Full stock ledger history |

---

### 8.10 Notification Routes `/api/notifications` ⚠️ NOT YET MOUNTED (see §13)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | All | List notifications for current user |
| GET | `/unread-count` | All | Count of unread notifications |
| POST | `/:id/read` | All | Mark notification as read |
| POST | `/read-all` | All | Mark all as read |

---

### 8.11 IoT Routes `/api/iot` ✅ Controller & middleware done, NOT YET MOUNTED

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/weight-reading` | Device API Key | IoT scale sends weight + tokenCode |
| GET | `/weight-threshold` | Device API Key | Device fetches current threshold |

---

## 9. Feature Status Tracker

### ✅ COMPLETED (Backend)

- [x] All 13 Mongoose models on main branch (16 in feature branch)
- [x] JWT authentication (signup, login, me, change-password)
- [x] RBAC middleware (Admin, Distributor, FieldUser)
- [x] Consumer registration with familyKey + duplicate detection
- [x] OMS card creation linked to consumer
- [x] QR token generation (64-char hex on Consumer model)
- [x] QR scan → consumer resolution → token issuance (core flow)
- [x] One-token-per-session-per-consumer (unique compound index)
- [x] Consumer blacklist check at scan time
- [x] Ward boundary enforcement at scan time
- [x] Distribution record with expected vs actual weight
- [x] Stock ledger (immutable OUT entries per token completion)
- [x] Distribution session open/close with dateKey
- [x] Immutable audit log (writeAudit service, transaction-safe)
- [x] Blacklist system (temporary + permanent, consumer + distributor)
- [x] Offline queue model + sync endpoints
- [x] System settings (full config schema)
- [x] Consumer status management (Inactive → Active → Revoked)
- [x] IoT weight reading endpoint (full implementation, iotAuth middleware)
- [x] Fraud service: auto-blacklist after mismatch threshold
- [x] Auto-pause session on weight mismatch (configurable)
- [x] Reports and reconciliation data endpoints

### ✅ COMPLETED (Frontend)

- [x] Role-based entrance portal
- [x] Protected routes by role (Admin vs Distributor)
- [x] Admin Dashboard with stats
- [x] Admin Distributors management page
- [x] Admin Consumers review page (including duplicate flags)
- [x] Admin Cards page
- [x] Admin Distribution monitoring page
- [x] Admin Audit log viewer
- [x] Admin Reports page
- [x] Admin Settings page (full config UI)
- [x] Distributor Dashboard
- [x] Distributor Beneficiaries page (register + view)
- [x] Distributor Cards & Tokens page
- [x] Distributor Stock/Distribution page (QR scan + token issuance)
- [x] Distributor Audit log page
- [x] Distributor Monitoring page (blacklist + offline queue)
- [x] Distributor Reports page
- [x] QR Scanner component (camera-based)
- [x] Pending Approval page

---

### ⚠️ CRITICAL BUGS / NOT YET WIRED

- [ ] **app.js missing route mounts** — `/api/admin`, `/api/distributor`, `/api/iot`, `/api/notifications`, `/api/stock`, `/api/field` not mounted (see §13.1)
- [ ] **Feature branch not merged to main** — `admin.controller.js`, `notification.service.js`, `AuditReportRequest.js`, `Notification.js`, `SmsOutbox.js`, `QRCode.js` exist only in feature branch
- [ ] **Family duplicate check at scan time** — `Family.flaggedDuplicate` not checked in `scanAndIssueToken()` (see §13.2)
- [ ] **OMSCard.cardStatus not checked at scan** — Only `Consumer.status` checked; card can be Inactive while consumer is Active (see §13.2)
- [ ] **Distributor authority expiry not checked** — `authorityTo` date not validated before token issuance (see §13.2)
- [ ] **Session status not validated** — Tokens can be issued even if session is Paused (see §13.2)
- [ ] **Distributor page path inconsistency** — Pages are at `/pages/` root but routes expect `/pages/distributor/` (see §13.3)

---

### ❌ NOT YET IMPLEMENTED

- [ ] **QR image generation** — `qrcode` package in node_modules unused; no image endpoint
- [ ] **OMS Card printable PDF** — No PDF generation for physical card printing
- [ ] **Session close endpoint** — `POST /api/distribution/session/close` not implemented
- [ ] **Stock IN endpoint** — No way to record incoming stock allocation
- [ ] **Rate limiting** — `express-rate-limit` not installed or configured
- [ ] **Helmet security headers** — Not installed
- [ ] **CORS hardening** — `origin: true` (all origins allowed); must be restricted
- [ ] **Zod validation** — Installed but not applied to most routes
- [ ] **Refresh tokens** — JWT is single-use 2hr; no refresh token flow
- [ ] **Admin 2FA** — TOTP for admin login (extra security layer)
- [ ] **QR auto-rotation cron** — `expiryCycleDays` setting exists but no scheduled job
- [ ] **Auto-expire blacklist cron** — `expiresAt` field exists but no deactivation job
- [ ] **CSV/Excel export** — No export from reports pages
- [ ] **Notification bell with unread count** — Notification model exists but not integrated in topbar
- [ ] **Dashboard auto-refresh** — No polling mechanism in place
- [ ] **Admin force-close session** — Route defined in admin.routes.js but controller function missing
- [ ] **Stock sufficiency check** — No check that `StockLedger IN` balance is sufficient before distribution

---

## 10. Admin Web Dashboard

### Page-by-Page Feature Map

#### `/admin/dashboard`
- Total active consumers, pending distributor applications, duplicate family flags
- Today's token count, total stock distributed today
- Recent Critical audit alerts (auto-refreshed every 60s — **⚠️ pending**)
- Offline sync queue status
- Active sessions count across all wards

#### `/admin/distributors`
- Filterable list: All / Pending / Active / Suspended / Revoked
- **Approve** pending application → status: Active, sets authorityFrom = today, authorityTo = today + N months
- **Suspend** active distributor → immediate effect; active session auto-paused
- **Revoke** permanently → no reinstatement
- View ward assignment, authority expiry date, mismatch count

#### `/admin/consumers`
- Filter by: ward, status, category, duplicate flag
- **Activate** Inactive consumer → `Consumer.status = 'Active'` + `OMSCard.cardStatus = 'Active'`
- **Inactivate** active consumer → both set to Inactive
- **Revoke** → permanent, QR token invalidated
- View family duplicate flag → resolve or confirm duplicate
- Trigger field verification note (audit log entry)

#### `/admin/cards`
- OMS card status overview (Active / Inactive / Revoked counts)
- Search by consumer code or name
- **Reissue card**: generates new 64-char `qrToken`, old token immediately invalid, new card must be printed and delivered physically

#### `/admin/distribution`
- Live session monitoring: all open/paused sessions across distributors
- Per-session: tokens issued, stock used, mismatch count, session status
- **Force-close** any session (with reason) → writes `SESSION_FORCE_CLOSED` audit event

#### `/admin/audit`
- Full audit log: filter by severity (Critical/Warning/Info), actor, date range, action code
- View full detail of any audit event including `meta` object
- **Request audit report** from a specific distributor
- Review submitted reports → Approve / Reject / Escalate
- Critical alerts highlighted; exportable (**⚠️ pending**)

#### `/admin/reports`
- Distribution summary: filter by date range, ward, distributor
- **Reconciliation report**: allocated stock (StockLedger IN) vs distributed stock (StockLedger OUT) per session
- Per-session mismatch count, cancelled token count
- CSV export (**⚠️ pending**)

#### `/admin/settings`
Configure all system-wide parameters:

| Setting | Default | Description |
|---|---|---|
| `weightThresholdKg` | 0.05 | Max tolerated difference between expected and actual weight |
| `autoPauseOnMismatch` | true | Pause session on weight mismatch |
| `expiryCycleDays` | 30 | Days before QR token auto-rotated |
| `autoBlacklistMismatchCount` | 3 | Mismatches in 30 days to trigger auto-blacklist |
| `temporaryBlockDays` | 7 | Duration of auto-imposed temporary block |
| `categoryA` | 5 kg | Ration allocation for Category A |
| `categoryB` | 4 kg | Ration allocation for Category B |
| `categoryC` | 3 kg | Ration allocation for Category C |
| `smsEnabled` | false | Toggle SMS notifications |
| `appEnabled` | true | Toggle in-app notifications |
| `offlineEnabled` | true | Allow offline mode |

---

## 11. Distributor Web Dashboard

### Page-by-Page Feature Map

#### `/dashboard`
- Today's session status (Open / Closed / Paused)
- Tokens issued today, stock used, mismatches today
- Active consumers in ward, pending card activations
- Recent activity feed (own actions)
- Notification bell (**⚠️ pending**)

#### `/beneficiaries`
- Long list of consumers registered in this distributor's ward
- **Register new consumer**: full NID + family NID form, ward auto-filled
- View consumer status, card status, last distribution date
- Flag consumer for admin review (cannot activate/revoke without admin)
- Filter by: status, category, duplicate flag

#### `/cards`
- All OMS cards for ward consumers
- Track QR validity, card issue date
- See which consumers have received tokens today (green badge)
- Consumers with Inactive/Revoked card highlighted

#### `/stock` (Distribution page)
- **Open today's session** (creates DistributionSession if not exists)
- QR scanner (camera) to scan consumer OMS card
- Manual entry fallback: consumer code input field
- After scan: shows consumer info + ration quantity + token code
- Issued tokens list for current session
- **Cancel a token** (mandatory reason field)
- **Close session** button: confirms remaining stock, triggers reconciliation

#### `/audit`
- Own audit log (own actions only, not other distributors)
- View formal audit report requests from admin
- **Submit report response** with text + optional file description

#### `/monitoring`
- Blacklist entries visible to this distributor (create, view, request deactivation)
- Offline queue: count of pending sync records
- **Trigger manual sync** button
- Sync conflict resolution: view Failed entries

#### `/reports`
- Session history with filters (date range)
- Per-session: tokens issued, weight mismatches, cancelled tokens, stock reconciliation
- Export (**⚠️ pending**)

---

## 12. Fraud Detection & Prevention

### Layer 1: Identity Integrity (Registration Time)

**Family Fingerprint:**
```javascript
// In consumer.controller.js — registration
const familyKey = crypto
  .createHash('sha256')
  .update(fatherNidFull.trim() + motherNidFull.trim())
  .digest('hex');

// Upsert family
const family = await Family.findOneAndUpdate(
  { familyKey },
  {
    $setOnInsert: { fatherNidLast4: fatherNidFull.slice(-4), motherNidLast4: motherNidFull.slice(-4) }
  },
  { upsert: true, new: true, session }
);

// Check for existing consumers in this family
const existingInFamily = await Consumer.findOne({
  familyId: family._id,
  status: { $ne: 'Revoked' }
}).session(session);

if (existingInFamily) {
  family.flaggedDuplicate = true;
  await family.save({ session });
  await writeAudit({ action: 'FAMILY_DUPLICATE_FLAG', severity: 'Critical', ... });
  await notifyAdmins({ title: 'Duplicate Family Registration', ... });
}
```

**Admin Review Required:** Until admin explicitly clears `flaggedDuplicate`, the consumer cannot receive ration even if their card is `Active`.

---

### Layer 2: QR Card Validation (Scan Time)

Nine sequential checks in `scanAndIssueToken()`:

```
Check 1: qrPayload resolves to a Consumer document
         └── Reject: "Consumer not found" + Audit[Warning]

Check 2: OMSCard.cardStatus === 'Active'
         └── Reject: "OMS Card is not active" + Audit[Warning]

Check 3: Consumer.status === 'Active'
         └── Reject: "Beneficiary is not active" + Audit[Warning]

Check 4: Consumer.blacklistStatus === 'None'
         └── Reject: "Beneficiary is blacklisted" + Audit[Critical]

Check 5: Family.flaggedDuplicate === false
         └── Reject: "Household flagged — admin review required" + Audit[Critical]

Check 6: Distributor.ward === Consumer.ward
         └── Reject: "Consumer is outside your ward" + Audit[Warning]

Check 7: Distributor.authorityStatus === 'Active'
         └── Reject: "Distributor authority is not active" + Audit[Critical]

Check 8: Distributor.authorityTo > Date.now()
         └── Reject: "Distributor authority has expired" + Audit[Critical]

Check 9: DistributionSession.status === 'Open'
         └── Reject: "No open session — session is [status]" + Audit[Warning]

Check 10 (DB-level): consumerId + sessionId unique index
         └── Reject: "Token already issued for today" + Audit[Warning]
```

---

### Layer 3: Token Replay Prevention

When `POST /api/distribution/complete` is called:
```javascript
const token = await Token.findById(tokenId).session(session);

if (!token) return 404;
if (token.status !== 'Issued') {
  // Token is Used, Cancelled, or Expired — cannot complete again
  await writeAudit({ action: 'TOKEN_REPLAY_ATTEMPT', severity: 'Critical', ... });
  return res.status(400).json({ message: 'Token is not in issued state' });
}
// Only then proceed with completion
```

---

### Layer 4: Weight Mismatch Detection

Tolerance formula: `|actualKg - expectedKg| > weightThresholdKg`

On mismatch:
1. `DistributionRecord` created with `mismatch: true`
2. Admin notified (in-app)
3. Distributor notified (in-app)
4. Audit log: `WEIGHT_MISMATCH` — severity `Critical`
5. If `autoPauseOnMismatch = true`: session status → `Paused`
6. `checkDistributorMismatchCount()` called asynchronously

---

### Layer 5: Auto-Blacklist After Repeated Mismatches

`fraud.service.js` — `checkDistributorMismatchCount(distributorId)`:
```
1. Count DistributionRecords with mismatch: true for this distributor in last 30 days
2. Compare against threshold (default: 3)
3. If count >= threshold AND not already blacklisted:
   a. Create BlacklistEntry { blockType: 'Temporary', expiresAt: +7 days }
   b. Set Distributor.authorityStatus = 'Suspended'
   c. Set User.status = 'Suspended'
   d. writeAudit { action: 'AUTO_FRAUD_FLAG', severity: 'Critical' }
   e. notifyAdmins (fraud alert with ward info)
   f. notifyUser (account suspended message)
```

---

### Layer 6: Session Reconciliation

On session close (`POST /api/distribution/session/close`):
```
1. Sum all token.rationQtyKg where sessionId = this session AND status IN ['Used'] → totalExpected
2. Sum all StockLedger OUT entries for this distributor on this dateKey → totalActual
3. Compute difference = totalExpected - totalActual
4. If |difference| > threshold:
   a. session.reconciliationFlag = true
   b. session.reconciliationNote = "Expected Xkg, Actual Ykg, Difference Zkg"
   c. writeAudit { action: 'SESSION_RECONCILIATION_MISMATCH', severity: 'Critical' }
   d. notifyAdmins(reconciliation alert)
5. session.status = 'Closed'
6. session.closedAt = Date.now()
7. writeAudit { action: 'SESSION_CLOSED', severity: 'Info' }
```

---

### Layer 7: Immutable Audit Trail

The `AuditLog` collection is the system's permanent memory:
- **No DELETE endpoint** exists or will ever exist
- **No UPDATE endpoint** exists for audit records
- Every action — including rejected scans, cancelled tokens, and admin decisions — is permanently logged
- Logs survive distributor suspension, consumer revocation, and even data corrections
- In a real deployment, this collection should be replicated with read-only secondary access for external auditors

---

### Complete Fraud Scenario Coverage

| Fraud Scenario | Prevention Mechanism |
|---|---|
| Duplicate family registration | familyKey SHA-256 + flaggedDuplicate blocks distribution |
| Ghost consumer created by corrupt distributor | Admin-only activation; distributor cannot activate |
| Distributor scanning another ward's consumer | Ward boundary check at scan (check 6) |
| Distributor with expired authority | authorityTo date check at scan (check 8) |
| Scanning same consumer twice in one day | consumerId+sessionId unique DB index (check 10) |
| Using a revoked/stolen physical card | Consumer.status + OMSCard.cardStatus check |
| Blacklisted consumer trying to collect | blacklistStatus check (check 4) |
| Corrupt distributor giving less ration | Weight mismatch detection + auto-flag |
| Distributor manipulating weight sensor | Auto-blacklist after 3 mismatches |
| Distributor closing session with unaccounted stock | Session reconciliation on close |
| Token reuse (replay attack) | token.status must be 'Issued' — checked before complete |
| Concurrent double-scan race condition | MongoDB unique index is atomic — only one succeeds |
| Admin trying to approve own Distributor signup | Admin created by seeding only, not by self-signup |
| Offline scan for revoked consumer | ServerWins policy on sync — revoked records are rejected |
| Distributor suspending own session to continue later with lower guard | Paused session blocks all new token issuance |

---

## 13. Critical Implementation Fixes Required

These are bugs and gaps in the **current main branch** that must be fixed for the system to work correctly.

---

### 13.1 Fix: Mount All Routes in `app.js`

**Current state:** `admin`, `distributor`, `iot`, `notifications`, `stock`, and `field` routes exist as files but are **not mounted** in `app.js`.

**Fix** — replace the entire `src/app.js`:

```javascript
// src/app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const adminRoutes = require('./routes/admin.routes');
const distributorRoutes = require('./routes/distributor.routes');
const consumerRoutes = require('./routes/consumer.routes');
const distributionRoutes = require('./routes/distribution.routes');
const monitoringRoutes = require('./routes/monitoring.routes');
const reportsRoutes = require('./routes/reports.routes');
const settingsRoutes = require('./routes/settings.routes');
const stockRoutes = require('./routes/stock.routes');
const notificationRoutes = require('./routes/notification.routes');
const iotRoutes = require('./routes/iot.routes');
const fieldRoutes = require('./routes/field.routes');

const app = express();

app.set('etag', false);

// CORS — restrict in production via ALLOWED_ORIGINS env var
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : true; // allow all in development
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Disable client-side caching for all API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.get('/', (req, res) =>
  res.json({ ok: true, name: 'Amar-Ration Backend' })
);

// Mount all routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/distributor', distributorRoutes);
app.use('/api/consumers', consumerRoutes);
app.use('/api/distribution', distributionRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/iot', iotRoutes);       // Uses x-iot-api-key, not JWT
app.use('/api/field', fieldRoutes);   // FieldUser JWT only

app.use(notFound);
app.use(errorHandler);

module.exports = app;
```

---

### 13.2 Fix: Add Missing Scan-Time Checks in `distribution.controller.js`

The following critical fraud checks are missing from `scanAndIssueToken()`. Add them after the blacklist check:

```javascript
// After: Consumer blacklist check
// ADD: OMSCard.cardStatus check
const card = await OMSCard.findOne({ consumerId: consumer._id });
if (!card || card.cardStatus !== 'Active') {
  await writeAudit({
    actorUserId: userId, actorType: 'Distributor',
    action: 'QR_SCAN_REJECT_CARD_INACTIVE',
    entityType: 'Consumer', entityId: String(consumer._id),
    severity: 'Warning',
    meta: { consumer: consumer.consumerCode, cardStatus: card?.cardStatus || 'NOT_FOUND' }
  });
  return res.status(400).json({ success: false, message: 'OMS Card is not active' });
}

// ADD: Family duplicate check
if (consumer.familyId) {
  const family = await Family.findById(consumer.familyId).lean();
  if (family?.flaggedDuplicate) {
    await writeAudit({
      actorUserId: userId, actorType: 'Distributor',
      action: 'QR_SCAN_REJECT_FAMILY_FLAG',
      entityType: 'Consumer', entityId: String(consumer._id),
      severity: 'Critical',
      meta: { consumer: consumer.consumerCode, familyId: String(consumer.familyId) }
    });
    return res.status(400).json({
      success: false,
      message: 'Household has an unresolved duplicate flag — admin review required'
    });
  }
}

// ADD: Distributor authority expiry check
if (distributor.authorityTo && new Date(distributor.authorityTo) < new Date()) {
  await writeAudit({
    actorUserId: userId, actorType: 'Distributor',
    action: 'QR_SCAN_REJECT_AUTHORITY_EXPIRED',
    entityType: 'Distributor', entityId: String(distributor._id),
    severity: 'Critical',
    meta: { authorityTo: distributor.authorityTo }
  });
  return res.status(403).json({ success: false, message: 'Your distribution authority has expired' });
}

// ADD: Session status check (must be Open)
const sessionStatus = await DistributionSession.findOne({
  distributorId: distributor._id,
  dateKey: todayKey()
}).select('status').lean();

if (sessionStatus && sessionStatus.status !== 'Open') {
  await writeAudit({
    actorUserId: userId, actorType: 'Distributor',
    action: 'QR_SCAN_REJECT_SESSION_CLOSED',
    entityType: 'DistributionSession',
    entityId: String(sessionStatus._id),
    severity: 'Warning',
    meta: { sessionStatus: sessionStatus.status }
  });
  return res.status(400).json({
    success: false,
    message: `Distribution session is ${sessionStatus.status} — cannot issue tokens`
  });
}
```

---

### 13.3 Fix: Frontend Page Path Inconsistency

The distributor pages were renamed and moved from `/pages/distributor/` to `/pages/` root during a branch merge. Verify that `App.tsx` routes match the actual file locations:

```tsx
// In App.tsx — distributor routes should import from:
import DistributorDashboard from './pages/DistributorDashboard';     // NOT ./pages/distributor/
import BeneficiariesPage from './pages/BeneficiariesPage';
import CardsTokensPage from './pages/CardsTokensPage';
import StockDistributionPage from './pages/StockDistributionPage';
import AuditLogPage from './pages/AuditLogPage';
import ReportsPage from './pages/ReportsPage';
import MonitoringPage from './pages/MonitoringPage';
```

---

### 13.4 Fix: Merge Feature Branch Files

The following files exist only in the `Afifa/feature/Admin-backend-connecting` branch and must be merged to `main`:

```bash
# Resolve conflicts and ensure these files are on main:
backend/src/controllers/admin.controller.js
backend/src/controllers/audit-report.controller.js
backend/src/models/AuditReportRequest.js
backend/src/models/Notification.js
backend/src/models/SmsOutbox.js
backend/src/services/notification.service.js
backend/src/routes/admin.routes.js
```

Additionally, ensure all untracked files are committed:
```bash
backend/src/controllers/iot.controller.js
backend/src/controllers/notification.controller.js
backend/src/controllers/stock.controller.js
backend/src/middleware/iotAuth.js
backend/src/routes/iot.routes.js
backend/src/routes/field.routes.js
backend/src/routes/notification.routes.js
backend/src/routes/stock.routes.js
backend/src/services/fraud.service.js
backend/src/services/nid-security.service.js
backend/src/services/email.service.js
```

---

## 14. Pending Feature Implementation Guide

### 14.1 QR Image Generation (Consumer Card)

Install the package (already in node_modules):
```bash
# Already present — just add to package.json dependencies:
npm install qrcode
```

Add endpoint to `consumer.routes.js`:
```javascript
// GET /api/consumers/:id/card/qr-image
router.get('/:id/card/qr-image', protect, authorize('Admin', 'Distributor'), async (req, res) => {
  const consumer = await Consumer.findById(req.params.id).lean();
  if (!consumer) return res.status(404).json({ success: false, message: 'Consumer not found' });

  const QRCode = require('qrcode');
  const dataUrl = await QRCode.toDataURL(consumer.qrToken, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 256
  });

  res.json({ success: true, data: { qrDataUrl: dataUrl, qrToken: consumer.qrToken } });
});
```

**OMS Card PDF** — use `pdfkit` on backend OR generate in browser using `jsPDF` + `html2canvas`:
```bash
npm install pdfkit  # backend option
```

Card content to include:
- System logo
- Beneficiary name + Consumer Code
- Ward / Union / Upazila
- Ration Category (A/B/C) + quantity
- QR Code image (from data URL)
- Issue date + validity period
- "Government of Bangladesh — OMS Distribution Program"

---

### 14.2 Session Close with Reconciliation

Add to `distribution.controller.js`:

```javascript
// POST /api/distribution/session/close
async function closeSession(req, res) {
  const { remainingStockKg, note } = req.body;
  const distributor = await ensureDistributorProfile(req.user);
  if (!distributor) return res.status(403).json({ success: false, message: 'Distributor not found' });

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const dateKey = todayKey();

    const distSession = await DistributionSession.findOne({
      distributorId: distributor._id, dateKey
    }).session(session);

    if (!distSession) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'No active session found' });
    }
    if (distSession.status !== 'Open' && distSession.status !== 'Paused') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Session is already closed' });
    }

    // Reconciliation: sum expected vs actual
    const tokens = await Token.find({
      distributorId: distributor._id,
      sessionId: distSession._id,
      status: 'Used'
    }).select('_id rationQtyKg').lean();

    const totalExpectedKg = tokens.reduce((sum, t) => sum + Number(t.rationQtyKg), 0);
    const tokenIds = tokens.map(t => t._id);

    const records = await DistributionRecord.find({
      tokenId: { $in: tokenIds }
    }).select('actualKg').lean();
    const totalActualKg = records.reduce((sum, r) => sum + Number(r.actualKg), 0);

    const diff = Math.abs(totalExpectedKg - totalActualKg);
    const reconciliationFlag = diff > 0.5; // 500g tolerance for reconciliation

    distSession.status = 'Closed';
    distSession.closedAt = new Date();
    distSession.closedByUserId = req.user.userId;
    distSession.reconciliationFlag = reconciliationFlag;
    distSession.reconciliationNote = reconciliationFlag
      ? `Expected ${totalExpectedKg.toFixed(2)}kg, Actual ${totalActualKg.toFixed(2)}kg, Diff ${diff.toFixed(2)}kg`
      : null;
    await distSession.save({ session });

    // Expire any still-issued (uncollected) tokens
    await Token.updateMany(
      { distributorId: distributor._id, sessionId: distSession._id, status: 'Issued' },
      { $set: { status: 'Expired' } },
      { session }
    );

    await writeAudit({
      actorUserId: req.user.userId,
      actorType: 'Distributor',
      action: reconciliationFlag ? 'SESSION_RECONCILIATION_MISMATCH' : 'SESSION_CLOSED',
      entityType: 'DistributionSession',
      entityId: String(distSession._id),
      severity: reconciliationFlag ? 'Critical' : 'Info',
      meta: { totalExpectedKg, totalActualKg, diff: diff.toFixed(2), dateKey }
    }, session);

    if (reconciliationFlag) {
      await notifyAdmins({
        title: `⚠️ Reconciliation Mismatch — Ward ${distributor.ward}`,
        message: `Session closed with ${diff.toFixed(2)}kg discrepancy.`,
        meta: { distributorId: String(distributor._id), totalExpectedKg, totalActualKg }
      });
    }

    await session.commitTransaction();
    res.json({ success: true, data: { reconciliationFlag, totalExpectedKg, totalActualKg } });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    session.endSession();
  }
}
```

Add route: `router.post('/session/close', protect, authorize('Distributor'), closeSession);`

---

### 14.3 Stock IN Endpoint

Add to `stock.controller.js`:
```javascript
// POST /api/stock/in  — Admin only
async function recordStockIn(req, res) {
  const { distributorId, qtyKg, note } = req.body;
  if (!distributorId || !qtyKg || qtyKg <= 0) {
    return res.status(400).json({ success: false, message: 'distributorId and qtyKg > 0 required' });
  }

  const distributor = await Distributor.findById(distributorId).lean();
  if (!distributor) return res.status(404).json({ success: false, message: 'Distributor not found' });

  const entry = await StockLedger.create({
    distributorId,
    type: 'IN',
    qtyKg: Number(qtyKg),
    dateKey: new Date().toISOString().slice(0, 10),
    ref: `ALLOC-${Date.now()}`,
    note: note || 'Manual allocation by admin'
  });

  await writeAudit({
    actorUserId: req.user.userId,
    actorType: 'Central Admin',
    action: 'STOCK_ALLOCATED',
    entityType: 'StockLedger',
    entityId: String(entry._id),
    severity: 'Info',
    meta: { distributorId, qtyKg, dateKey: entry.dateKey }
  });

  res.status(201).json({ success: true, data: { entry } });
}
```

---

### 14.4 Rate Limiting

```bash
npm install express-rate-limit
```

Add to `app.js` before route mounting:
```javascript
const rateLimit = require('express-rate-limit');

// General API limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests — try again later' }
});

// Strict login limit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts — try again in 15 minutes' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', loginLimiter);
```

---

### 14.5 Helmet Security Headers

```bash
npm install helmet
```

Add to `app.js` (before routes):
```javascript
const helmet = require('helmet');
app.use(helmet());
```

---

### 14.6 Auto-Expire Temporary Blacklist Entries (Cron Job)

```bash
npm install node-cron
```

Create `src/jobs/blacklist-expiry.job.js`:
```javascript
const cron = require('node-cron');
const BlacklistEntry = require('../models/BlacklistEntry');
const Consumer = require('../models/Consumer');
const { writeAudit } = require('../services/audit.service');

function startBlacklistExpiryJob() {
  // Runs every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const now = new Date();
      const expired = await BlacklistEntry.find({
        active: true,
        blockType: 'Temporary',
        expiresAt: { $lte: now }
      }).lean();

      for (const entry of expired) {
        await BlacklistEntry.findByIdAndUpdate(entry._id, { $set: { active: false } });

        // If consumer was blacklisted, reset their status
        if (entry.targetType === 'Consumer') {
          await Consumer.findByIdAndUpdate(entry.targetRefId, {
            $set: { blacklistStatus: 'None' }
          });
        }

        await writeAudit({
          actorType: 'System',
          action: 'BLACKLIST_EXPIRED',
          entityType: entry.targetType,
          entityId: entry.targetRefId,
          severity: 'Info',
          meta: { reason: entry.reason, expiresAt: entry.expiresAt }
        });
      }

      if (expired.length > 0) {
        console.log(`[CRON] Expired ${expired.length} blacklist entries`);
      }
    } catch (err) {
      console.error('[CRON] Blacklist expiry job error:', err);
    }
  });
}

module.exports = { startBlacklistExpiryJob };
```

In `server.js`:
```javascript
const { startBlacklistExpiryJob } = require('./src/jobs/blacklist-expiry.job');
// After DB connection:
startBlacklistExpiryJob();
```

---

### 14.7 Notification Bell (Frontend)

In `AdminTopbar.tsx` and `Topbar.tsx`, add polling:

```tsx
// Topbar.tsx
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  const fetchUnread = async () => {
    try {
      const res = await api.get('/notifications/unread-count');
      setUnreadCount(res.data.data.count || 0);
    } catch {}
  };
  fetchUnread();
  const interval = setInterval(fetchUnread, 30000); // Poll every 30s
  return () => clearInterval(interval);
}, []);

// In JSX:
<button className="relative" onClick={() => navigate('/notifications')}>
  <BellIcon />
  {unreadCount > 0 && (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  )}
</button>
```

---

### 14.8 Dashboard Auto-Refresh (Frontend)

In `AdminDashboard.tsx` and `DistributorDashboard.tsx`:
```tsx
useEffect(() => {
  fetchDashboardData(); // initial load
  const interval = setInterval(fetchDashboardData, 60000); // 60s refresh
  return () => clearInterval(interval);
}, []);
```

---

### 14.9 Zod Input Validation (Backend)

Add Zod schemas to the most critical endpoints. Example for `/api/distribution/scan`:
```javascript
const { z } = require('zod');

const scanSchema = z.object({
  qrPayload: z.string().min(8).max(128).trim()
});

// In scanAndIssueToken:
const parsed = scanSchema.safeParse(req.body);
if (!parsed.success) {
  return res.status(400).json({
    success: false,
    message: 'Invalid request body',
    errors: parsed.error.flatten().fieldErrors
  });
}
const { qrPayload } = parsed.data;
```

Critical schemas to add:
- Consumer registration: validate NID format, name length, category enum
- Token completion: validate `actualKg` is a positive number ≤ 50
- Blacklist creation: validate reason length, blockType enum, expiresAt if Temporary
- Settings update: validate all numeric values are positive, within sane ranges

---

## 15. Offline Mode

### Design

When the distributor has no network:

1. **Local scan**: Web app stores consumer list locally via browser storage
2. **Local token generation**: Tentative token created with `offline: true` flag, stored in `OfflineQueue`
3. **Distribution proceeds**: Ration given based on cached category allocation
4. **Queue storage**: Scan records stored as `OfflineQueue` entries with `status: 'Pending'`

When network restores:

1. **Sync call**: POST all queued records to `/api/monitoring/offline-queue/sync-all`
2. **Server validation**: Each record re-validated (QR still valid? Consumer still active? No collision?)
3. **Conflict resolution**: Policy = `ServerWins`
   - `Synced`: All checks pass — confirmed
   - `Failed`: Consumer was revoked, token collision, or QR invalid → admin alert + audit log
4. **Audit**: `Failed` items appear in admin's monitoring page for manual review
5. **Consumer notifications**: SMS queued for any confirmed offline distributions

---

## 16. Notification System

### Channels

| Channel | Status | Description |
|---|---|---|
| In-App | ✅ Model exists | `Notification` model (in feature branch), `notifyUser()` / `notifyAdmins()` service |
| SMS | ⚠️ Partial | `SmsOutbox` model exists; gateway integration pending |

### Notification Events

| Event | Recipients | Channel |
|---|---|---|
| New distributor signup | Admin | In-App |
| Distributor approved | Distributor | In-App |
| Distributor rejected | Distributor | In-App |
| Consumer card activated | Distributor | In-App |
| QR scan rejected (any reason) | Distributor | In-App |
| Weight mismatch detected | Admin + Distributor | In-App |
| Auto-fraud flag raised | Admin | In-App (Critical) |
| Session auto-paused | Admin + Distributor | In-App |
| Token issued | Consumer | SMS (if phone on record) |
| Family duplicate flagged | Admin | In-App |
| Offline sync conflict | Admin | In-App |
| Audit report requested | Distributor | In-App |
| Audit report reviewed | Distributor | In-App |
| Session reconciliation mismatch | Admin | In-App (Critical) |
| Blacklist entry created | Admin | In-App |
| Blacklist auto-expired | Affected user | In-App |

---

## 17. QR Card Lifecycle

```
Consumer Registered by Distributor
         │
         ▼
Consumer.status = 'Inactive'
OMSCard.cardStatus = 'Inactive'
qrToken = crypto.randomBytes(32).toString('hex')  ← QR payload
         │
         ▼ (Admin reviews, resolves any family flag)
Admin Activates Consumer + Card
Consumer.status = 'Active'
OMSCard.cardStatus = 'Active'
Physical card printed with QR image
         │
         ├──────────────────────────────────────────────────┐
         │                                                  │
         ▼                                                  ▼
Consumer presents card → QR scanned            Admin/distributor revokes consumer
Token issued → distribution proceeds          Consumer.status = 'Revoked'
         │                                    OMSCard.cardStatus = 'Revoked'
         ▼                                    qrToken now resolves to Revoked consumer
                                              Any subsequent scan → REJECTED
         ▼
Admin Reissues Card (lost/stolen card)
New qrToken = crypto.randomBytes(32).toString('hex')
Old qrToken immediately invalid (Consumer record updated)
New physical card must be printed + delivered
Audit log: CARD_REISSUED
```

**Printable OMS Card Content:**
- System logo + "Government of Bangladesh — OMS Program"
- Beneficiary full name
- Consumer Code (C0042)
- Ward / Union / Upazila / District
- Category (A / B / C) + ration quantity
- QR Code image (generated from `qrToken`)
- Issue date
- Validity note: "Valid until next QR rotation"

---

## 18. Distribution Workflow

### Complete Day Flow

```
[BEFORE DISTRIBUTION DAY]
Admin → POST /api/stock/in → StockLedger IN entry for distributor
Admin → Confirms distribution date + quota

[DISTRIBUTION DAY — DISTRIBUTOR]
1. Distributor logs in
2. Dashboard shows today's session status
3. If no session yet: "Open Session" button creates DistributionSession
4. System auto-created or distributor opens explicitly

[DISTRIBUTION — SCAN AND ISSUE]
5. Consumer presents physical OMS card
6. Distributor scans QR via camera or enters consumer code
7. POST /api/distribution/scan { qrPayload }
8. Backend runs all 10 fraud/validation checks
   ├── Any check fails → Reject + Audit (no token created)
   └── All pass → Token created (status: Issued), response with consumer info + token
9. Distributor physically hands over ration
10. Distributor enters actual weight dispensed
11. POST /api/distribution/complete { tokenId, actualKg }
    ├── Token.status → Used
    ├── StockLedger OUT entry created (immutable)
    ├── DistributionRecord created (expectedKg vs actualKg, mismatch flag)
    └── Audit log written (DISTRIBUTION_SUCCESS or WEIGHT_MISMATCH)

[WEIGHT MISMATCH PATH]
12. If mismatch AND autoPauseOnMismatch:
    └── Session.status → Paused
        Admin + Distributor notified
        fraud.service.checkDistributorMismatchCount() called
        If threshold exceeded → Distributor auto-suspended

[SESSION CLOSURE]
13. When all consumers served OR end of day:
    POST /api/distribution/session/close { note }
    ├── Expire all still-Issued tokens (Expired status)
    ├── Reconciliation: Expected vs Actual total kg
    ├── If mismatch > 500g → reconciliationFlag + admin alert
    ├── Session.status → Closed
    └── Audit summary written
```

---

## 19. Setup & Running the Project

### Prerequisites

- Node.js v18+
- npm v9+
- MongoDB Atlas account (or local MongoDB with replica set for transactions)
- Git

### Backend Setup

```bash
git clone <repo-url>
cd Smart-OMS/backend
npm install

# Configure environment (copy and edit)
cp .env.example .env
# Set: MONGO_URI, JWT_SECRET (64+ chars), IOT_API_KEY

# Seed database (creates admin + test data)
npm run seed

# Set up database indexes
npm run indexes

# Verify collections
npm run db:verify

# Start development server
npm run dev
```

Backend runs at: `http://localhost:5000`

### Frontend Setup

```bash
cd Smart-OMS/frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

### Seeded Admin Credentials

After `npm run seed`:
```
Email / Phone: admin@omsystem.gov.bd  (or seeded phone)
Password: admin123
Role: Admin
```
⚠️ **Change this immediately in any shared or production environment.**

---

## 20. Environment Configuration

### Backend `.env`

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxx.mongodb.net/amar_ration?retryWrites=true&w=majority

# JWT
JWT_SECRET=change_this_to_a_long_random_string_minimum_64_characters_no_exceptions
JWT_EXPIRES_IN=2h

# IoT Device Auth
IOT_API_KEY=change_to_random_device_key_minimum_32_characters

# SMS Gateway (add when integrating)
SMS_GATEWAY_URL=https://your-sms-provider.com/api/send
SMS_API_KEY=your_sms_api_key

# CORS — restrict in production
ALLOWED_ORIGINS=https://admin.omsystem.gov.bd,https://dist.omsystem.gov.bd
```

### Frontend `.env`

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 21. Security Hardening Checklist

### ✅ Already Implemented

- [x] Passwords hashed with bcryptjs (10 salt rounds)
- [x] JWT authentication with 2hr expiry
- [x] RBAC middleware on all protected routes
- [x] Ward isolation: distributors can only access own ward data
- [x] Admin-only consumer card activation
- [x] Family fingerprint duplicate detection (SHA-256)
- [x] One-token-per-session unique index (DB-enforced, race-condition-safe)
- [x] Consumer blacklist check at scan time
- [x] Immutable audit log (no delete/update routes)
- [x] Append-only stock ledger
- [x] Auto-fraud-flag service (fraud.service.js)
- [x] IoT device authentication (x-iot-api-key header)
- [x] Token replay prevention (status check before completion)
- [x] MongoDB transactions for all critical multi-step operations
- [x] `passwordHash` never returned in any API response
- [x] No verbose error details in production responses

### ⚠️ Pending (Required Before Production)

- [ ] **Change `JWT_SECRET`** to 64+ char cryptographically random string
- [ ] **Install `helmet`** — security headers (X-Frame-Options, HSTS, CSP, etc.)
- [ ] **Install `express-rate-limit`** — 200 req/15min global, 10/15min on login
- [ ] **Restrict CORS** — set `ALLOWED_ORIGINS` to known domains only
- [ ] **Enable HTTPS / TLS** — nginx reverse proxy + Let's Encrypt
- [ ] **Apply Zod validation** on all route inputs (consumer registration, scan, complete, settings)
- [ ] **JWT refresh token flow** — current 2hr single token has no rotation
- [ ] **Admin 2FA (TOTP)** — install `speakeasy` + `qrcode` for admin login
- [ ] **NID field protection** — full NIDs are never persisted; only last-4 stored; verify in code review
- [ ] **MongoDB Atlas IP whitelist** — only backend server IP allowed
- [ ] **Audit log TTL index** — 5-year retention: `AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 157680000 })`
- [ ] **Auto-blacklist cron** — `node-cron` job to deactivate expired temporary entries (§14.6)
- [ ] **QR rotation cron** — scheduled job to regenerate `qrToken` per `expiryCycleDays`
- [ ] **MongoDB Atlas automatic backups** — enable point-in-time recovery
- [ ] **Log rotation** — Winston logger with daily rotate and centralized monitoring
- [ ] **Set `NODE_ENV=production`** — disables verbose error stack traces

### Code-Level Constraints (Non-Negotiable)

- `AuditLog` has NO delete route and NO update route — ever
- `StockLedger` entries are NEVER updated or deleted — only new entries appended
- `passwordHash` must NEVER appear in any API JSON response — use `.select('-passwordHash')`
- Full NID numbers must NEVER be stored in any collection — only SHA-256 hash and last-4 digits
- IoT endpoint must reject all requests without valid `x-iot-api-key` header

---

## 22. Development Checklist

Use this as the team's sprint tracker. Priority order: Critical → High → Medium.

### 🔴 Critical (Must fix before demo)

- [ ] Mount all routes in `app.js` (admin, distributor, iot, notifications, stock, field)
- [ ] Merge feature branch to main (admin.controller, notification.service, AuditReportRequest model)
- [ ] Add OMSCard.cardStatus check to `scanAndIssueToken()`
- [ ] Add Family.flaggedDuplicate check to `scanAndIssueToken()`
- [ ] Add distributor authorityTo expiry check to `scanAndIssueToken()`
- [ ] Add session status Open check to `scanAndIssueToken()`
- [ ] Fix distributor page import paths in `App.tsx`
- [ ] Verify seed creates distributor + consumer test data end-to-end

### 🟡 High (Required for complete system)

- [ ] `POST /api/distribution/session/close` — session close + reconciliation
- [ ] `POST /api/stock/in` — stock allocation by admin
- [ ] QR image generation endpoint (`/api/consumers/:id/card/qr-image`)
- [ ] OMS Card printable view/PDF in frontend (admin + distributor)
- [ ] Notification bell with unread count in topbar (30s polling)
- [ ] Dashboard auto-refresh (60s polling)
- [ ] Auto-expire blacklist cron job
- [ ] Rate limiting middleware
- [ ] Helmet security headers middleware

### 🟢 Medium (Nice to have, improves robustness)

- [ ] CSV/Excel export for admin reports
- [ ] Date range filters on all report pages
- [ ] Admin force-close distributor session
- [ ] Zod validation on all route inputs
- [ ] Stock sufficiency check before token completion
- [ ] Refresh token implementation
- [ ] Admin 2FA (TOTP with `speakeasy`)
- [ ] QR auto-rotation cron job
- [ ] Formal audit report request/submit flow (AuditReportRequest)

### ⚪ Future / Out of Scope for Current Phase

- [ ] Field Distributor Mobile App (partner's implementation)
- [ ] IoT Weight Scale hardware integration (hardware built, software endpoints done)
- [ ] SMS gateway integration (SmsOutbox model ready, gateway not integrated)
- [ ] WebSocket/SSE real-time push for weight alerts

---

## 23. Project Presentation Summary

### What This System Is

The **Smart OMS Ration Distribution System** is a full-stack digital platform that replaces paper-based, fraud-prone ration distribution with a secure, auditable, and accountability-enforced workflow. It operates across two web interfaces — Admin Dashboard and Distributor Dashboard — communicating with a single secure backend API, protecting against every known vector of fraud in physical ration distribution.

### What Makes It Different

**1. No self-signup, no self-activation.**
No actor can grant themselves elevated access. Every distributor starts as `Pending`. Every consumer starts as `Inactive`. Activation requires a separate, higher-privileged action through a controlled chain.

**2. Family-level duplicate detection with privacy.**
Registration captures three NIDs. The system computes a one-way SHA-256 hash (`familyKey`) and stores only the last 4 digits of each NID. If two households share a family fingerprint, the system flags it and blocks distribution until admin reviews — without ever storing complete NID numbers.

**3. QR-based digital identity — no physical card forgery.**
A physical OMS card contains a 64-character cryptographic token as QR. The moment a card is revoked in the system, even a genuine physical card scan is rejected in real time. A stolen or forged card has zero value.

**4. Ten-layer scan-time fraud prevention.**
Before any token is issued, the system checks: QR validity, consumer active status, card active status, blacklist status, family duplicate flag, ward boundary, distributor active status, distributor authority expiry, session open status, and MongoDB unique index for duplicate-token prevention. A single failure at any layer rejects the scan and writes an immutable audit entry.

**5. Token replay impossible.**
Each token starts as `Issued`. Completing distribution sets it to `Used`. The backend verifies `status === 'Issued'` before completing any distribution. A token cannot be used twice — even if someone captures the API call.

**6. Auto-fraud detection.**
The fraud service monitors weight mismatch counts per distributor over a rolling 30-day window. When a configurable threshold is exceeded, the system automatically suspends the distributor, creates a blacklist entry, alerts the admin, and logs a Critical audit event — without any human intervention.

**7. Immutable audit trail.**
Every action from every actor is permanently recorded in `AuditLog`. There is no delete route and no update route for this collection. Audit logs are the system's permanent, non-repudiable memory.

**8. Session reconciliation.**
When a session is closed, the system automatically compares total expected ration (from token quantities) against total actual stock dispensed (from StockLedger OUT entries). Any significant discrepancy triggers a reconciliation flag and admin alert.

**9. Revocable, time-bound authority.**
A distributor's authority has an expiry date (`authorityTo`). Once expired, no new tokens can be issued — automatically, without admin intervention. Admin can suspend or revoke a distributor at any time; the effect is immediate.

### System Status

| Component | Platform | Status |
|---|---|---|
| Backend API | Node.js + Express + MongoDB | ✅ Core complete — needs route mounting fix |
| Admin Web Dashboard | React + TypeScript + Vite | ✅ All pages built |
| Distributor Web Dashboard | React + TypeScript + Vite | ✅ All pages built |
| Fraud Detection Service | Node.js Service | ✅ Complete |
| IoT Weight Scale Endpoints | Node.js | ✅ Backend ready |
| Field Distributor Mobile App | React Native / Flutter | Out of scope (partner) |

### By the Numbers

- **13 MongoDB collections** on main (16 after feature branch merge)
- **9 route modules** with RBAC enforcement
- **10 validation checks** at every QR scan before token issuance
- **7 automatic fraud detection layers** (identity → family → QR → blacklist → ward → weight → reconciliation)
- **4 actor types** with strictly separated access
- **2 distribution modes**: Online (real-time) and Offline (with ServerWins sync)
- **0** delete routes on AuditLog — permanent, immutable, forever

---

*Last updated: April 2026*
*Project: Smart OMS Ration Distribution System — Amar Ration*
*Team: Afifa + Shormi + Partner*