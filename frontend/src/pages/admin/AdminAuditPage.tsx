import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  getAuditLogs,
  getBlacklistEntries,
  type AuditLogEntry,
} from "../../services/api";

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [blacklistCount, setBlacklistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [auditData, blacklistData] = await Promise.all([
        getAuditLogs({ page: 1, limit: 50, sortOrder: "desc" }),
        getBlacklistEntries({ limit: 100 }),
      ]);
      setLogs(auditData.logs || []);
      setBlacklistCount(blacklistData.entries?.length || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "অডিট ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const auditStats = useMemo(() => {
    const alerts = logs.filter((log) =>
      ["Warning", "Critical"].includes(log.severity),
    ).length;
    const mismatches = logs.filter((log) =>
      log.action.includes("MISMATCH"),
    ).length;
    const stockAnomalies = logs.filter((log) =>
      log.action.toLowerCase().includes("stock"),
    ).length;
    return { alerts, mismatches, stockAnomalies };
  }, [logs]);

  const severityLabel = (severity: AuditLogEntry["severity"]) => {
    switch (severity) {
      case "Critical":
        return "জরুরি";
      case "Warning":
        return "সতর্কতা";
      default:
        return "তথ্য";
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> অডিট, ফ্রড ও ব্ল্যাকলিস্ট
      </div>

      <SectionCard title="অডিট সিগন্যাল সারাংশ">
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["খোলা এলার্ট", String(auditStats.alerts)],
            ["ওজন মিসম্যাচ", String(auditStats.mismatches)],
            ["স্টক অস্বাভাবিকতা", String(auditStats.stockAnomalies)],
            ["ব্ল্যাকলিস্ট সম্ভাবনা", String(blacklistCount)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]"
            >
              <div className="text-sm text-[#6b7280]">{label}</div>
              <div className="text-2xl font-bold text-[#1f2d3d] mt-1">
                {value}
              </div>
            </div>
          ))}
        </div>
        {loading && (
          <div className="text-[12px] text-[#6b7280] mt-2">লোড হচ্ছে...</div>
        )}
      </SectionCard>

      <SectionCard title="অডিট লগ (অপরিবর্তনযোগ্য)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {["সময়", "ইভেন্ট", "অ্যাক্টর", "অবস্থা"].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{log.action}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {log.actorType}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {severityLabel(log.severity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="ব্ল্যাকলিস্ট নীতি">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• ফ্রড প্রমাণিত হলে সাময়িক ব্লক করা যাবে।</li>
          <li>• বারবার ব্যর্থতায় স্থায়ী ব্ল্যাকলিস্ট হতে পারে।</li>
          <li>• ব্ল্যাকলিস্টে কারণ ও অনুমোদনকারী অ্যাডমিন আবশ্যক।</li>
          <li>• ব্ল্যাকলিস্টেড সত্তা টোকেন ইস্যু/বিতরণ করতে পারবে না।</li>
        </ul>
      </SectionCard>
    </div>
  );
}
