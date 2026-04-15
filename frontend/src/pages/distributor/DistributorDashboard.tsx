import { useEffect, useMemo, useState } from "react";
import {
  getDistributorDashboardSummary,
  type DistributorDashboardSummary,
} from "../../services/api";
import { useAuth } from "../../context/useAuth";

export default function DistributorDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] =
    useState<DistributorDashboardSummary | null>(null);

  const computed = useMemo(() => {
    const stats = dashboard?.stats;
    const trendToday = dashboard?.trends?.today;
    const quality = dashboard?.quality;
    return {
      totalConsumers: stats?.totalConsumers ?? 0,
      activeConsumers: stats?.activeConsumers ?? 0,
      issuedTokens: stats?.issuedTokens ?? 0,
      usedTokens: stats?.usedTokens ?? 0,
      cancelledTokens: stats?.cancelledTokens ?? 0,
      pendingOffline: stats?.pendingOffline ?? 0,
      mismatchCount: stats?.mismatchCount ?? 0,
      stockOutTodayKg: stats?.stockOutTodayKg ?? 0,
      todayIssued: trendToday?.issuedTokens ?? 0,
      todayUsed: trendToday?.usedTokens ?? 0,
      mismatchRate: quality?.mismatchRate ?? 0,
      fulfilmentRate: quality?.fulfilmentRate ?? 0,
    };
  }, [dashboard]);

  const trendMax = useMemo(() => {
    const rows = dashboard?.trends?.last7Days || [];
    let max = 1;
    rows.forEach((r) => {
      max = Math.max(max, r.issuedTokens, r.usedTokens, r.stockOutKg);
    });
    return max;
  }, [dashboard]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDistributorDashboardSummary();
      setDashboard(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ড্যাশবোর্ড ডেটা লোড ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const kpiCards = [
    {
      label: "মোট উপকারভোগী",
      value: computed.totalConsumers,
      icon: "👤",
      bg: "bg-blue-50",
    },
    {
      label: "সক্রিয় উপকারভোগী",
      value: computed.activeConsumers,
      icon: "🧾",
      bg: "bg-cyan-50",
    },
    {
      label: "মোট ইস্যুড টোকেন",
      value: computed.issuedTokens,
      icon: "🎟️",
      bg: "bg-green-50",
    },
    {
      label: "সফল বিতরণ",
      value: computed.usedTokens,
      icon: "✅",
      bg: "bg-emerald-50",
    },
    {
      label: "ওজন অমিল / বাতিল",
      value: computed.mismatchCount + computed.cancelledTokens,
      icon: "⚠️",
      bg: "bg-red-50",
    },
    {
      label: "আজকের ইস্যু",
      value: computed.todayIssued,
      icon: "📅",
      bg: "bg-violet-50",
    },
    {
      label: "আজকের বিতরণ",
      value: computed.todayUsed,
      icon: "🚚",
      bg: "bg-teal-50",
    },
    {
      label: "অফলাইন পেন্ডিং",
      value: computed.pendingOffline,
      icon: "🛰️",
      bg: "bg-amber-50",
    },
  ];

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
            সর্বশেষ আপডেট:{" "}
            <span className="font-semibold text-[#111827]">লাইভ</span>
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#d7dde6] rounded px-4 py-3 mb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#6b7280] uppercase tracking-wide mb-0.5">
              আপনার নির্ধারিত এলাকা
            </div>
            <div className="text-[18px] font-bold text-[#1f2d3d]">
              বিভাগ {dashboard?.distributor?.division || user?.division || "—"}{" "}
              • ওয়ার্ড {dashboard?.distributor?.wardNo || user?.wardNo || "—"}
            </div>
            <div className="text-[12px] text-[#6b7280] mt-0.5">
              {[
                dashboard?.distributor?.ward || user?.ward || user?.unionName,
                dashboard?.distributor?.upazila || user?.upazila,
                dashboard?.distributor?.district || user?.district,
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </div>
          </div>
          <div className="text-[12px] text-[#6b7280]">
            বর্তমান সেশন:{" "}
            <span className="font-semibold text-[#111827]">
              {dashboard?.session?.status || "No Session"}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {dashboard?.session?.status === "Open" && (
        <div className="bg-green-50 border border-green-300 rounded p-3 flex items-center gap-2">
          <span className="text-green-700 font-bold">● সেশন চলমান</span>
          <span className="text-green-600 text-sm">বিতরণ সক্রিয় আছে</span>
        </div>
      )}
      {!dashboard?.session?.status && (
        <div className="bg-gray-50 border border-gray-200 rounded p-3">
          <span className="text-gray-500">আজকের সেশন এখনও শুরু হয়নি</span>
        </div>
      )}

      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            সারাংশ (KPI টাইল)
          </h2>
        </div>
        <div className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpiCards.map((card) => (
              <div key={card.label} className={`border rounded p-3 ${card.bg}`}>
                <div className="text-[20px]">{card.icon}</div>
                <div className="text-[22px] font-bold mt-1">{card.value}</div>
                <div className="text-[12px] text-gray-600 mt-0.5">
                  {card.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            গত ৭ দিনের প্রবণতা
          </h2>
        </div>
        <div className="p-3">
          <div className="grid md:grid-cols-2 gap-3">
            {(dashboard?.trends?.last7Days || []).map((row) => (
              <div
                key={row.dateKey}
                className="rounded border border-[#d7dde6] p-2 bg-[#f8fafc]"
              >
                <div className="text-[12px] font-medium text-[#334155] mb-2">
                  {row.dateKey}
                </div>
                <div className="space-y-1">
                  <div>
                    <div className="text-[11px] text-[#475569]">
                      ইস্যু টোকেন ({row.issuedTokens})
                    </div>
                    <div className="h-2 bg-[#e2e8f0] rounded">
                      <div
                        className="h-2 rounded bg-[#2563eb]"
                        style={{
                          width: `${Math.max(4, (row.issuedTokens / trendMax) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#475569]">
                      ব্যবহৃত ({row.usedTokens})
                    </div>
                    <div className="h-2 bg-[#e2e8f0] rounded">
                      <div
                        className="h-2 rounded bg-[#16a34a]"
                        style={{
                          width: `${Math.max(4, (row.usedTokens / trendMax) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-[#b91c1c]">
                    মিসম্যাচ: {row.mismatchCount}
                  </div>
                  <div className="text-[11px] text-[#92400e]">
                    স্টক আউট: {row.stockOutKg.toFixed(2)} কেজি
                  </div>
                </div>
              </div>
            ))}
            {(dashboard?.trends?.last7Days || []).length === 0 && (
              <div className="text-[12px] text-[#6b7280]">ট্রেন্ড ডেটা নেই</div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            কোয়ালিটি + স্টক
          </h2>
        </div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded border p-3 bg-[#f8fafc]">
            <div className="text-[12px] text-[#64748b]">Fulfilment Rate</div>
            <div className="text-[22px] font-bold text-[#0f766e]">
              {computed.fulfilmentRate}%
            </div>
          </div>
          <div className="rounded border p-3 bg-[#fff7ed]">
            <div className="text-[12px] text-[#64748b]">Mismatch Rate</div>
            <div className="text-[22px] font-bold text-[#b91c1c]">
              {computed.mismatchRate}%
            </div>
          </div>
          <div className="rounded border p-3 bg-[#eff6ff]">
            <div className="text-[12px] text-[#64748b]">আজকের স্টক আউট</div>
            <div className="text-[22px] font-bold text-[#1d4ed8]">
              {computed.stockOutTodayKg.toFixed(2)} kg
            </div>
          </div>
          {Object.entries(dashboard?.stock?.today?.byItem || {}).map(
            ([item, value]) => (
              <div key={item} className="rounded border p-3">
                <div className="text-[12px] font-semibold mb-1">{item}</div>
                <div className="text-[11px] text-[#475569]">
                  IN: {value.inKg.toFixed(2)} kg
                </div>
                <div className="text-[11px] text-[#475569]">
                  OUT: {value.outKg.toFixed(2)} kg
                </div>
                <div className="text-[11px] text-[#475569]">
                  BAL: {value.balanceKg.toFixed(2)} kg
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            সাম্প্রতিক সেশন
          </h2>
        </div>
        <div className="p-3 overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-[#f8fafc]">
                <th className="border border-[#cfd6e0] p-2">তারিখ</th>
                <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                <th className="border border-[#cfd6e0] p-2">আইটেম</th>
                <th className="border border-[#cfd6e0] p-2">ইস্যুড</th>
                <th className="border border-[#cfd6e0] p-2">ব্যবহৃত</th>
                <th className="border border-[#cfd6e0] p-2">বাতিল</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard?.sessions?.recent || []).map((row) => (
                <tr key={row.id}>
                  <td className="border border-[#cfd6e0] p-2 text-center">
                    {row.dateKey}
                  </td>
                  <td className="border border-[#cfd6e0] p-2 text-center">
                    {row.status}
                  </td>
                  <td className="border border-[#cfd6e0] p-2 text-center">
                    {row.rationItem || "চাল"}
                  </td>
                  <td className="border border-[#cfd6e0] p-2 text-center">
                    {row.issuedTokens}
                  </td>
                  <td className="border border-[#cfd6e0] p-2 text-center">
                    {row.usedTokens}
                  </td>
                  <td className="border border-[#cfd6e0] p-2 text-center">
                    {row.cancelledTokens}
                  </td>
                </tr>
              ))}
              {(dashboard?.sessions?.recent || []).length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="border border-[#cfd6e0] p-3 text-center text-[#6b7280]"
                  >
                    কোনো সেশন ডেটা নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {loading && (
        <div className="text-[12px] text-[#6b7280]">লোড হচ্ছে...</div>
      )}
    </div>
  );
}
