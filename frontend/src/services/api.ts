import axios from "axios";

const API_BASE_URL = "http://localhost:5000/api";
export const AUTH_STORAGE_KEY = "amar_ration_auth";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
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
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl: string = error?.config?.url || "";
    const isAuthCall =
      requestUrl.includes("/auth/login") || requestUrl.includes("/auth/signup");

    if (status === 401 && !isAuthCall) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      delete api.defaults.headers.common.Authorization;

      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.href = "/";
      }
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
  category: ConsumerCategory;
  status: ConsumerStatus;
  division?: string;
  district?: string;
  upazila?: string;
  unionName?: string;
  ward?: string;
  blacklistStatus?: "None" | "Temp" | "Permanent";
  createdAt: string;
};

export type TokenStatus = "Issued" | "Used" | "Cancelled" | "Expired";

export type DistributionToken = {
  _id: string;
  tokenCode: string;
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
  mismatch: boolean;
  createdAt: string;
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
  actorType: "Central Admin" | "Distributor" | "System";
  action: string;
  entityType?: string;
  entityId?: string;
  severity: AuditSeverity;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type MonitoringBlacklistEntry = {
  _id: string;
  distributorId?: string;
  createdByUserId?: string;
  targetType: "Consumer" | "Distributor";
  targetRefId: string;
  blockType: "Temporary" | "Permanent";
  reason: string;
  active: boolean;
  expiresAt?: string;
  createdAt: string;
};

export type OfflineQueueItem = {
  _id: string;
  distributorId: string;
  payload: Record<string, unknown>;
  status: "Pending" | "Synced" | "Failed";
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

export type DistributionReportRow = {
  _id: string;
  createdAt: string;
  tokenCode: string;
  tokenStatus: TokenStatus;
  expectedKg: number;
  actualKg: number;
  mismatch: boolean;
  consumerCode: string;
  consumerName: string;
  ward: string;
  category: ConsumerCategory | "";
};

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
  nidLast4: string;
  category: ConsumerCategory;
  status?: ConsumerStatus;
  ward?: string;
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
    nidLast4?: string;
    category?: ConsumerCategory;
    status?: ConsumerStatus;
    ward?: string;
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

export async function issueToken(qrPayload: string) {
  const response = await api.post<{ data: { token: DistributionToken } }>(
    "/distribution/scan",
    { qrPayload },
  );
  return unwrap<{ token: DistributionToken }>(response);
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

export async function getDistributionTokens(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: TokenStatus;
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
}) {
  const response = await api.get<{
    data: {
      records: DistributionRecord[];
      stock: { dateKey: string; stockOutKg: number };
      pagination: Pagination;
    };
  }>("/distribution/records", { params });
  return response.data.data;
}

export async function getDistributionStats() {
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
      };
    };
  }>("/distribution/stats");
  return response.data.data.stats;
}

export async function getDistributionQuickInfo() {
  const response = await api.get<{ data: SidebarQuickInfo }>(
    "/distribution/quick-info",
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
  sortBy?: "createdAt" | "tokenCode" | "expectedKg" | "actualKg";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}) {
  const response = await api.get<{
    data: { rows: DistributionReportRow[]; pagination: PaginationData };
  }>("/reports/distribution", { params });
  return response.data.data;
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
  const response = await api.patch<{
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
  const response = await api.post<{ data: { syncedCount: number } }>(
    "/monitoring/offline-queue/sync-all",
  );
  return response.data.data;
}

export async function getDistributorSettings() {
  const response = await api.get<{
    data: { settings: DistributorSettings; profile?: SettingsProfile };
  }>("/settings");
  return response.data.data;
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
  const response = await api.put<{ data: { updated: boolean } }>(
    "/settings/password",
    payload,
  );
  return response.data.data;
}

export default api;
