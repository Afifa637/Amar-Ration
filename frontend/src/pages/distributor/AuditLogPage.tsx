import { useEffect, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import api from "../../services/api";

type AuditLog = {
  _id: string;
  createdAt: string;
  action: string;
  severity: string;
  targetType?: string;
  targetId?: string;
};

type BlacklistEntry = {
  _id: string;
  entityType: string;
  entityId: string;
  reason: string;
  active: boolean;
};

type AuditResponse = {
  logs: AuditLog[];
  blacklist: BlacklistEntry[];
};

function toneForSeverity(s: string) {
  if (s === "Critical") return "red";
  if (s === "Warning") return "yellow";
  return "green";
}

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse>({ logs: [], blacklist: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadAudit() {
    try {
      setLoading(true);
      setError("");
      const res = (await api.get("/distributor/audit")) as AuditResponse;
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAudit();
  }, []);

  return (
    <div className="space-y-3">
      <PortalSection
        title="অডিট লগ (Immutable)"
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadAudit}>
              🔄 রিফ্রেশ
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              🖨️ প্রিন্ট
            </Button>
          </div>
        }
      >
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <div className="border rounded overflow-hidden bg-white">
          <table className="w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">সময়</th>
                <th className="border p-2">ইভেন্ট</th>
                <th className="border p-2">রেফারেন্স</th>
                <th className="border p-2">গুরুত্ব</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log._id}>
                  <td className="border p-2 text-center">{new Date(log.createdAt).toLocaleString("bn-BD")}</td>
                  <td className="border p-2">{log.action}</td>
                  <td className="border p-2 text-center">{log.targetId || log.targetType || "-"}</td>
                  <td className="border p-2 text-center">
                    <Badge tone={toneForSeverity(log.severity) as "green" | "yellow" | "red"}>
                      {log.severity}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!loading && data.logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="border p-4 text-center text-[#6b7280]">
                    কোনো অডিট লগ নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 border rounded overflow-hidden bg-white">
          <div className="bg-[#f8fafc] px-3 py-2 text-[13px] font-semibold">সক্রিয় ব্ল্যাকলিস্ট</div>
          <table className="w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">Type</th>
                <th className="border p-2">ID</th>
                <th className="border p-2">Reason</th>
                <th className="border p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.blacklist.map((item) => (
                <tr key={item._id}>
                  <td className="border p-2 text-center">{item.entityType}</td>
                  <td className="border p-2 text-center">{item.entityId}</td>
                  <td className="border p-2">{item.reason}</td>
                  <td className="border p-2 text-center">
                    <Badge tone={item.active ? "red" : "gray"}>{item.active ? "Blocked" : "Inactive"}</Badge>
                  </td>
                </tr>
              ))}
              {!loading && data.blacklist.length === 0 && (
                <tr>
                  <td colSpan={4} className="border p-4 text-center text-[#6b7280]">
                    কোনো ব্ল্যাকলিস্ট এন্ট্রি নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PortalSection>
    </div>
  );
}