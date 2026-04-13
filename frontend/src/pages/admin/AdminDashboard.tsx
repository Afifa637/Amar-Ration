import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  getComplaintStats,
  getAdminDistributors,
  getAdminDistributionMonitoring,
  getAdminSummary,
  getSimpleStockSuggestion,
  getTopRiskyDistributors,
  updateAdminDistributorStatus,
  type AdminDistributorRow,
  type AdminSummary,
} from "../../services/api";

function MetricCard({
  title,
  value,
  sub,
  bg,
}: {
  title: string;
  value: string;
  sub: string;
  bg: string;
}) {
  return (
    <div className="border border-[#d7dde6] rounded bg-white overflow-hidden">
      <div className={`px-3 py-2 ${bg}`}>
        <div className="text-[12px] font-semibold text-[#1f2d3d]">{title}</div>
      </div>
      <div className="px-3 py-3">
        <div className="text-[22px] font-bold text-[#1f2d3d]">{value}</div>
        <div className="text-[12px] text-[#6b7280] mt-1">{sub}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [allDistributorRows, setAllDistributorRows] = useState<
    AdminDistributorRow[]
  >([]);
  const [pendingRows, setPendingRows] = useState<AdminDistributorRow[]>([]);
  const [monitorRows, setMonitorRows] = useState<
    Array<{
      distributor?: string;
      division?: string;
      ward: string;
      expectedKg: number;
      actualKg: number;
      status: "Matched" | "Mismatch";
      action: string;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [quickWidgets, setQuickWidgets] = useState({
    suggestedStock: 0,
    pendingComplaints: 0,
    topRiskName: "—",
  });

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, distributorsData, monitoringData] = await Promise.all(
        [
          getAdminSummary(),
          getAdminDistributors(),
          getAdminDistributionMonitoring(),
        ],
      );
      const [stockData, complaintData, riskyData] = await Promise.all([
        getSimpleStockSuggestion(),
        getComplaintStats(),
        getTopRiskyDistributors(1, 30),
      ]);
      setSummary(summaryData);
      setAllDistributorRows(distributorsData.rows || []);
      setPendingRows(
        (distributorsData.rows || []).filter(
          (row) => !row.authorityStatus || row.authorityStatus === "Pending",
        ),
      );
      setMonitorRows(monitoringData.rows || []);
      setQuickWidgets({
        suggestedStock: Number(stockData.suggestedStock || 0),
        pendingComplaints: Number(
          (complaintData.open || 0) + (complaintData.under_review || 0),
        ),
        topRiskName:
          (riskyData[0] as { distributorName?: string })?.distributorName ||
          "—",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ড্যাশবোর্ড ডেটা লোড ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const suspendedCount = useMemo(
    () =>
      allDistributorRows.filter((row) => row.authorityStatus === "Suspended")
        .length,
    [allDistributorRows],
  );

  const onReview = async (userId: string, approve: boolean) => {
    try {
      setLoading(true);
      setError("");
      await updateAdminDistributorStatus(
        userId,
        approve ? "Active" : "Revoked",
      );
      setMessage(
        approve
          ? "ডিস্ট্রিবিউটর অনুমোদিত হয়েছে"
          : "ডিস্ট্রিবিউটর প্রত্যাখ্যাত হয়েছে",
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "অ্যাকশন ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    if (!summary) return [];
    return [
      {
        title: "অপেক্ষমান ডিস্ট্রিবিউটর",
        value: String(summary.stats.pendingDistributors),
        sub: "অনুমোদনের অপেক্ষায়",
        bg: "bg-[#e8f1fb]",
      },
      {
        title: "সক্রিয় উপকারভোগী",
        value: String(summary.stats.activeConsumers),
        sub: "যাচাইকৃত সক্রিয় উপকারভোগী",
        bg: "bg-[#eaf7ee]",
      },
      {
        title: "ডুপ্লিকেট ফ্যামিলি ফ্ল্যাগ",
        value: String(summary.stats.duplicateFamilies),
        sub: "ম্যানুয়াল সিদ্ধান্ত প্রয়োজন",
        bg: "bg-[#fdecec]",
      },
      {
        title: "ইস্যুকৃত QR কার্ড",
        value: String(summary.stats.issuedQRCards),
        sub: "সক্রিয়/রোটেশনকৃত",
        bg: "bg-[#f3ecff]",
      },
      {
        title: "আজকের টোকেন",
        value: String(summary.stats.todayTokens),
        sub: "আজ ইস্যু হয়েছে",
        bg: "bg-[#e9fbfb]",
      },
      {
        title: "অডিট এলার্ট",
        value: String(summary.stats.auditAlerts),
        sub: "ওজন মিসম্যাচ / স্টক অস্বাভাবিকতা",
        bg: "bg-[#fff6e6]",
      },
    ];
  }, [summary]);

  const alerts = summary?.alerts || [];

  const expiringRows = useMemo(() => {
    return allDistributorRows.filter((row) => {
      if (!row.authorityTo) return false;
      const daysLeft =
        (new Date(row.authorityTo).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24);
      return daysLeft >= 0 && daysLeft <= 30;
    });
  }, [allDistributorRows]);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] text-[#4b5563]">
            হোম <span className="mx-1">›</span> অ্যাডমিন{" "}
            <span className="mx-1">›</span>
            <span className="font-semibold text-[#111827]">
              {" "}
              কন্ট্রোল ড্যাশবোর্ড
            </span>
          </div>
          <div className="text-[12px] text-[#6b7280]">
            সিস্টেম অবস্থা:{" "}
            <span className="font-semibold text-[#16679c]">লাইভ মনিটরিং</span>
          </div>
        </div>
      </div>

      <SectionCard title="অ্যাডমিন কোর KPI">
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-3 text-[12px] bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] px-3 py-2 rounded">
            {message}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {metrics.map((item) => (
            <MetricCard key={item.title} {...item} />
          ))}
        </div>
        {loading && (
          <div className="text-[12px] text-[#6b7280] mt-2">লোড হচ্ছে...</div>
        )}
      </SectionCard>

      <SectionCard title="দ্রুত প্রশাসনিক উইজেট">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="border rounded p-3 bg-purple-50">
            <div className="text-xs text-gray-600">পরামর্শকৃত পরবর্তী স্টক</div>
            <div className="text-2xl font-bold text-purple-700">
              {quickWidgets.suggestedStock} kg
            </div>
          </div>
          <div className="border rounded p-3 bg-amber-50">
            <div className="text-xs text-gray-600">Pending অভিযোগ</div>
            <div className="text-2xl font-bold text-amber-700">
              {quickWidgets.pendingComplaints}
            </div>
          </div>
          <div className="border rounded p-3 bg-rose-50">
            <div className="text-xs text-gray-600">
              Top ঝুঁকিপূর্ণ ডিস্ট্রিবিউটর
            </div>
            <div className="text-lg font-bold text-rose-700">
              {quickWidgets.topRiskName}
            </div>
          </div>
        </div>
      </SectionCard>

      {suspendedCount > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 text-[#991b1b]">
          ⚠️ {suspendedCount} জন ডিস্ট্রিবিউটর বর্তমানে স্থগিত অবস্থায় রয়েছেন
        </div>
      )}

      {expiringRows.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mb-3 text-[#92400e]">
          ⏳ {expiringRows.length} জন ডিস্ট্রিবিউটরের কর্তৃত্বের মেয়াদ ৩০ দিনের
          মধ্যে শেষ হবে।
        </div>
      )}

      <SectionCard title="অপেক্ষমাণ ডিস্ট্রিবিউটর অনুমোদন">
        {(summary?.stats.pendingDistributors || 0) === 0 ? (
          <div className="text-sm text-green-700">
            সকল ডিস্ট্রিবিউটর অনুমোদিত ✓
          </div>
        ) : (
          <div className="space-y-2">
            {pendingRows.map((row) => (
              <div
                key={row.userId}
                className="border rounded p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="text-sm">
                  <div className="font-semibold">{row.name}</div>
                  <div className="text-[#6b7280]">
                    ওয়ার্ড: {row.ward || "—"} | ইমেইল: {row.email || "—"} |
                    তারিখ:{" "}
                    {row.createdAt
                      ? new Date(row.createdAt).toLocaleDateString("bn-BD")
                      : "—"}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-green-600 text-white text-[12px]"
                    onClick={() => void onReview(row.userId, true)}
                  >
                    অনুমোদন করুন
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-rose-600 text-white text-[12px]"
                    onClick={() => void onReview(row.userId, false)}
                  >
                    প্রত্যাখ্যান করুন
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <SectionCard title="আজকের অপারেশন সারাংশ">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f3f5f8] text-left text-[#374151]">
                  <th className="p-2 border border-[#d7dde6]">মেট্রিক</th>
                  <th className="p-2 border border-[#d7dde6]">মান</th>
                  <th className="p-2 border border-[#d7dde6]">নোট</th>
                </tr>
              </thead>
              <tbody>
                {summary &&
                  [
                    [
                      "QR স্ক্যান",
                      String(
                        summary.ops.validScans + summary.ops.rejectedScans,
                      ),
                      `ভ্যালিড: ${summary.ops.validScans} | রিজেক্টেড: ${summary.ops.rejectedScans}`,
                    ],
                    [
                      "ইস্যুকৃত টোকেন",
                      String(summary.ops.tokensGenerated),
                      "ক্যাটাগরি A/B/C মিশ্র",
                    ],
                    [
                      "স্টক কর্তন",
                      `${summary.ops.stockOutKg.toFixed(2)} kg`,
                      "টোকেন ভলিউম অনুযায়ী",
                    ],
                    [
                      "অফলাইন সিঙ্ক কিউ",
                      String(summary.ops.offlineQueue),
                      "নেটওয়ার্ক সিঙ্ক অপেক্ষায়",
                    ],
                  ].map((row) => (
                    <tr key={row[0]} className="odd:bg-white even:bg-[#fafbfc]">
                      {row.map((cell) => (
                        <td key={cell} className="p-2 border border-[#d7dde6]">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="ফ্রড/অডিট এলার্ট">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f3f5f8] text-left text-[#374151]">
                  <th className="p-2 border border-[#d7dde6]">উৎস</th>
                  <th className="p-2 border border-[#d7dde6]">বিষয়</th>
                  <th className="p-2 border border-[#d7dde6]">অগ্রাধিকার</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((row) => (
                  <tr key={row._id} className="odd:bg-white even:bg-[#fafbfc]">
                    <td className="p-2 border border-[#d7dde6]">
                      {row.actorType || row.entityType || "সিস্টেম"}
                    </td>
                    <td className="p-2 border border-[#d7dde6]">
                      {row.action}
                    </td>
                    <td className="p-2 border border-[#d7dde6]">
                      {row.severity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="আজকের বিতরণ মনিটরিং টেবিল">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left text-[#374151]">
                <th className="p-2 border border-[#d7dde6]">ডিস্ট্রিবিউটর</th>
                <th className="p-2 border border-[#d7dde6]">বিভাগ / ওয়ার্ড</th>
                <th className="p-2 border border-[#d7dde6]">মজুদ (কেজি)</th>
                <th className="p-2 border border-[#d7dde6]">বিতরণ (কেজি)</th>
                <th className="p-2 border border-[#d7dde6]">সেশন অবস্থা</th>
                <th className="p-2 border border-[#d7dde6]">অমিল সংখ্যা</th>
              </tr>
            </thead>
            <tbody>
              {monitorRows.map((row, idx) => (
                <tr
                  key={`${row.ward}-${idx}`}
                  className="odd:bg-white even:bg-[#fafbfc]"
                >
                  <td className="p-2 border border-[#d7dde6]">
                    {row.distributor || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    <div>{row.division || "—"}</div>
                    <div className="text-[11px] text-[#6b7280]">
                      Ward {row.ward || "—"}
                    </div>
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.expectedKg.toFixed(1)}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.actualKg.toFixed(1)}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    <span className="inline-flex rounded px-2 py-0.5 text-[11px] bg-gray-100 text-gray-700">
                      {row.status === "Mismatch" ? "Paused" : "Closed"}
                    </span>
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.status === "Mismatch" ? 1 : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <SectionCard title="ডিস্ট্রিবিউটর লাইফসাইকেল">
          <ul className="space-y-2 text-sm text-[#374151]">
            <li>• নতুন আবেদন → যাচাই → অনুমোদন/বাতিল</li>
            <li>• সক্রিয় ডিস্ট্রিবিউটর ওয়ার্ড-ভিত্তিক ও বাতিলযোগ্য</li>
            <li>• অডিট ব্যর্থ হলে সাময়িক স্থগিত</li>
            <li>• ব্ল্যাকলিস্টেড ডিস্ট্রিবিউটর বিতরণ কার্যক্রম করতে পারে না</li>
          </ul>
        </SectionCard>

        <SectionCard title="উপকারভোগী পরিচয় সুরক্ষা">
          <ul className="space-y-2 text-sm text-[#374151]">
            <li>• NID + পিতার NID + মাতার NID মিল যাচাই</li>
            <li>• একই পরিবারে একাধিক দাবিতে ডুপ্লিকেট ফ্ল্যাগ</li>
            <li>• যাচাইকৃত উপকারভোগী OMS QR কার্ড পায়</li>
            <li>• নিষ্ক্রিয়/বাতিল কার্ড স্ক্যানে ব্যর্থ</li>
          </ul>
        </SectionCard>

        <SectionCard title="অ্যাডমিন অ্যাকশন কিউ">
          <ul className="space-y-2 text-sm text-[#374151]">
            <li>
              • {summary?.stats.pendingDistributors ?? 0} ডিস্ট্রিবিউটর অনুমোদন
              অনুরোধ
            </li>
            <li>
              • {summary?.stats.duplicateFamilies ?? 0} উপকারভোগী ডুপ্লিকেট
              ফ্ল্যাগ
            </li>
            <li>• {summary?.stats.auditAlerts ?? 0} অডিট এলার্ট অপেক্ষমান</li>
            <li>• {summary?.ops.offlineQueue ?? 0} অফলাইন সিঙ্ক অপেক্ষমান</li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
