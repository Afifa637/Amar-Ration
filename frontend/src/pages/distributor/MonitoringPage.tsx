import { useEffect, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import api from "../../services/api";

type BlacklistItem = {
  _id: string;
  entityType?: "Consumer" | "Distributor";
  entityId?: string;
  reason?: string;
  active?: boolean;
};

type OfflineItem = {
  _id: string;
  createdAt?: string;
  tokenCode?: string;
  consumerId?: string;
  status?: string;
};

type SessionItem = {
  _id: string;
  status?: string;
  createdAt?: string;
};

type CriticalLog = {
  _id: string;
  action?: string;
  severity?: string;
  createdAt?: string;
};

type AuditLog = {
  _id: string;
  action?: string;
  timestamp?: string;
  details?: string;
};

type MonitoringResponse = {
  offline: OfflineItem[];
  sessions: SessionItem[];
  criticalLogs: CriticalLog[];
};

type AuditResponse = {
  logs: AuditLog[];
  blacklist: BlacklistItem[];
};

export default function MonitoringPage() {
  const [monitoring, setMonitoring] = useState<MonitoringResponse>({
    offline: [],
    sessions: [],
    criticalLogs: [],
  });
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [openReview, setOpenReview] = useState<BlacklistItem | null>(null);
  const [error, setError] = useState("");

  async function loadMonitoring() {
    try {
      setError("");
      const [monitoringRes, auditRes] = await Promise.all([
        api.get("/distributor/monitoring") as Promise<MonitoringResponse>,
        api.get("/distributor/audit") as Promise<AuditResponse>,
      ]);

      setMonitoring(monitoringRes);
      setBlacklist(auditRes.blacklist || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড করা যায়নি");
    }
  }

  useEffect(() => {
    (async () => {
      await loadMonitoring();
    })();
  }, []);

  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-red-600">{error}</div>}

      <PortalSection title="সিস্টেম মনিটরিং সারাংশ">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="border p-3 bg-[#f0fdf4]">
            <div className="text-[12px]">সিস্টেম স্ট্যাটাস</div>
            <div className="text-[18px] font-bold text-green-700">
              স্বাভাবিক
            </div>
          </div>

          <div className="border p-3 bg-[#fff7ed]">
            <div className="text-[12px]">সতর্কতা</div>
            <div className="text-[18px] font-bold">
              {monitoring.criticalLogs.length}
            </div>
          </div>

          <div className="border p-3 bg-[#fef2f2]">
            <div className="text-[12px]">ক্রিটিকাল ইস্যু</div>
            <div className="text-[18px] font-bold text-red-600">
              {
                monitoring.criticalLogs.filter((x) => x.severity === "Critical")
                  .length
              }
            </div>
          </div>

          <div className="border p-3 bg-[#eff6ff]">
            <div className="text-[12px]">Offline Queue</div>
            <div className="text-[18px] font-bold">
              {monitoring.offline.length}
            </div>
          </div>
        </div>
      </PortalSection>

      <PortalSection
        title="ব্ল্যাকলিস্ট মনিটরিং (Fraud Control)"
        right={
          <Button variant="secondary" onClick={loadMonitoring}>
            🔄 রিফ্রেশ
          </Button>
        }
      >
        <div className="border rounded overflow-hidden bg-white">
          <table className="w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">টাইপ</th>
                <th className="border p-2">আইডি</th>
                <th className="border p-2">কারণ</th>
                <th className="border p-2">স্ট্যাটাস</th>
                <th className="border p-2">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {blacklist.map((b) => (
                <tr key={b._id}>
                  <td className="border p-2 text-center">
                    {b.entityType || "-"}
                  </td>
                  <td className="border p-2 text-center">
                    {b.entityId || "-"}
                  </td>
                  <td className="border p-2">{b.reason || "-"}</td>
                  <td className="border p-2 text-center">
                    {b.active ? (
                      <Badge tone="red">Blocked</Badge>
                    ) : (
                      <Badge tone="gray">Inactive</Badge>
                    )}
                  </td>
                  <td className="border p-2">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" onClick={() => setOpenReview(b)}>
                        👁️ পর্যালোচনা
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {blacklist.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="border p-4 text-center text-[#6b7280]"
                  >
                    কোনো ব্ল্যাকলিস্ট নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PortalSection>

      <PortalSection
        title="Offline Distribution Sync Queue"
        right={<Button onClick={loadMonitoring}>🔄 Sync Now</Button>}
      >
        {monitoring.offline.length === 0 ? (
          <div className="text-[12px] text-[#374151]">
            কোনো Pending Offline ডেটা নেই।
          </div>
        ) : (
          <div className="border rounded overflow-hidden bg-white">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f8fafc]">
                <tr>
                  <th className="border p-2">সময়</th>
                  <th className="border p-2">রেফারেন্স</th>
                  <th className="border p-2">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {monitoring.offline.map((o) => (
                  <tr key={o._id}>
                    <td className="border p-2 text-center">
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleString("bn-BD")
                        : "-"}
                    </td>
                    <td className="border p-2 text-center">
                      {o.tokenCode || o.consumerId || "-"}
                    </td>
                    <td className="border p-2 text-center">
                      <Badge tone="yellow">{o.status || "Pending Sync"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalSection>

      <PortalSection title="সাম্প্রতিক সেশন ও ক্রিটিকাল লগ">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border rounded p-3 bg-white">
            <div className="font-semibold mb-2">সেশন</div>
            <div className="space-y-2">
              {monitoring.sessions.length > 0 ? (
                monitoring.sessions.map((s) => (
                  <div key={s._id} className="border rounded p-2 text-[12px]">
                    <div>ID: {s._id}</div>
                    <div>Status: {s.status || "-"}</div>
                  </div>
                ))
              ) : (
                <div className="text-[12px] text-[#6b7280]">কোনো সেশন নেই।</div>
              )}
            </div>
          </div>

          <div className="border rounded p-3 bg-white">
            <div className="font-semibold mb-2">Critical Logs</div>
            <div className="space-y-2">
              {monitoring.criticalLogs.length > 0 ? (
                monitoring.criticalLogs.map((c) => (
                  <div key={c._id} className="border rounded p-2 text-[12px]">
                    <div>{c.action || "-"}</div>
                    <div className="text-[#6b7280]">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleString("bn-BD")
                        : "-"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[12px] text-[#6b7280]">
                  কোনো critical log নেই।
                </div>
              )}
            </div>
          </div>
        </div>
      </PortalSection>

      <Modal
        open={!!openReview}
        title="ব্ল্যাকলিস্ট রিভিউ"
        onClose={() => setOpenReview(null)}
      >
        {openReview && (
          <div className="space-y-2 text-[13px]">
            <div>
              <strong>টাইপ:</strong> {openReview.entityType}
            </div>
            <div>
              <strong>ID:</strong> {openReview.entityId}
            </div>
            <div>
              <strong>কারণ:</strong> {openReview.reason}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <Button variant="secondary" onClick={() => setOpenReview(null)}>
                বন্ধ
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
