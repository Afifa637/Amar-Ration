import { useEffect, useState } from "react";
import FilterBar from "../../components/FilterBar";
import NotesPanel from "../../components/NotesPanel";
import api from "../../services/api";

type DashboardResponse = {
  distributor?: {
    distributorCode?: string;
    ward?: string;
    serviceArea?: string;
    status?: string;
  };
  stats: {
    totalConsumers: number;
    activeConsumers: number;
    issuedTokens: number;
    usedTokens: number;
    mismatchCount: number;
    pendingOffline: number;
    stockOutTodayKg: number;
  };
  recentAudit: Array<{
    _id: string;
    action: string;
    severity: string;
    createdAt: string;
    targetType?: string;
  }>;
};

function formatDateTime(date?: string) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString("bn-BD");
  } catch {
    return date;
  }
}

export default function DistributorDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/distributor/dashboard");
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] text-[#4b5563]">
            হোম <span className="mx-1">›</span> ড্যাশবোর্ড{" "}
            <span className="mx-1">›</span>{" "}
            <span className="font-semibold text-[#111827]">মনিটরিং সারাংশ</span>
          </div>

          <div className="text-[12px] text-[#6b7280]">
            স্ট্যাটাস:{" "}
            <span className="font-semibold text-[#111827]">
              {data?.distributor?.status || "—"}
            </span>
          </div>
        </div>
      </div>

      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            ড্যাশবোর্ড ফিল্টার (লোকেশন/ডিলার নির্বাচন)
          </h2>
        </div>
        <div className="p-3">
          <FilterBar />
        </div>
      </section>

      {loading && (
        <div className="bg-white border border-[#d7dde6] rounded p-4 text-sm">
          লোড হচ্ছে...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <section className="bg-white border border-[#d7dde6] rounded">
            <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6] flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[#1f2d3d]">সারাংশ (KPI টাইল)</h2>
              <button
                onClick={loadDashboard}
                className="text-[12px] px-3 py-1 rounded bg-[#16679c] text-white"
              >
                রিফ্রেশ
              </button>
            </div>

            <div className="p-3 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="border border-[#d7dde6] rounded p-3 bg-[#eef6ff]">
                <div className="text-[12px] text-[#374151]">মোট উপকারভোগী</div>
                <div className="text-[24px] font-bold">{data.stats.totalConsumers}</div>
              </div>
              <div className="border border-[#d7dde6] rounded p-3 bg-[#ecfdf5]">
                <div className="text-[12px] text-[#374151]">সক্রিয় উপকারভোগী</div>
                <div className="text-[24px] font-bold">{data.stats.activeConsumers}</div>
              </div>
              <div className="border border-[#d7dde6] rounded p-3 bg-[#eff6ff]">
                <div className="text-[12px] text-[#374151]">ইস্যুকৃত টোকেন</div>
                <div className="text-[24px] font-bold">{data.stats.issuedTokens}</div>
              </div>
              <div className="border border-[#d7dde6] rounded p-3 bg-[#f0fdf4]">
                <div className="text-[12px] text-[#374151]">ব্যবহৃত টোকেন</div>
                <div className="text-[24px] font-bold">{data.stats.usedTokens}</div>
              </div>
              <div className="border border-[#d7dde6] rounded p-3 bg-[#fef2f2]">
                <div className="text-[12px] text-[#374151]">মিসম্যাচ</div>
                <div className="text-[24px] font-bold text-[#b91c1c]">{data.stats.mismatchCount}</div>
              </div>
              <div className="border border-[#d7dde6] rounded p-3 bg-[#faf5ff]">
                <div className="text-[12px] text-[#374151]">আজকের স্টক আউট</div>
                <div className="text-[24px] font-bold">{data.stats.stockOutTodayKg} kg</div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-[#d7dde6] rounded">
            <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
              <h2 className="text-[14px] font-semibold text-[#1f2d3d]">মনিটরিং সারাংশ টেবিল</h2>
            </div>
            <div className="p-3 overflow-x-auto">
              <table className="w-full min-w-[780px] text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="border border-[#d7dde6] p-2">ডিলার কোড</th>
                    <th className="border border-[#d7dde6] p-2">ওয়ার্ড</th>
                    <th className="border border-[#d7dde6] p-2">সার্ভিস এরিয়া</th>
                    <th className="border border-[#d7dde6] p-2">Pending Offline</th>
                    <th className="border border-[#d7dde6] p-2">Issued Tokens</th>
                    <th className="border border-[#d7dde6] p-2">Used Tokens</th>
                    <th className="border border-[#d7dde6] p-2">Mismatch</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-[#d7dde6] p-2 text-center">
                      {data.distributor?.distributorCode || "-"}
                    </td>
                    <td className="border border-[#d7dde6] p-2 text-center">
                      {data.distributor?.ward || "-"}
                    </td>
                    <td className="border border-[#d7dde6] p-2 text-center">
                      {data.distributor?.serviceArea || "-"}
                    </td>
                    <td className="border border-[#d7dde6] p-2 text-center">{data.stats.pendingOffline}</td>
                    <td className="border border-[#d7dde6] p-2 text-center">{data.stats.issuedTokens}</td>
                    <td className="border border-[#d7dde6] p-2 text-center">{data.stats.usedTokens}</td>
                    <td className="border border-[#d7dde6] p-2 text-center">{data.stats.mismatchCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-[#d7dde6] rounded">
            <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
              <h2 className="text-[14px] font-semibold text-[#1f2d3d]">সাম্প্রতিক অডিট</h2>
            </div>
            <div className="p-3 overflow-x-auto">
              <table className="w-full min-w-[700px] text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="border border-[#d7dde6] p-2">সময়</th>
                    <th className="border border-[#d7dde6] p-2">অ্যাকশন</th>
                    <th className="border border-[#d7dde6] p-2">Target</th>
                    <th className="border border-[#d7dde6] p-2">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAudit.length > 0 ? (
                    data.recentAudit.map((log) => (
                      <tr key={log._id}>
                        <td className="border border-[#d7dde6] p-2 text-center">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="border border-[#d7dde6] p-2">{log.action}</td>
                        <td className="border border-[#d7dde6] p-2 text-center">{log.targetType || "-"}</td>
                        <td className="border border-[#d7dde6] p-2 text-center">{log.severity}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="border border-[#d7dde6] p-4 text-center text-[#6b7280]">
                        কোনো অডিট লগ পাওয়া যায়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <NotesPanel />
    </div>
  );
}