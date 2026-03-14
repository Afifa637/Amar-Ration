import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import { getAdminSummary, type AdminSummary } from "../../services/api";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getAdminSummary();
        setSummary(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "ড্যাশবোর্ড ডেটা লোড ব্যর্থ",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {metrics.map((item) => (
            <MetricCard key={item.title} {...item} />
          ))}
        </div>
        {loading && (
          <div className="text-[12px] text-[#6b7280] mt-2">লোড হচ্ছে...</div>
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
