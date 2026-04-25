import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

const viteEnv = ((import.meta as unknown as { env?: Record<string, unknown> })
  .env || {}) as {
  VITE_API_BASE_URL?: string;
  DEV?: boolean;
};

const API_BASE_URL =
  viteEnv.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  (viteEnv.DEV ? "http://localhost:5000/api" : "/api");

/**
 * Resolves a backend-relative path (e.g. "/api/photos/CODE") to a full
 * absolute URL using the configured API base. When API_BASE_URL is already
 * absolute (has a host), we prepend its origin; when it is a relative /api
 * path the backend and frontend share the same origin and no prefix is needed.
 */
export function resolveBackendUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path; // already absolute
  try {
    if (/^https?:\/\//i.test(API_BASE_URL)) {
      return new URL(API_BASE_URL).origin + path;
    }
  } catch {
    // ignore malformed URL
  }
  return path; // same-origin fallback
}

export const AUTH_STORAGE_KEY = "amar_ration_auth";
export const REFRESH_STORAGE_KEY = "amar_ration_refresh";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<string | null> | null = null;

type AuthStorage = {
  user?: unknown;
  token?: string;
};

function getStoredAuth(): AuthStorage | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthStorage;
  } catch {
    return null;
  }
}

function getStoredRefreshToken(): string {
  return sessionStorage.getItem(REFRESH_STORAGE_KEY) || "";
}

function setStoredRefreshToken(token: string) {
  if (!token) {
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(REFRESH_STORAGE_KEY, token);
}

async function tryRefreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const stored = getStoredAuth();
      if (!stored?.token) return null;

      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) return null;

      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {
          refreshToken,
        },
        { withCredentials: true },
      );

      const nextToken: string | undefined = response?.data?.data?.token;
      const nextRefresh: string | undefined = response?.data?.data?.refreshToken;
      if (!nextToken || !nextRefresh) return null;

      const nextStored: AuthStorage = {
        ...stored,
        token: nextToken,
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextStored));
      setStoredRefreshToken(nextRefresh);
      api.defaults.headers.common.Authorization = `Bearer ${nextToken}`;
      return nextToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function forceLogoutAndRedirect() {
  if ((forceLogoutAndRedirect as { _inProgress?: boolean })._inProgress) return;
  (forceLogoutAndRedirect as { _inProgress?: boolean })._inProgress = true;

  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(REFRESH_STORAGE_KEY);
  delete api.defaults.headers.common.Authorization;

  if (typeof window !== "undefined" && window.location.pathname !== "/") {
    window.location.href = "/";
    return;
  }

  (forceLogoutAndRedirect as { _inProgress?: boolean })._inProgress = false;
}

export async function logoutSession(refreshToken?: string) {
  try {
    if (!refreshToken) return;
    await api.post("/auth/logout", { refreshToken });
  } catch {
    // ignore logout errors and continue local cleanup
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    try {
      const { token } = JSON.parse(stored);
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // ignore malformed storage
    }
  }

  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const status = error?.response?.status;
    const apiMessage =
      (error?.response?.data as { message?: string } | undefined)?.message ||
      "";
    if (apiMessage) {
      error.message = apiMessage;
    }
    const requestUrl: string = error?.config?.url || "";
    const requestConfig =
      (error?.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined) ||
      undefined;
    const isAuthCall =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/signup") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/logout");
    let handledUnauthorized = false;

    if (status === 401 && !isAuthCall && requestConfig && !requestConfig._retry) {
      requestConfig._retry = true;

      try {
        const nextToken = await tryRefreshAccessToken();
        if (nextToken) {
          requestConfig.headers = requestConfig.headers ?? {};
          requestConfig.headers.Authorization = `Bearer ${nextToken}`;
          return api(requestConfig);
        }
      } catch {
        // fallthrough
      }

      forceLogoutAndRedirect();
      handledUnauthorized = true;
    }

    if (status === 401 && !isAuthCall && !handledUnauthorized) {
      forceLogoutAndRedirect();
    }

    return Promise.reject(error);
  },
);

export type ConsumerStatus = "Active" | "Inactive" | "Revoked";
export type ConsumerCategory = "A" | "B" | "C";

export type Consumer = {
  _id: string;
  consumerCode: string;
  qrToken: string;
  name: string;
  nidLast4: string;
  nidFull?: string;
  fatherNidFull?: string;
  motherNidFull?: string;
  guardianPhone?: string;
  guardianName?: string;
  category: ConsumerCategory;
  status: ConsumerStatus;
  division?: string;
  district?: string;
  upazila?: string;
  unionName?: string;
  ward?: string;
  createdByDistributor?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  blacklistStatus?: "None" | "Temp" | "Permanent";
  familyFlag?: boolean;
  createdAt: string;
};

export type TokenStatus = "Issued" | "Used" | "Cancelled" | "Expired";

export type DistributionToken = {
  _id: string;
  tokenCode: string;
  rationItem?: StockItem;
  sessionId?: string;
  sessionCode?: string;
  session?: {
    id: string;
    dateKey: string;
    status: "Planned" | "Open" | "Paused" | "Closed";
    sessionCode?: string;
  } | null;
  qrPayload?: string;
  qrImageDataUrl?: string;
  sessionDateKey?: string;
  omsQrPayload?: string;
  consumerId:
    | string
    | {
        _id: string;
        consumerCode: string;
        name: string;
        ward?: string;
        status: ConsumerStatus;
      };
  rationQtyKg: number;
  expectedKg?: number;
  actualKg?: number;
  expectedByItem?: Record<StockItem, number>;
  actualByItem?: Record<StockItem, number>;
  mismatch?: boolean;
  mismatchDetails?: Array<{
    item: StockItem;
    expectedKg: number;
    actualKg: number;
    diffKg: number;
    reason: string;
  }>;
  division?: string;
  ward?: string;
  status: TokenStatus;
  issuedAt: string;
  usedAt?: string;
  createdAt: string;
};

export type DistributionRecord = {
  _id: string;
  tokenId:
    | string
    | {
        _id: string;
        tokenCode: string;
        consumerId?: {
          _id: string;
          consumerCode: string;
          name: string;
          ward?: string;
        };
      };
  expectedKg: number;
  actualKg: number;
  item?: StockItem;
  expectedByItem?: Record<StockItem, number>;
  actualByItem?: Record<StockItem, number>;
  mismatchDetails?: Array<{
    item: StockItem;
    expectedKg: number;
    actualKg: number;
    diffKg: number;
    reason: string;
  }>;
  sessionId?: string | null;
  sessionCode?: string;
  dateKey?: string | null;
  division?: string;
  ward?: string;
  mismatch: boolean;
  createdAt: string;
};

