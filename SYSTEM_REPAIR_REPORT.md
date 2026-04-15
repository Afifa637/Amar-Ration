# AmarRation System Repair Report (April 2026)

## 1) Root-cause analysis (current codebase)

### Security
- Refresh-token auth interceptor in frontend could trigger duplicate forced logout paths on one 401 chain.
- Runtime artifacts (`uploads`) were partially unignored, creating risk of accidental commit.
- Startup lifecycle had no graceful shutdown; DB disconnect handling was weak.
- Secret hygiene required explicit rotation guidance after historical leak concern.

### Contract drift / workflow mismatch
- Admin audit workflow had submit events visible in logs but weak discoverability in request-review table when report text was empty and only files were submitted.
- Audit re-request flow was missing as a first-class decision.
- Multi-file support existed but was constrained and inconsistently surfaced.

### UX / page formation
- No global route fallback (404), causing poor UX for stale links.
- Audit review lacked explicit reviewer note flow for iterative requests.

### Data-model consistency
- System contains mixed derived totals and item-wise fields across some modules; core direction should remain item-wise source-of-truth.

### Performance / architecture
- Some pages still perform local ad-hoc fetching/polling rather than shared cache-driven data strategy.
- DTO enrichment exists in many places but remains controller-heavy and not uniformly mapper-based.

### Test coverage gaps
- Core auth/queue tests exist, but missing comprehensive frontend behavior tests and deeper DTO contract tests.

---

## 2) Exact files changed in this repair pass

- `.gitignore`
- `backend/.env.example`
- `backend/server.js`
- `backend/src/config/db.js`
- `frontend/.env.example`
- `frontend/src/App.tsx`
- `frontend/src/pages/NotFoundPage.tsx`
- `frontend/src/services/api.ts`
- `backend/src/controllers/audit-report.controller.js`
- `backend/src/models/AuditReportRequest.js`
- `backend/src/routes/distributor.routes.js`
- `frontend/src/pages/admin/AdminAuditPage.tsx`
- `frontend/src/pages/distributor/AuditLogPage.tsx`
- `backend/src/models/DistributionRecord.js`
- `backend/src/controllers/distribution.controller.js`
- `backend/src/services/distributionRecord.service.js`
- `backend/tests/distributionRecord.service.test.js`
- `backend/src/services/sessionCode.service.js`
- `backend/src/services/queue.service.js`
- `backend/src/controllers/complaint.controller.js`
- `backend/src/models/Complaint.js`
- `backend/src/models/DistributionSession.js`
- `backend/src/models/Token.js`
- `backend/src/controllers/auth.controller.js`
- `backend/.env`
- `backend/src/seed/seed.js`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/pages/admin/AdminBulkRegisterPage.tsx`
- `frontend/src/pages/admin/AdminQRRotationPage.tsx`
- `backend/src/controllers/sessionHealth.controller.js`
- `backend/src/controllers/admin.controller.js`

---

## 3) Summary of code changes

- Added robust DB connection options and connection event logging.
- Added startup fail-fast and graceful shutdown handling (SIGINT/SIGTERM).
- Fixed frontend interceptor unauthorized flow to avoid duplicate forced logout execution.
- Added app-wide 404 page and wildcard route fallback.
- Expanded audit workflow:
  - Added `ReRequested` decision path.
  - Admin can add review note/instructions.
  - Distributor receives follow-up request with fresh due date.
  - Admin can open review modal when submission contains only files.
  - Increased per-submit audit file limit to 10.
- Updated env examples and repo ignore policy for runtime artifacts.
- Added canonical item-wise persistence on distribution completion:
  - `expectedByItem`
  - `actualByItem`
  - `mismatchDetails`
  - `item`, `sessionId`, and `distributorId` on each distribution record
- Refactored repeated item-wise calculation logic into shared service:
  - `backend/src/services/distributionRecord.service.js`
- Updated distribution list/records/stats DTO output to use canonical stored item-wise fields with legacy fallback.
- Added new backend tests for item-wise hydration/mismatch mapping.
- Added shared `sessionCode` service and started replacing duplicated per-controller session-code builders.
- Upgraded queue row enrichment to read canonical record item-wise payload first (legacy fallback retained).
- Extended complaint snapshot model/controller to store richer operational context:
  - `sessionDate`, `sessionStatus`
  - `item`, `expectedByItem`, `actualByItem`, `mismatchDetails`
- Added item-wise compatibility fields to `DistributionSession` and `Token`:
  - `plannedAllocationByItem`, `distributedByItem`
  - `entitlementByItem`
- Updated token/session/distribution flows and seed data to populate new item-wise compatibility fields.
- Updated `sessionHealth` live payload aggregation to read canonical `DistributionRecord.expectedByItem/actualByItem` first, with legacy fallback from token fields.
- Updated admin operational analytics/session grouping calculations to support multi-item records and token `entitlementByItem` while preserving legacy compatibility.
- Replaced admin route redirects with mounted pages for:
  - `/admin/bulk-register`
  - `/admin/qr-rotation`
- Frontend refresh-token storage moved from `localStorage` to `sessionStorage`.
- Frontend forced logout flow hardened with a one-way guard to avoid repeated logout redirects during concurrent 401s.
- Backend auth refresh/logout now support cookie-compatible refresh-token read path (body + cookie fallback), and login/refresh can set refresh cookie.
- Sanitized committed backend `.env` values (real secrets removed; placeholders/local defaults only).

---

## 4) Schema/index/config changes

### Schema
- `AuditReportRequest.decision` enum extended with `ReRequested`.

### Config
- New/clarified env placeholders:
  - `APPEAL_UPLOADS_DIR`
  - `MONGO_MAX_POOL_SIZE`
  - frontend app placeholders (`VITE_APP_NAME`, `VITE_APP_ENV`)

### Repo hygiene
- Explicit ignore for upload/runtime paths and local env files.

---

## 5) Migration notes

- Existing audit report documents remain compatible.
- `decision: ReRequested` is additive and backward compatible.
- Existing `DistributionRecord` documents remain compatible. New fields are additive and optional; legacy records are hydrated at read time.
- Existing complaint/session/token documents remain compatible. Added fields are additive and optional.
- No destructive migrations required for this pass.

---

## 6) Commands run

- `npm run lint:frontend`
- `npm run build:frontend`
- `npm --workspace backend test`

---

## 7) Validation results

- Frontend lint: **pass**
- Frontend build: **pass**
- Backend tests: **pass** (14/14)
- No diagnostics errors in modified files after patch.

---

## 8) Required secret rotation guidance

Treat any previously committed or exposed credentials as compromised and rotate immediately:

- `JWT_SECRET`
- `NID_ENCRYPTION_KEY`
- `TWO_FA_SECRET_KEY`
- SMTP credentials
- SMS gateway credentials
- DB credentials (`MONGO_URI`)

Rotation checklist:
1. Generate new secrets in secret manager.
2. Update runtime envs per environment.
3. Invalidate active refresh tokens (bump `tokenVersion` where needed).
4. Restart backend safely.

---

## 9) Follow-up recommendations (next sprint)

1. Introduce React Query for shared caching/retries/invalidation.
2. Extract backend DTO mappers into service layer for reports/queue/complaints/monitoring.
3. Add missing indexes for heavy list queries observed in production traces.
4. Add frontend test suite for auth refresh/logout, table filters, print/export selection behavior.
5. Complete item-wise canonical migration by reducing dependence on legacy total-only fields in all remaining endpoints.
6. Unify print templates into reusable primitives beyond current page-local implementations.