export type DistributionSession = {
  _id: string;
  sessionId?: string;
  sessionCode?: string;
  distributorId: string;
  division?: string;
  ward?: string;
  dateKey: string;
  rationItem?: StockItem;
  status: "Planned" | "Open" | "Paused" | "Closed";
  scheduledStartAt?: string;
  openedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PaginationData = {
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export type AuditSeverity = "Info" | "Warning" | "Critical";

export type AuditLogEntry = {
  _id: string;
  actorUserId?: string;
  actorName?: string;
  actorType: "Central Admin" | "Distributor" | "System";
  action: string;
  entityType?: string;
  entityId?: string;
  severity: AuditSeverity;
  meta?: Record<string, unknown>;
  division?: string;
  ward?: string;
  sessionId?: string;
  sessionCode?: string;
  consumerCode?: string;
  consumerName?: string;
  distributorId?: string;
  distributorCode?: string;
  distributorName?: string;
  tokenCode?: string;
  item?: string;
  mismatchReason?: string;
  createdAt: string;
};

export type AuditReportRequest = {
  _id: string;
  distributorUserId:
    | string
    | {
        _id: string;
        name?: string;
        phone?: string;
        email?: string;
        ward?: string;
      };
  requestedByAdminId?: string;
  auditLogId?: AuditLogEntry | string;
  note?: string;
  reportText?: string;
  dueAt?: string;
  overdueNotified?: boolean;
  decision?: "Approved" | "Rejected" | "Suspended" | "ReRequested";
  reviewedAt?: string;
  attachments?: Array<{
    _id: string;
    originalName: string;
    storedName: string;
    mimeType: string;
    size: number;
    relativePath: string;
    uploadedAt?: string;
  }>;
  status: "Requested" | "Submitted" | "Reviewed" | "Closed";
  distributor?: {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    division?: string;
    ward?: string;
    distributorId?: string;
    distributorCode?: string;
  };
  linkedAudit?: {
    id: string;
    action?: string;
    severity?: string;
    entityType?: string;
    entityId?: string;
    sessionId?: string;
    sessionCode?: string;
    consumerCode?: string;
    consumerName?: string;
    tokenCode?: string;
    createdAt?: string;
  } | null;
  submittedAt?: string;
  createdAt: string;
};

export type AdminSummary = {
  stats: {
    pendingDistributors: number;
    activeConsumers: number;
    duplicateFamilies: number;
    issuedQRCards: number;
    todayTokens: number;
    auditAlerts: number;
  };
  ops: {
    validScans: number;
    rejectedScans: number;
    tokensGenerated: number;
    stockOutKg: number;
    offlineQueue: number;
  };
  alerts: AuditLogEntry[];
};

export type AdminDistributorRow = {
  userId: string;
  distributorId: string | null;
  name: string;
  phone?: string;
  loginEmail?: string;
  email?: string;
  contactEmail?: string;
  wardNo?: string;
  division?: string;
  ward?: string;
  officeAddress?: string;
  authorityStatus: "Active" | "Suspended" | "Revoked" | "Pending";
  authorityFrom?: string | null;
  authorityTo?: string | null;
  createdAt?: string;
  auditRequired?: boolean;
  auditRequestStatus?: string | null;
  auditDueAt?: string | null;
};

export type AdminDistributorsResponse = {
  rows: AdminDistributorRow[];
  stats: Record<string, number> & { total: number; pending: number };
};

export type AdminCardsSummary = {
  issuedCards: number;
  activeCards?: number;
  inactiveCards?: number;
  activeQR: number;
  inactiveRevoked: number;
  validQR?: number;
  revokedOrInvalidQR?: number;
  removedCards?: number;
  dueForRotation: number;
};

export type StockItem = "চাল" | "ডাল" | "পেঁয়াজ";

export type AdminDistributionMonitorRow = {
  distributorId?: string;
  distributor?: string;
  division?: string;
  ward: string;
  sessionId?: string;
  dateKey?: string;
  sessionStatus?: "Planned" | "Open" | "Paused" | "Closed" | string;
  mismatchCount?: number;
  expectedKg: number;
  actualKg: number;
  shortfallKg?: number;
  plannedKg?: number;
  assignedUsers?: number;
  scannedUsers?: number;
  matchedUsers?: number;
  mismatchUsers?: number;
  pendingUsers?: number;
  noShowUsers?: number;
  criticalAlertsCount?: number;
  status: "Matched" | "Mismatch";
  action: string;
  itemBreakdown?: Record<
    StockItem,
    {
      plannedKg: number;
      scanExpectedKg: number;
      actualKg: number;
      remainingKg: number;
      mismatchKg: number;
    }
  >;
  stockBalanceByItem?: Record<StockItem, number>;
};

export type AdminMonitoringRecordRow = {
  recordId: string;
  item: StockItem;
  expectedKg: number;
  actualKg: number;
  mismatch: boolean;
  createdAt?: string;
};

export type AdminMonitoringSessionGroup = {
  sessionId: string;
  dateKey: string;
  sessionStatus: "Planned" | "Open" | "Paused" | "Closed" | string;
  openedAt?: string | null;
  closedAt?: string | null;
  updatedAt: string;
  assignedUsers?: number;
  permittedUsers?: number;
  scannedUsers?: number;
  matchedUsers?: number;
  mismatchUsers?: number;
  pendingUsers?: number;
  noShowUsers?: number;
  plannedKg?: number;
  expectedKg: number;
  actualKg: number;
  shortfallKg?: number;
  mismatchKg?: number;
  criticalAlertsCount?: number;
  itemBreakdown?: Record<
    StockItem,
    {
      plannedKg: number;
      scanExpectedKg: number;
      actualKg: number;
      remainingKg: number;
      mismatchKg: number;
    }
  >;
  mismatchCount: number;
  stockBalanceByItem: Record<StockItem, number>;
  rows: AdminMonitoringRecordRow[];
};

export type AdminMonitoringDistributorGroup = {
  distributorId: string;
  distributorName: string;
  division: string;
  ward: string;
  sessions: AdminMonitoringSessionGroup[];
  totals: {
    assignedUsers?: number;
    scannedUsers?: number;
    matchedUsers?: number;
    mismatchUsers?: number;
    pendingUsers?: number;
    noShowUsers?: number;
    plannedKg?: number;
    expectedKg: number;
    actualKg: number;
    shortfallKg?: number;
    criticalAlertsCount?: number;
    mismatchCount: number;
  };
};

export type AdminDistributionMonitoringResponse = {
  rows: AdminDistributionMonitorRow[];
  groups: AdminMonitoringDistributorGroup[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  view: "live" | "recent" | "planned" | "mismatch";
  filters: {
    distributorId?: string;
    division?: string;
    ward?: string;
    sessionStatus?: string;
    item?: StockItem | "";
    mismatchOnly?: boolean;
  };
};

export type AdminConsumerReviewRow = {
  id: string;
  consumerCode: string;
  name: string;
  division?: string;
  ward?: string;
  nidLast4: string;
  status: ConsumerStatus | "inactive_review" | "suspended" | "blacklisted";
  blacklistStatus?: "None" | "Temp" | "Permanent";
  familyFlag: boolean;
  cardStatus?: "Active" | "Inactive" | "Revoked";
  qrStatus?: "Valid" | "Invalid" | "Revoked" | "Expired";
  mismatchCount?: number;
  auditNeeded?: boolean;
  distributorUserId?: string | null;
};

export type MonitoringBlacklistEntry = {
  _id: string;
  distributorId?: string;
  createdByUserId?: string;
  targetType: "Consumer" | "Distributor";
  targetRefId: string;
  blockType: "Temporary" | "Permanent";
  reason: string;
  reasonText?: string;
  targetName?: string;
  targetCode?: string;
  division?: string;
  ward?: string;
  ownerDistributorName?: string;
  ownerDistributorCode?: string;
  createdByName?: string;
  createdByType?: string;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
};

export type OfflineQueueItem = {
  _id: string;
  distributorId: string;
  distributorName?: string;
  distributorCode?: string;
  payload: Record<string, unknown>;
  payloadSummary?: {
    actionType?: string;
    sessionId?: string;
    sessionCode?: string;
    consumerCode?: string;
    consumerName?: string;
    tokenCode?: string;
    item?: string;
    expectedQtyKg?: number;
    actualQtyKg?: number;
  };
  actionType?: string;
  division?: string;
  ward?: string;
  sessionId?: string;
  sessionCode?: string;
  sessionDate?: string;
  sessionStatus?: string;
  consumerCode?: string;
  consumerName?: string;
  tokenCode?: string;
  item?: string;
  expectedQtyKg?: number;
  actualQtyKg?: number;
  status: "Pending" | "Synced" | "Failed";
  errorMessage?: string;
  resolvedAction?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type MonitoringSummary = {
  systemStatus: string;
  todayAlerts: number;
  criticalCount: number;
  offlinePending: number;
  blacklist: MonitoringBlacklistEntry[];
  offline: OfflineQueueItem[];
  critical: AuditLogEntry[];
};

export type SidebarQuickInfo = {
  todayScans: number;
  mismatchCount: number;
  offlinePending: number;
  systemStatus: string;
};

export type StockLedgerEntry = {
  _id: string;
  distributorId?: string;
  dateKey: string;
  type: "IN" | "OUT" | "ADJUST";
  item?: StockItem;
  qtyKg: number;
  ref?: string;
  createdAt: string;
};

export type StockSummaryResponse = {
  dateKey: string;
  distributorId: string | null;
  summary: {
    stockInKg: number;
    stockOutKg: number;
    adjustKg: number;
    balanceKg: number;
  };
  byItem?: Record<
    StockItem,
    {
      stockInKg: number;
      stockOutKg: number;
      adjustKg: number;
      balanceKg: number;
    }
  >;
  entries: StockLedgerEntry[];
  context?: {
    division?: string;
    ward?: string;
    sessionId?: string | null;
    sessionCode?: string;
    sessionStatus?: string | null;
  };
};

export type NotificationItem = {
  _id: string;
  userId: string;
  channel: "App";
  title: string;
  message: string;
  status: "Unread" | "Read";
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type ConsumerCardRow = {
  consumerId: string;
  consumerCode: string;
  name: string;
  category: ConsumerCategory;
  division?: string;
  ward?: string;
  unionName?: string;
  upazila?: string;
  cardId: string | null;
  cardStatus: "Active" | "Inactive" | "Revoked";
  qrCodeId: string | null;
  qrStatus: "Valid" | "Revoked" | "Expired" | "Invalid";
  validFrom?: string | null;
  validTo?: string | null;
  qrPayload: string;
  qrImageDataUrl?: string | null;
  photoUrl?: string | null;
  createdAt: string;
};

export type ConsumerCardDetail = ConsumerCardRow & {
  issuedAt?: string;
  updatedAt?: string;
};

export type DistributionReportRow = {
  _id: string;
  createdAt: string;
  dateTime?: string;
  tokenId?: string;
  tokenCode: string;
  tokenStatus: TokenStatus;
  sessionId?: string | null;
  sessionCode?: string;
  sessionDate?: string;
  sessionStatus?: string;
  distributorId?: string;
  distributorName?: string;
  distributorCode?: string;
  expectedKg: number;
  actualKg: number;
  rationItem?: StockItem;
  expectedByItem?: Record<StockItem, number>;
  actualByItem?: Record<StockItem, number>;
  mismatchItem?: string;
  mismatchReason?: string;
  mismatchDetails?: Array<{
    item: StockItem;
    expectedKg: number;
    actualKg: number;
    diffKg: number;
    reason: string;
  }>;
  mismatch: boolean;
  consumerCode: string;
  consumerName: string;
  consumerId?: string;
  ward: string;
  category: ConsumerCategory | "";
  division?: string;
  complaintId?: string;
};

export interface ComplaintItemRow {
  _id: string;
  complaintId: string;
  consumerId?: string;
  consumerCode?: string;
  consumerName?: string;
  consumerPhone: string;
  distributorId?: string;
  distributorName?: string;
  distributorCode?: string;
  division?: string;
  ward?: string;
  sessionId?: string;
  sessionCode?: string;
  sessionDate?: string;
  sessionStatus?: string;
  tokenCode?: string;
  category: string;
  description: string;
  status: "open" | "under_review" | "resolved" | "rejected";
  adminNote?: string;
  resolvedAt?: string;
  createdAt: string;
}

export type TokenAnalytics = {
  byStatus: Record<TokenStatus, number>;
  byCategory: Record<ConsumerCategory, number>;
  totalRationKg: number;
  topConsumers: Array<{
    consumerCode: string;
    name: string;
    usedTokens: number;
  }>;
};

export type DistributorSettings = {
  policy: {
    authorityMonths: number;
    adminApprovalRequired: boolean;
  };
  distribution: {
    weightThresholdKg: number;
    weightThresholdPercent?: number;
    autoPauseOnMismatch: boolean;
    tokenPerConsumerPerDay: number;
  };
  qr: {
    expiryCycleDays: number;
    autoRotation: boolean;
    revokeBehavior: string;
  };
  allocation: {
    A: number;
    B: number;
    C: number;
  };
  fraud: {
    autoBlacklistMismatchCount: number;
    temporaryBlockDays: number;
  };
  offline: {
    enabled: boolean;
    conflictPolicy: string;
  };
  notifications: {
    sms: boolean;
    app: boolean;
  };
  audit: {
    retentionYears: number;
    immutable: boolean;
  };
};

export type DistributorDashboardSummary = {
  distributor: {
    id: string;
    wardNo?: string;
    division?: string;
    district?: string;
    upazila?: string;
    unionName?: string;
    ward?: string;
    status?: string;
  };
  stats: {
    totalConsumers: number;
    activeConsumers: number;
    issuedTokens: number;
    usedTokens: number;
    cancelledTokens?: number;
    expiredTokens?: number;
    mismatchCount: number;
    pendingOffline: number;
    stockOutTodayKg: number;
  };
  session?: {
    id: string;
    dateKey: string;
    status: "Planned" | "Open" | "Paused" | "Closed";
    rationItem?: StockItem;
    openedAt?: string | null;
    closedAt?: string | null;
  } | null;
  sessions?: {
    total: number;
    planned: number;
    open: number;
    paused: number;
    closed: number;
    recent: Array<{
      id: string;
      dateKey: string;
      status: "Planned" | "Open" | "Paused" | "Closed";
      rationItem?: StockItem;
      openedAt?: string | null;
      closedAt?: string | null;
      issuedTokens: number;
      usedTokens: number;
      cancelledTokens: number;
    }>;
  };
  stock?: {
    today: {
      outKg: number;
      byItem?: Record<
        string,
        { inKg: number; outKg: number; adjustKg: number; balanceKg: number }
      >;
    };
  };
  trends?: {
    today?: {
      issuedTokens: number;
      usedTokens: number;
      mismatchCount: number;
      stockOutKg: number;
    };
    last7Days: Array<{
      dateKey: string;
      issuedTokens: number;
      usedTokens: number;
      mismatchCount: number;
      stockOutKg: number;
    }>;
  };
  quality?: {
    mismatchRate: number;
    fulfilmentRate: number;
  };
  recentAudit?: AuditLogEntry[];
};

export type BulkRegisterUploadResponse = {
  dryRun: boolean;
  total: number;
  inserted: number;
  skipped: number;
  errors: Array<{
    row: number;
    name: string;
    nid: string;
    code?: string;
    reason: string;
  }>;
  summary?: {
    total: number;
    valid: number;
    inserted: number;
    duplicate: number;
    invalid: number;
    ignoredOutOfScope: number;
    failed: number;
    skipped: number;
  };
  details?: {
    invalidRows: Array<{ row: number; name: string; nid: string; reason: string }>;
    duplicateRows: Array<{ row: number; name: string; nid: string; reason: string }>;
    ignoredRows: Array<{ row: number; name: string; nid: string; reason: string }>;
    failedRows: Array<{ row: number; name: string; nid: string; reason: string }>;
  };
};

export interface ComplaintStats {
  total: number;
  open: number;
  under_review: number;
  resolved: number;
  rejected: number;
  byCategory?: Record<string, number>;
}

export type AppealStatus = "pending" | "under_review" | "approved" | "rejected";

export interface AppealAttachment {
  _id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  relativePath: string;
  uploadedAt?: string;
}

export interface AppealItem {
  _id: string;
  appealId: string;
  consumerPhone: string;
  reason: string;
  supportingInfo?: string;
  status: AppealStatus;
  createdAt: string;
  adminNote?: string;
  division?: string;
  ward?: string;
  attachments?: AppealAttachment[];
  consumerId?: {
    _id?: string;
    consumerCode?: string;
    name?: string;
    division?: string;
    ward?: string;
  };
  distributorUserId?: {
    _id?: string;
    name?: string;
    phone?: string;
  };
  blacklistEntryId?: {
    _id?: string;
    reason?: string;
    blockType?: string;
  };
}

export interface MonthlyPerformanceRow {
  distributorId: string;
  distributorName: string;
  year: number;
  month: number;
  monthName: string;
  totalSessions: number;
  totalDistributions: number;
  mismatchCount: number;
  mismatchRate: number;
  iotVerifiedCount: number;
  iotRate: number;
  fraudScore: number;
  riskLevel: string;
  rating: number;
  badge: string;
  generatedAt: string;
}

export interface StockSuggestionResult {
  division?: string;
  ward: string;
  union: string;
  item?: StockItem | "all";
  movingAverage: number;
  suggestedStock: number;
  insertedAverage?: number;
  distributedAverage?: number;
  averageGap?: number;
  averageAccuracyPercent?: number;
  itemBreakdown?: Record<
    StockItem,
    {
      movingAverage: number;
      suggestedStock: number;
      totalKg: number;
      sessionsConsidered: number;
      insertedAverage?: number;
      distributedAverage?: number;
      averageGap?: number;
      averageAccuracyPercent?: number;
      insertedTotalKg?: number;
      distributedTotalKg?: number;
    }
  >;
  trend: "increasing" | "decreasing" | "stable";
  trendBangla: string;
  note: string;
  generatedAt: string;
  last3Sessions: Array<{
    sessionId: string;
    date: string;
    totalKg: number;
    insertedKg?: number;
    distributedKg?: number;
    accuracyPercent?: number;
    consumerCount: number;
  }>;
}

export interface QueueStatus {
  sessionId: string;
  sessionCode?: string;
  sessionDate?: string;
  sessionStatus?: string;
  division?: string;
  ward?: string;
  distributorId?: string;
  distributorName?: string;
  currentlyServing: {
    id: string;
    queueNumber: number;
    consumerName: string;
    consumerCode: string;
    category?: string;
  } | null;
  waitingCount: number;
  nextUp: Array<{
    id: string;
    queueNumber: number;
    consumerName: string;
    consumerCode: string;
    category?: string;
  }>;
  summary?: {
    totalInQueue: number;
    waiting: number;
    serving: number;
    served: number;
    skipped: number;
    mismatchCount: number;
    servedCount: number;
    remainingCount: number;
  };
  lastUpdated: string;
}

export interface QueueEntryRow {
  _id: string;
  sessionId?: string;
  sessionCode?: string;
  sessionDate?: string;
  sessionStatus?: string;
  division?: string;
  ward?: string;
  distributorId?: string;
  distributorName?: string;
  queueNumber: number;
  status: "waiting" | "serving" | "done" | "skipped" | string;
  consumerId?: string;
  consumerCode?: string;
  consumerName?: string;
  category?: string;
  tokenId?: string;
  tokenCode?: string;
  tokenStatus?: string;
  rationItem?: StockItem;
  expectedKg?: number;
  actualKg?: number;
  expectedByItem?: Record<StockItem, number>;
  actualByItem?: Record<StockItem, number>;
  mismatch?: boolean;
  mismatchItem?: string;
  mismatchReason?: string;
  mismatchDetails?: Array<{
    item: StockItem;
    expectedKg: number;
    actualKg: number;
    diffKg: number;
    reason: string;
  }>;
  joinedAt?: string;
  issuedAt?: string;
  calledAt?: string;
  completedAt?: string;
}

export type SettingsProfile = {
  _id?: string;
  userType?: string;
  name: string;
  email?: string;
  phone?: string;
  wardNo?: string;
  officeAddress?: string;
  division?: string;
  district?: string;
  upazila?: string;
  unionName?: string;
  ward?: string;
};

export type Admin2FAStatus = {
  enabled: boolean;
  setupPending: boolean;
  pendingSince?: string | null;
  secret?: string | null;
  mismatch?: boolean;
  mismatchDetectedAt?: string | null;
};

type Pagination = {
  total: number;
  page: number;
  pages: number;
  limit: number;
};

const unwrap = <T,>(response: { data: { data?: T } }): T | undefined =>
  response.data.data;

export async function getConsumers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: ConsumerCategory;
  status?: ConsumerStatus;
  ward?: string;
}) {
  const response = await api.get<{
    data: { consumers: Consumer[]; pagination: Pagination };
  }>("/consumers", {
    params,
  });
  return response.data.data;
}

export async function createConsumer(payload: {
  name: string;
  nidFull: string;
  fatherNidFull: string;
  motherNidFull: string;
  guardianPhone?: string;
  guardianName?: string;
  category: ConsumerCategory;
  status?: ConsumerStatus;
}) {
  const response = await api.post<{ data: { consumer: Consumer } }>(
    "/consumers",
    payload,
  );
  return unwrap<{ consumer: Consumer }>(response);
}

export async function updateConsumer(
  consumerId: string,
  payload: {
    name?: string;
    nidFull?: string;
    fatherNidFull?: string;
    motherNidFull?: string;
    guardianPhone?: string;
    guardianName?: string;
    category?: ConsumerCategory;
    status?: ConsumerStatus;
  },
) {
  const response = await api.put<{ data: { consumer: Consumer } }>(
    `/consumers/${consumerId}`,
    payload,
  );
  return unwrap<{ consumer: Consumer }>(response);
}

export async function deleteConsumer(consumerId: string) {
  await api.delete(`/consumers/${consumerId}`);
}

export async function getConsumerStats() {
  const response = await api.get<{
    data: {
      stats: {
        total: number;
        active: number;
        inactive: number;
        revoked: number;
        categoryA: number;
        categoryB: number;
        categoryC: number;
      };
    };
  }>("/consumers/stats");
  return response.data.data.stats;
}

export async function getConsumerCards(params?: {
  page?: number;
  limit?: number;
  search?: string;
  division?: string;
  ward?: string;
  wardNo?: string;
  cardStatus?: "Active" | "Inactive" | "Revoked";
  qrStatus?: "Valid" | "Revoked" | "Expired" | "Invalid";
  withImage?: boolean;
}) {
  const response = await api.get<{
    data: { rows: ConsumerCardRow[]; pagination: PaginationData };
  }>("/consumers/cards", { params });
  return response.data.data;
}

export async function getConsumerById(consumerId: string) {
  const response = await api.get<{ data: { consumer: Consumer } }>(
    `/consumers/${consumerId}`,
  );
  return response.data.data.consumer;
}

export async function getConsumerCard(consumerId: string) {
  const response = await api.get<{ data: { card: ConsumerCardDetail } }>(
    `/consumers/${consumerId}/card`,
  );
  return response.data.data.card;
}

export async function issueToken(qrPayload: string) {
  const response = await api.post<{
    data: {
      token: DistributionToken;
      tokenQrPayload?: string;
      sessionDateKey?: string;
      omsQrPayload?: string;
    };
  }>(
    "/distribution/scan",
    { qrPayload },
  );
  return unwrap<{
    token: DistributionToken;
    tokenQrPayload?: string;
    sessionDateKey?: string;
    omsQrPayload?: string;
  }>(response);
}

export async function completeDistribution(tokenCode: string, actualKg: number) {
  const response = await api.post<{ data: { mismatch: boolean } }>(
    "/distribution/complete",
    {
      tokenCode,
      actualKg,
    },
  );
  return unwrap<{ mismatch: boolean }>(response);
}

export async function completeDistributionByTokenQr(
  tokenQrPayload: string,
  actualKg: number,
) {
  const response = await api.post<{ data: { mismatch: boolean } }>(
    "/distribution/complete",
    {
      tokenQrPayload,
      actualKg,
    },
  );
  return unwrap<{ mismatch: boolean }>(response);
}

export async function getDistributionTokens(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: TokenStatus;
  sessionId?: string;
  withImage?: boolean;
}) {
  const response = await api.get<{
    data: { tokens: DistributionToken[]; pagination: Pagination };
  }>("/distribution/tokens", { params });
  return response.data.data;
}

export async function cancelDistributionToken(tokenId: string) {
  const response = await api.patch<{ data: { token: DistributionToken } }>(
    `/distribution/tokens/${tokenId}/cancel`,
  );
  return unwrap<{ token: DistributionToken }>(response);
}

export async function getDistributionRecords(params?: {
  page?: number;
  limit?: number;
  search?: string;
  mismatch?: "true" | "false";
  sessionId?: string;
}) {
  const response = await api.get<{
    data: {
      records: DistributionRecord[];
      stock: {
        dateKey: string;
        stockOutKg: number;
        byItem?: Record<StockItem, number>;
      };
      pagination: Pagination;
    };
  }>("/distribution/records", { params });
  return response.data.data;
}

export async function getDistributionStats(params?: { sessionId?: string }) {
  const response = await api.get<{
    data: {
      stats: {
        totalTokens: number;
        issued: number;
        used: number;
        cancelled: number;
        mismatches: number;
        completedRecords: number;
        expectedKg: number;
        actualKg: number;
        byItem?: Record<
          StockItem,
          { expectedKg: number; actualKg: number; mismatchCount: number }
        >;
        totals?: {
          expectedKg: number;
          actualKg: number;
          label?: string;
        };
      };
    };
  }>("/distribution/stats", { params });
  return response.data.data.stats;
}

export async function getDistributionQuickInfo() {
  const response = await api.get<{ data: SidebarQuickInfo }>(
    "/distribution/quick-info",
  );
  return response.data.data;
}

export async function getDistributionSessions(params?: {
  page?: number;
  limit?: number;
  status?: "Planned" | "Open" | "Paused" | "Closed";
  dateKey?: string;
  distributorId?: string;
}) {
  const response = await api.get<{
    data: {
      sessions: DistributionSession[];
      context?: {
        distributorId?: string | null;
        division?: string;
        ward?: string;
      };
      pagination: Pagination;
    };
  }>("/distribution/sessions", { params });
  return response.data.data;
}

export async function createDistributionSession(payload: {
  distributorId?: string;
  dateKey?: string;
  scheduledStartAt?: string;
  rationItem?: StockItem;
}) {
  const response = await api.post<{
    data: {
      session: DistributionSession;
    };
  }>("/distribution/session/create", payload);
  return response.data.data;
}

export async function startDistributionSession(payload?: {
  sessionId?: string;
  distributorId?: string;
  dateKey?: string;
}) {
  const response = await api.post<{
    data: {
      session: DistributionSession;
    };
  }>("/distribution/session/start", payload || {});
  return response.data.data;
}

export async function closeDistributionSession(payload: {
  sessionId?: string;
  distributorId?: string;
  dateKey?: string;
  note?: string;
}) {
  const response = await api.post<{
    data: {
      session: DistributionSession;
      reconciliation: {
        issuedTokens: number;
        usedTokens: number;
        pendingTokens: number;
        expectedUsedKg: number;
        expectedIssuedKg: number;
        stockOutKg: number;
        mismatch: boolean;
        mismatchKg: number;
      };
    };
  }>("/distribution/session/close", payload);
  return response.data.data;
}

export async function recordStockIn(payload: {
  distributorId?: string;
  division?: string;
  ward?: string;
  wardNo?: string;
  qtyKg: number;
  item: StockItem;
  ref?: string;
  dateKey?: string;
}) {
  const response = await api.post<{ data: { entry: StockLedgerEntry } }>(
    "/stock/in",
    payload,
  );
  return response.data.data;
}

export async function getStockSummary(params?: {
  distributorId?: string;
  dateKey?: string;
}) {
  const response = await api.get<{ data: StockSummaryResponse }>(
    "/stock/summary",
    { params },
  );
  return response.data.data;
}

export async function getAdminSummary() {
  const response = await api.get<{ data: AdminSummary }>("/admin/summary");
  return response.data.data;
}

export async function getAdminDistributors(params?: {
  division?: string;
  ward?: string;
  wardNo?: string;
  status?: "Active" | "Suspended" | "Revoked" | "Pending";
  auditRequired?: boolean;
  search?: string;
}) {
  const response = await api.get<{ data: AdminDistributorsResponse }>(
    "/admin/distributors",
    { params },
  );
  return response.data.data;
}

export async function updateAdminDistributorStatus(
  userId: string,
  status: "Active" | "Suspended" | "Revoked",
) {
  const response = await api.patch<{
    data: { userId: string; authorityStatus: string };
  }>(`/admin/distributors/${userId}/status`, { status });
  return response.data.data;
}

export async function deleteAdminDistributor(userId: string) {
  const response = await api.delete<{
    success: boolean;
    message: string;
    data?: Record<string, number>;
  }>(`/admin/distributors/${userId}`);
  return response.data;
}

export async function createAdminDistributor(payload: {
  name: string;
  email: string;
  phone?: string;
  wardNo: string;
  ward: string;
  division?: string;
  district?: string;
  upazila?: string;
  unionName?: string;
  officeAddress?: string;
  authorityMonths?: number;
}) {
  const response = await api.post<{
    data: {
      user: Record<string, unknown>;
      credentialEmailSent?: boolean;
      emailReason?: string | null;
      emailPreviewUrl?: string | null;
      loginEmail?: string;
      credentialSentTo?: string | null;
      temporaryPassword?: string;
      mustChangePassword?: boolean;
    };
  }>("/admin/distributors/create", payload);
  return response.data.data;
}

export async function adminResetDistributorPassword(
  userId: string,
  newPassword: string,
) {
  const response = await api.patch<{
    success: boolean;
    message: string;
    data?: {
      credentialEmailSent?: boolean;
      emailReason?: string | null;
      emailPreviewUrl?: string | null;
      securityAlertEmailSent?: boolean;
      securityEmailReason?: string | null;
      loginEmail?: string;
      credentialSentTo?: string | null;
      temporaryPassword?: string;
      mustChangePassword?: boolean;
    };
  }>(`/admin/distributors/${userId}/reset-password`, { newPassword });
  return response.data;
}

export async function resendDistributorCredentials(userId: string) {
  const response = await api.post<{
    success: boolean;
    message: string;
    data?: {
      credentialEmailSent?: boolean;
      emailReason?: string | null;
      emailPreviewUrl?: string | null;
      loginEmail?: string;
      credentialSentTo?: string | null;
      temporaryPassword?: string;
      mustChangePassword?: boolean;
    };
  }>(`/admin/distributors/${userId}/resend-credentials`);
  return response.data;
}

export async function getAdminCardsSummary(params?: {
  division?: string;
  ward?: string;
  wardNo?: string;
}) {
  const response = await api.get<{ data: AdminCardsSummary }>(
    "/admin/cards/summary",
    { params },
  );
  return response.data.data;
}

export async function getAdminDistributionMonitoring(params?: {
  view?: "live" | "recent" | "planned" | "history" | "mismatch";
  distributorId?: string;
  division?: string;
  ward?: string;
  sessionStatus?: "Planned" | "Open" | "Paused" | "Closed" | string;
  item?: StockItem;
  mismatchOnly?: boolean;
  page?: number;
  limit?: number;
}) {
  const response = await api.get<{ data: AdminDistributionMonitoringResponse }>(
    "/admin/distribution/monitoring",
    { params },
  );
  return response.data.data;
}

export async function applyAdminAlertAction(
  alertId: string,
  payload: {
    action:
      | "acknowledge"
      | "under_review"
      | "pause_session"
      | "stop_session"
      | "request_audit";
    note?: string;
    sessionId?: string;
    distributorId?: string;
  },
) {
  const response = await api.patch<{
    data: {
      alertId: string;
      action: string;
      session: { id: string; status: string; dateKey: string } | null;
    };
  }>(`/admin/alerts/${alertId}/action`, payload);
  return response.data.data;
}

export async function forceCloseAdminDistributionSession(
  sessionId: string,
  reason?: string,
) {
  const response = await api.patch<{
    data: { session: DistributionSession };
  }>(`/admin/distribution/session/${sessionId}/force-close`, { reason });
  return response.data.data;
}

export async function getAdminConsumerReview(params?: {
  limit?: number;
  division?: string;
  ward?: string;
  wardNo?: string;
  status?: string;
  familyFlag?: boolean;
  blacklistStatus?: "None" | "Temp" | "Permanent";
  cardStatus?: "Active" | "Inactive" | "Revoked";
  qrStatus?: "Valid" | "Invalid" | "Revoked" | "Expired";
  mismatchOnly?: boolean;
  auditNeeded?: boolean;
  search?: string;
}) {
  const response = await api.get<{ data: { rows: AdminConsumerReviewRow[] } }>(
    "/admin/consumers/review",
    { params },
  );
  return response.data.data;
}

export async function reissueConsumerCard(consumerId: string) {
  const response = await api.post<{
    data: {
      consumerId: string;
      consumerCode: string;
      qrCodeId: string;
      qrToken: string;
      validTo: string;
    };
  }>(`/consumers/${consumerId}/card/reissue`);
  return response.data.data;
}

export async function getAdminAuditDetail(auditId: string) {
  const response = await api.get<{
    data: {
      log: AuditLogEntry;
      consumer?: Consumer;
    };
  }>(`/admin/audit/${auditId}/detail`);
  return response.data.data;
}

export async function getAdminAuditLogs(params?: {
  page?: number;
  limit?: number;
  severity?: AuditSeverity;
  action?: string;
  from?: string;
  to?: string;
}) {
  const response = await api.get<{
    data: { logs: AuditLogEntry[]; pagination: PaginationData };
  }>("/admin/audit", { params });
  return response.data.data;
}

export async function requestAuditReport(payload: {
  distributorUserId: string;
  auditLogId?: string;
  note?: string;
}) {
  const response = await api.post<{ data: { request: AuditReportRequest } }>(
    "/admin/audit/requests",
    payload,
  );
  return response.data.data;
}

export async function getAdminAuditRequests() {
  const response = await api.get<{ data: { items: AuditReportRequest[] } }>(
    "/admin/audit/requests",
  );
  return response.data.data;
}

export async function reviewAuditReportRequest(
  requestId: string,
  payload: {
    decision: "Approved" | "Rejected" | "Suspended" | "ReRequested";
    note?: string;
  },
) {
  const response = await api.patch<{ data: { request: AuditReportRequest } }>(
    `/admin/audit/requests/${requestId}/review`,
    payload,
  );
  return response.data.data;
}

export async function getReportSummary() {
  const response = await api.get<{
    totalTokens: number;
    usedTokens: number;
    mismatches: number;
  }>("/reports/summary");
  return response.data;
}

export async function getDistributionReport(params?: {
  from?: string;
  to?: string;
  search?: string;
  mismatch?: "true" | "false";
  status?: TokenStatus;
  division?: string;
  ward?: string;
  wardNo?: string;
  sessionId?: string;
  sessionCode?: string;
  distributorId?: string;
  consumerCode?: string;
  consumerName?: string;
  item?: StockItem;
  mismatchReason?: string;
  sortBy?: "createdAt" | "tokenCode" | "expectedKg" | "actualKg";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}) {
  const response = await api.get<{
    data: {
      rows: DistributionReportRow[];
      totals?: {
        expectedKg: number;
        actualKg: number;
        differenceKg?: number;
        mismatches: number;
        itemWise?: Record<
          StockItem,
          { expectedKg: number; actualKg: number; differenceKg?: number }
        >;
      };
      scope?: {
        division?: string;
        ward?: string;
        distributorId?: string | null;
      };
      pagination: PaginationData;
    };
  }>("/reports/distribution", { params });
  return response.data.data;
}

export async function exportDistributionReport(params?: {
  from?: string;
  to?: string;
  division?: string;
  ward?: string;
  wardNo?: string;
  format?: "csv" | "xlsx";
}) {
  const format = params?.format || "csv";
  const response = await api.get("/reports/export", {
    params: { ...params, format },
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function getTokenAnalytics(params?: { from?: string; to?: string }) {
  const response = await api.get<{ data: TokenAnalytics }>("/reports/tokens", {
    params,
  });
  return response.data.data;
}

export async function getAuditLogs(params?: {
  page?: number;
  limit?: number;
  severity?: AuditSeverity;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  sortOrder?: "asc" | "desc";
}) {
  const response = await api.get<{
    data: { logs: AuditLogEntry[]; pagination: PaginationData };
  }>("/reports/audit-logs", { params });
  return response.data.data;
}

export async function exportAuditLogsCsv(params?: {
  severity?: AuditSeverity;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  sortOrder?: "asc" | "desc";
}) {
  const response = await api.get("/reports/audit-logs", {
    params: { ...params, format: "csv" },
    responseType: "blob",
  });

  return response.data as Blob;
}

export async function getMonitoringSummary() {
  const response = await api.get<{ data: MonitoringSummary }>(
    "/monitoring/summary",
  );
  return response.data.data;
}

export async function getBlacklistEntries(params?: {
  page?: number;
  limit?: number;
  status?: "Active" | "Inactive";
  targetType?: "Consumer" | "Distributor";
}) {
  const response = await api.get<{
    data: { entries: MonitoringBlacklistEntry[]; pagination: PaginationData };
  }>("/monitoring/blacklist", {
    params,
  });
  return response.data.data;
}

export async function createBlacklistEntry(payload: {
  targetType: "Consumer" | "Distributor";
  targetRefId: string;
  blockType: "Temporary" | "Permanent";
  reason: string;
  active: boolean;
  expiresAt?: string;
}) {
  const response = await api.post<{
    data: { entry: MonitoringBlacklistEntry };
  }>("/monitoring/blacklist", payload);
  return unwrap<{ entry: MonitoringBlacklistEntry }>(response);
}

export async function updateBlacklistEntry(
  entryId: string,
  payload: Partial<{
    blockType: "Temporary" | "Permanent";
    reason: string;
    active: boolean;
    expiresAt?: string;
  }>,
) {
  const response = await api.patch<{
    data: { entry: MonitoringBlacklistEntry };
  }>(`/monitoring/blacklist/${entryId}`, payload);
  return unwrap<{ entry: MonitoringBlacklistEntry }>(response);
}

export async function deactivateBlacklistEntry(entryId: string) {
  const response = await api.post<{
    data: { entry: MonitoringBlacklistEntry };
  }>(`/monitoring/blacklist/${entryId}/deactivate`);
  return unwrap<{ entry: MonitoringBlacklistEntry }>(response);
}

export async function getOfflineQueue(params?: {
  page?: number;
  limit?: number;
  status?: "Pending" | "Synced" | "Failed";
}) {
  const response = await api.get<{
    data: { items: OfflineQueueItem[]; pagination: PaginationData };
  }>("/monitoring/offline-queue", { params });
  return response.data.data;
}

export async function createOfflineQueue(payload: Record<string, unknown>) {
  const response = await api.post<{ data: { item: OfflineQueueItem } }>(
    "/monitoring/offline-queue",
    { payload },
  );
  return unwrap<{ item: OfflineQueueItem }>(response);
}

export async function syncOfflineQueueItem(itemId: string) {
  const response = await api.post<{ data: { item: OfflineQueueItem } }>(
    `/monitoring/offline-queue/${itemId}/sync`,
  );
  return unwrap<{ item: OfflineQueueItem }>(response);
}

export async function syncAllOfflineQueue() {
  const response = await api.post<{
    data: { syncedCount: number; failedCount?: number };
  }>(
    "/monitoring/offline-queue/sync-all",
  );
  return response.data.data;
}

export async function getDistributorAuditRequests() {
  const response = await api.get<{ data: { items: AuditReportRequest[] } }>(
    "/distributor/audit-requests",
  );
  return response.data.data;
}

export async function submitAuditReport(
  requestId: string,
  reportText: string,
  files?: File[],
) {
  const formData = new FormData();
  formData.append("reportText", reportText);
  (files || []).forEach((file) => formData.append("files", file));

  const response = await api.post<{ data: { request: AuditReportRequest } }>(
    `/distributor/audit-requests/${requestId}/submit`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
}

export async function downloadAdminAuditRequestFile(
  requestId: string,
  fileId: string,
): Promise<Blob> {
  const response = await api.get(`/admin/audit/requests/${requestId}/files/${fileId}`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function downloadDistributorAuditRequestFile(
  requestId: string,
  fileId: string,
): Promise<Blob> {
  const response = await api.get(
    `/distributor/audit-requests/${requestId}/files/${fileId}`,
    { responseType: "blob" },
  );
  return response.data as Blob;
}

export async function resolveOfflineQueueItem(
  itemId: string,
  action: "discard" | "markSynced",
) {
  const response = await api.patch<{ data: { item: OfflineQueueItem } }>(
    `/monitoring/offline-queue/${itemId}/resolve`,
    { action },
  );
  return unwrap<{ item: OfflineQueueItem }>(response);
}

export async function getDistributorSettings() {
  const response = await api.get<{
    data: {
      isAdmin?: boolean;
      settings: DistributorSettings | Array<{ key: string; value: unknown }>;
      profile?: SettingsProfile;
    };
  }>("/settings");
  return response.data.data;
}

export async function getDistributorDashboardSummary() {
  const response = await api.get<DistributorDashboardSummary>(
    "/distributor/dashboard",
  );
  return response.data;
}

export async function updateDistributorSettings(payload: DistributorSettings) {
  const response = await api.put<{ data: { settings: DistributorSettings } }>(
    "/settings",
    payload,
  );
  return unwrap<{ settings: DistributorSettings }>(response);
}

export async function resetDistributorSettings() {
  const response = await api.post<{
    data: { settings: DistributorSettings };
  }>("/settings/reset");
  return response.data.data;
}

export async function updateMyProfile(payload: SettingsProfile) {
  const response = await api.put<{ data: { user: SettingsProfile } }>(
    "/settings/profile",
    payload,
  );
  return response.data.data;
}

export async function changeMyPassword(payload: {
  currentPassword: string;
  newPassword: string;
}) {
  const response = await api.put<{
    data: { updated?: boolean; token?: string };
  }>(
    "/settings/password",
    payload,
  );
  return response.data.data;
}

export async function getNotifications(params?: {
  page?: number;
  limit?: number;
  status?: "Unread" | "Read";
}) {
  const response = await api.get<{
    data: { items: NotificationItem[]; pagination: PaginationData };
  }>("/notifications", { params });
  return response.data.data;
}

export async function getUnreadNotificationCount() {
  const response = await api.get<{ data: { unreadCount: number } }>(
    "/notifications/unread-count",
  );
  return response.data.data.unreadCount;
}

export async function markNotificationAsRead(notificationId: string) {
  const response = await api.patch<{ data: { item: NotificationItem } }>(
    `/notifications/${notificationId}/read`,
  );
  return response.data.data;
}

export async function markAllNotificationsAsRead() {
  const response = await api.patch<{ data: { updated: number } }>(
    "/notifications/read-all",
  );
  return response.data.data;
}

export async function deleteNotification(notificationId: string) {
  const response = await api.delete<{
    success: boolean;
    message: string;
  }>(`/notifications/${notificationId}`);
  return response.data;
}

export async function clearAllNotifications() {
  const response = await api.delete<{
    success: boolean;
    message: string;
    data: { deleted: number };
  }>("/notifications/clear-all");
  return response.data;
}

export async function clearReadNotifications() {
  const response = await api.delete<{
    success: boolean;
    message: string;
    data: { deleted: number };
  }>("/notifications/clear-read");
  return response.data;
}

export async function setupAdmin2FA(payload?: { password?: string }) {
  const response = await api.post<{
    data: { secret: string; message?: string };
  }>("/auth/2fa/setup", payload || {});
  return response.data.data;
}

export async function getAdmin2FAStatus() {
  const response = await api.get<{ data: Admin2FAStatus }>("/auth/2fa/status");
  return response.data.data;
}

export async function resetAdmin2FASetup() {
  const response = await api.post<{
    data: { secret: string; message?: string };
  }>("/auth/2fa/setup/reset", {
    confirmText: "CHANGE_2FA_SECRET",
  });
  return response.data.data;
}

export async function verifyAdmin2FA(token: string) {
  const response = await api.post<{
    success: boolean;
    message?: string;
    data?: { backupCodes?: string[] };
  }>("/auth/2fa/verify", { token });
  return response.data;
}

export async function disableAdmin2FA(payload: {
  password: string;
  totpToken?: string;
  emergencyConfirm?: string;
}) {
  const response = await api.post<{ success: boolean; message?: string }>(
    "/auth/2fa/disable",
    payload,
  );
  return response.data;
}

// Bulk Register
export async function bulkRegisterUpload(file: File, dryRun: boolean) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<{
    data: BulkRegisterUploadResponse;
  }>(`/bulk-register/upload?dryRun=${dryRun ? "true" : "false"}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
}

export async function bulkRegisterTemplate(): Promise<Blob> {
  const headers = [
    "name",
    "nidNumber",
    "fatherNidNumber",
    "motherNidNumber",
    "phone",
    "wardNumber",
    "unionName",
    "upazila",
    "district",
    "division",
    "category",
    "memberCount",
    "guardianName",
  ];
  const sample = [
    [
      "রহিম উদ্দিন",
      "1234567890",
      "1234500001",
      "1234500002",
      "01712345678",
      "1",
      "Tetuljhora",
      "Savar",
      "Dhaka",
      "Dhaka",
      "A",
      "4",
      "",
    ],
  ];
  const lines = [headers.join(","), ...sample.map((r) => r.join(","))].join("\n");
  return new Blob([`\uFEFF${lines}`], { type: "text/csv;charset=utf-8" });
}

// QR Rotation
export async function triggerQRRotation() {
  const response = await api.post<{ data: { rotated: number; failed: number } }>(
    "/qr-rotation/trigger",
  );
  return response.data.data;
}

export async function forceResetAllQRCodes() {
  const response = await api.post<{
    data: { total: number; updated: number; failed: number; failedIds?: string[] };
  }>("/qr-rotation/force-reset-all");
  return response.data.data;
}

export async function regenerateConsumerQR(consumerId: string) {
  const response = await api.post<{ data: { newQrPayload: string; validTo: string } }>(
    `/qr-rotation/regenerate/${consumerId}`,
  );
  return response.data.data;
}

// Fraud Score
export async function getFraudReport(days = 30) {
  const response = await api.get<{ data: { summary: Record<string, number>; distributors: unknown[] } }>(
    "/fraud-score/report",
    { params: { days } },
  );
  return response.data.data;
}

export async function getDistributorFraudScore(distributorId: string, days = 30) {
  const response = await api.get<{ data: unknown }>(
    `/fraud-score/distributor/${distributorId}`,
    { params: { days } },
  );
  return response.data.data;
}

export async function getTopRiskyDistributors(limit = 5, days = 30) {
  const response = await api.get<{ data: unknown[] }>("/fraud-score/top-risky", {
    params: { limit, days },
  });
  return response.data.data;
}

export async function getDistributorMonthlyPerf(
  distributorId: string,
  year?: number,
  month?: number,
) {
  try {
    const response = await api.get<{ data: MonthlyPerformanceRow }>(
      `/fraud-score/monthly/${distributorId}`,
      { params: { year, month } },
    );
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const fallbackYear = year || new Date().getFullYear();
      const fallbackMonth = month || new Date().getMonth() + 1;
      return {
        distributorId,
        distributorName: "N/A",
        year: fallbackYear,
        month: fallbackMonth,
        monthName: "",
        totalSessions: 0,
        totalDistributions: 0,
        mismatchCount: 0,
        mismatchRate: 0,
        iotVerifiedCount: 0,
        iotRate: 0,
        fraudScore: 0,
        riskLevel: "LOW",
        rating: 1,
        badge: "N/A",
        generatedAt: new Date().toISOString(),
      } as MonthlyPerformanceRow;
    }
    throw error;
  }
}

export async function getAllMonthlyPerf(year?: number, month?: number) {
  try {
    const response = await api.get<{
      data: {
        distributors: MonthlyPerformanceRow[];
        summary: {
          totalDistributors: number;
          avgRating: number;
          topPerformer: MonthlyPerformanceRow | null;
          worstPerformer: MonthlyPerformanceRow | null;
        };
      };
    }>("/fraud-score/monthly-all", { params: { year, month } });
    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return {
        distributors: [],
        summary: {
          totalDistributors: 0,
          avgRating: 0,
          topPerformer: null,
          worstPerformer: null,
        },
      };
    }
    throw error;
  }
}

// Receipts
export async function downloadReceipt(tokenCode: string): Promise<Blob> {
  const response = await api.get(`/receipts/${tokenCode}`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function generateReceipt(tokenId: string) {
  const response = await api.post<{ data: { filePath: string; tokenCode: string } }>(
    `/receipts/generate/${tokenId}`,
  );
  return response.data.data;
}

// Photos
export async function uploadConsumerPhoto(consumerId: string, file: File) {
  const formData = new FormData();
  formData.append("photo", file);
  const response = await api.post<{ data: { photoUrl: string } }>(
    `/photos/upload/${consumerId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
}

export async function getConsumerPhotoVerify(consumerId: string) {
  const response = await api.get<{
    data: {
      name: string;
      consumerCode: string;
      category: string;
      ward: string;
      photoUrl: string | null;
      hasPhoto: boolean;
    };
  }>(`/photos/verify/${consumerId}`);
  return response.data.data;
}

// Complaints
export async function submitComplaint(data: object) {
  const response = await axios.post<{ data: { complaintId: string } }>(
    `${API_BASE_URL}/complaints`,
    data,
  );
  return response.data.data;
}

export async function getComplaints(params?: object) {
  const response = await api.get<{
    data: {
      items: ComplaintItemRow[];
      pagination: PaginationData;
    };
  }>("/complaints", { params });
  return response.data.data;
}

export async function resolveComplaint(complaintId: string, data: object) {
  const response = await api.patch<{ data: Record<string, unknown> }>(
    `/complaints/${complaintId}/resolve`,
    data,
  );
  return response.data.data;
}

export async function getComplaintStats() {
  const response = await api.get<{ data: ComplaintStats }>("/complaints/stats");
  return response.data.data;
}

// Blacklist Appeals
export async function submitAppeal(data: {
  consumerId?: string;
  consumerCode?: string;
  consumerPhone?: string;
  reason: string;
  supportingInfo?: string;
  attachments?: File[];
}) {
  const formData = new FormData();
  if (data.consumerId) formData.append("consumerId", data.consumerId);
  if (data.consumerCode) formData.append("consumerCode", data.consumerCode);
  if (data.consumerPhone) formData.append("consumerPhone", data.consumerPhone);
  formData.append("reason", data.reason);
  if (data.supportingInfo) formData.append("supportingInfo", data.supportingInfo);
  for (const file of data.attachments || []) {
    formData.append("attachments", file);
  }

  const response = await api.post<{ data: { appealId: string } }>(
    "/appeals",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data.data;
}

export async function getAppeals(params?: {
  page?: number;
  limit?: number;
  status?: AppealStatus | "";
  startDate?: string;
  endDate?: string;
  division?: string;
  ward?: string;
}) {
  const response = await api.get<{
    data: { items: AppealItem[]; pagination: PaginationData };
  }>("/appeals", { params });
  return response.data.data;
}

export async function reviewAppeal(appealId: string, data: object) {
  const response = await api.patch<{ data: { decision: string } }>(
    `/appeals/${appealId}/review`,
    data,
  );
  return response.data.data;
}

export async function downloadAppealAttachment(
  appealId: string,
  fileId: string,
): Promise<Blob> {
  const response = await api.get(`/appeals/${appealId}/files/${fileId}`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

// Eligibility
export async function getInactiveConsumers(params?: object) {
  const response = await api.get<{
    data: { items: Array<Record<string, unknown>>; pagination: PaginationData };
  }>("/eligibility/inactive", { params });
  return response.data.data;
}

export async function reactivateConsumer(consumerId: string) {
  const response = await api.patch<{ data: { consumerId: string } }>(
    `/eligibility/${consumerId}/reactivate`,
  );
  return response.data.data;
}

export async function deactivateConsumer(consumerId: string) {
  const response = await api.patch<{ data: { consumerId: string } }>(
    `/eligibility/${consumerId}/deactivate`,
  );
  return response.data.data;
}

export async function getEligibilityStats() {
  const response = await api.get<{
    data: {
      active: number;
      inactive_review: number;
      suspended: number;
      blacklisted: number;
    };
  }>("/eligibility/stats");
  return response.data.data;
}

export async function runEligibilityNow() {
  const response = await api.post<{ data: { flagged: number; alreadyFlagged: number } }>(
    "/eligibility/flag-now",
  );
  return response.data.data;
}

// Session Health
export function openSessionHealthSSE(
  sessionId: string,
  onData: (data: Record<string, unknown>) => void,
  onError: () => void,
): EventSource {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  let token = "";
  if (stored) {
    try {
      token = JSON.parse(stored)?.token || "";
    } catch {
      token = "";
    }
  }

  const url = `${API_BASE_URL}/session-health/${sessionId}/live${token ? `?token=${encodeURIComponent(token)}` : ""}`;
  const eventSource = new EventSource(url);
  eventSource.onmessage = (event) => {
    try {
      onData(JSON.parse(event.data));
    } catch {
      onError();
    }
  };
  eventSource.onerror = () => onError();
  return eventSource;
}

export async function downloadReconciliationReport(sessionId: string): Promise<Blob> {
  const response = await api.get(`/session-health/${sessionId}/report`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function generateReconciliationReport(sessionId: string) {
  const response = await api.post<{ data: { filePath: string } }>(
    `/session-health/${sessionId}/generate-report`,
  );
  return response.data.data;
}

// Stock Suggestion
export async function getSystemStockSuggestion(item?: StockItem) {
  const response = await api.get<{
    data: {
      wards: StockSuggestionResult[];
      item?: StockItem | "all";
      systemTotal: {
        movingAverage: number;
        suggestedStock: number;
        distributedAverage?: number;
        insertedAverage?: number;
        averageAccuracyPercent?: number;
      };
      generatedAt: string;
    };
  }>("/stock-suggestion/system", {
    params: { item: item || undefined },
  });
  return response.data.data;
}

export async function getWardStockSuggestion(
  division: string,
  ward: string,
  union?: string,
  item?: StockItem,
) {
  const response = await api.get<{ data: StockSuggestionResult }>(
    "/stock-suggestion/ward",
    { params: { division, ward, union, item: item || undefined } },
  );
  return response.data.data;
}

export async function deleteConsumerCard(consumerId: string) {
  const response = await api.delete<{
    data: {
      consumerId: string;
      consumerCode: string;
      removedCardId: string;
    };
  }>(`/consumers/${consumerId}/card`);
  return response.data.data;
}

export async function getSimpleStockSuggestion(item?: StockItem) {
  const response = await api.get<{
    data: {
      item?: StockItem | "all";
      movingAverage: number;
      suggestedStock: number;
      distributedAverage?: number;
      insertedAverage?: number;
      averageAccuracyPercent?: number;
      trend: "increasing" | "decreasing" | "stable";
      trendBangla: string;
      sampleSessions: number;
      generatedAt: string;
    };
  }>("/stock-suggestion/simple", {
    params: { item: item || undefined },
  });
  return response.data.data;
}

// Queue
export async function joinQueue(sessionId: string, consumerId: string) {
  const response = await api.post<{
    data: {
      queueNumber: number;
      position: number;
      estimatedWaitMinutes: number;
      queueEntryId: string;
      status: string;
    };
  }>("/queue/join", { sessionId, consumerId });
  return response.data.data;
}

export async function getQueueStatus(sessionId: string) {
  const response = await api.get<{ data: QueueStatus }>(`/queue/status/${sessionId}`);
  return response.data.data;
}

export async function callNextInQueue(sessionId: string) {
  const response = await api.patch<{ data: QueueStatus }>(`/queue/call-next/${sessionId}`);
  return response.data.data;
}

export async function skipQueueEntry(entryId: string) {
  const response = await api.patch<{ data: QueueStatus }>(`/queue/skip/${entryId}`);
  return response.data.data;
}

export async function getSessionQueueEntries(sessionId: string, page = 1, limit = 20) {
  const response = await api.get<{
    data: {
      session?: {
        sessionId: string;
        sessionCode?: string;
        sessionDate?: string;
        sessionStatus?: string;
        division?: string;
        ward?: string;
        distributorId?: string;
        distributorName?: string;
      };
      summary?: {
        total: number;
        waiting: number;
        serving: number;
        served: number;
        skipped: number;
        mismatchCount: number;
        remaining: number;
      };
      items: QueueEntryRow[];
      pagination: PaginationData;
    };
  }>(`/queue/session/${sessionId}`, { params: { page, limit } });
  return response.data.data;
}

export default api;

// ==================== IoT Admin ====================
export type IotProductTargets = {
  p1Kg: number;
  p2Kg: number;
  p3Kg: number;
  productNames: [string, string, string];
};

export type IotWeightAlert = {
  _id: string;
  product: "P1" | "P2" | "P3";
  productName: string;
  expectedKg: number;
  measuredKg: number;
  diffG: number;
  deviceId: string;
  acknowledged: boolean;
  createdAt: string;
};

export async function getIotProductTargets(distributorId?: string): Promise<IotProductTargets> {
  const url = distributorId
    ? `/admin/iot/product-targets/${encodeURIComponent(distributorId)}`
    : "/admin/iot/product-targets";
  const response = await api.get<{ data: IotProductTargets }>(url);
  return response.data.data;
}

export async function setIotProductTargets(
  payload: {
    p1Kg: number;
    p2Kg: number;
    p3Kg: number;
    productNames: [string, string, string];
  },
  distributorId?: string,
): Promise<IotProductTargets> {
  const url = distributorId
    ? `/admin/iot/product-targets/${encodeURIComponent(distributorId)}`
    : "/admin/iot/product-targets";
  const response = await api.put<{ data: IotProductTargets }>(url, payload);
  return response.data.data;
}

export async function getIotWeightAlerts(params?: {
  limit?: number;
  unacknowledged?: boolean;
}): Promise<IotWeightAlert[]> {
  const response = await api.get<{ data: IotWeightAlert[] }>("/admin/iot/weight-alerts", { params });
  return response.data.data;
}

export async function acknowledgeIotWeightAlert(id: string): Promise<IotWeightAlert> {
  const response = await api.patch<{ data: IotWeightAlert }>(`/admin/iot/weight-alerts/${id}/acknowledge`);
  return response.data.data;
}

// ─── Field Distributor Applications ─────────────────────────────────────────

export type FieldApplication = {
  _id: string;
  name: string;
  email: string | null;
  phone: string | null;
  wardNo: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  unionName: string | null;
  ward: string | null;
  authorityStatus: "Pending" | "Active" | "Revoked" | "Suspended";
  status: "Active" | "Inactive" | "Suspended";
  createdAt: string;
  mustChangePassword?: boolean;
};

export type FieldApplicationsResponse = {
  applications: FieldApplication[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export async function getFieldApplications(params?: {
  status?: "Pending" | "Active" | "Revoked";
  page?: number;
  limit?: number;
}): Promise<FieldApplicationsResponse> {
  const response = await api.get<{ success: boolean; data: FieldApplicationsResponse }>(
    "/distributor/field-applications",
    { params },
  );
  return response.data.data;
}

export async function approveFieldApplication(userId: string): Promise<{
  userId: string;
  name: string;
  email: string | null;
  emailSent: boolean;
}> {
  const response = await api.post<{
    success: boolean;
    data: { userId: string; name: string; email: string | null; emailSent: boolean };
  }>(`/distributor/field-applications/${userId}/approve`);
  return response.data.data;
}

export async function rejectFieldApplication(userId: string, reason?: string): Promise<void> {
  await api.post(`/distributor/field-applications/${userId}/reject`, { reason: reason || "" });
}
