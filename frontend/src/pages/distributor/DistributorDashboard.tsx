import { useEffect, useMemo, useState } from "react";
import {
  getConsumers,
  getDistributionRecords,
  getDistributionSessions,
  getDistributionTokens,
} from "../../services/api";
import { useAuth } from "../../context/useAuth";

type DashboardConsumer = {
  _id: string;
  status: "Active" | "Inactive" | "Revoked";
  division?: string;
  district?: string;
  upazila?: string;
  unionName?: string;
  ward?: string;
};

type DashboardToken = {
  _id: string;
  status: "Issued" | "Used" | "Cancelled" | "Expired";
  consumerId: string | { _id: string; consumerCode?: string };
  issuedAt?: string;
};

type DashboardRecord = {
  _id: string;
  tokenId: string | { _id: string };
  mismatch: boolean;
};

function tokenConsumerId(token: DashboardToken) {
  if (typeof token.consumerId === "string") return token.consumerId;
  return token.consumerId?._id;
}

function recordTokenId(record: DashboardRecord) {
  if (typeof record.tokenId === "string") return record.tokenId;
  return record.tokenId?._id;
}

function isToday(input?: string) {
  if (!input) return false;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return false;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return d >= start && d < end;
}

export default function DistributorDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [consumers, setConsumers] = useState<DashboardConsumer[]>([]);
  const [tokens, setTokens] = useState<DashboardToken[]>([]);
  const [records, setRecords] = useState<DashboardRecord[]>([]);
  const [sessionStatus, setSessionStatus] = useState<
    "Open" | "Paused" | "Closed" | ""
  >("");

  const computed = useMemo(() => {
    const consumerIdSet = new Set(consumers.map((c) => c._id));

    const filteredTokens = tokens.filter((token) => {
      const cId = tokenConsumerId(token);
      return !!cId && consumerIdSet.has(cId);
    });

    const filteredTokenIdSet = new Set(filteredTokens.map((t) => t._id));

    const filteredRecords = records.filter((record) => {
      const tId = recordTokenId(record);
      return !!tId && filteredTokenIdSet.has(tId);
    });

    const issued = filteredTokens.filter((t) => t.status === "Issued").length;
    const cancelled = filteredTokens.filter(
      (t) => t.status === "Cancelled",
    ).length;
    const mismatches = filteredRecords.filter((r) => r.mismatch).length;
    const todayTokens = filteredTokens.filter((t) =>
      isToday(t.issuedAt),
    ).length;
    const successDelivery = filteredRecords.filter((r) => !r.mismatch).length;

    const kpis = {
      totalConsumers: consumers.length,
      cancelOrError: cancelled + mismatches,
      todayTokens,
      successDelivery,
      pending: issued,
    };

    const reportRow = {
      totalConsumers: consumers.length,
      cancelOrError: cancelled + mismatches,
      todayTokens,
      successDelivery,
      pending: issued,
      note: consumers.length === 0 ? "⚠ ডেটা পাওয়া যায়নি" : "আজকের লাইভ সারাংশ",
    };

    return { kpis, reportRow };
  }, [consumers, tokens, records]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [consumersData, tokensData, recordsData] = await Promise.all([
        getConsumers({ page: 1, limit: 1000 }),
        getDistributionTokens({ page: 1, limit: 1000 }),
        getDistributionRecords({ page: 1, limit: 1000 }),
      ]);

      const sessionsData = await getDistributionSessions({ limit: 1 });

      setConsumers((consumersData?.consumers || []) as DashboardConsumer[]);
      setTokens((tokensData?.tokens || []) as DashboardToken[]);
      setRecords((recordsData?.records || []) as DashboardRecord[]);
      setSessionStatus(
        (sessionsData.sessions?.[0]?.status || "") as
          | "Open"
          | "Paused"
          | "Closed"
          | "",
      );
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
      value: computed.kpis.totalConsumers,
      icon: "👤",
      bg: "bg-blue-50",
    },
    {
      label: "আজকের টোকেন",
      value: computed.kpis.todayTokens,
      icon: "🎟️",
      bg: "bg-green-50",
    },
    {
      label: "সফল বিতরণ",
      value: computed.kpis.successDelivery,
      icon: "✅",
      bg: "bg-emerald-50",
    },
    {
      label: "ওজন অমিল / বাতিল",
      value: computed.kpis.cancelOrError,
      icon: "⚠️",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-3">
      {/* breadcrumb/top info row */}
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
              বিভাগ {user?.division || "—"} • ওয়ার্ড {user?.wardNo || "—"}
            </div>
            <div className="text-[12px] text-[#6b7280] mt-0.5">
              {[user?.ward || user?.unionName, user?.upazila, user?.district]
                .filter(Boolean)
                .join(", ")}
            </div>
          </div>
          <div className="text-[12px] text-[#6b7280]">
            সর্বশেষ আপডেট:{" "}
            <span className="font-semibold text-[#111827]">লাইভ</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {sessionStatus === "Open" && (
        <div className="bg-green-50 border border-green-300 rounded p-3 flex items-center gap-2">
          <span className="text-green-700 font-bold">● সেশন চলমান</span>
          <span className="text-green-600 text-sm">বিতরণ সক্রিয় আছে</span>
        </div>
      )}
      {!sessionStatus && (
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

      {/* Table section */}
      <section className="bg-white border border-[#d7dde6] rounded">
        <div className="px-3 py-2 bg-[#f3f5f8] border-b border-[#d7dde6]">
          <h2 className="text-[14px] font-semibold text-[#1f2d3d]">
            আজকের বিতরণ সারাংশ
          </h2>
        </div>
        <div className="p-3">
          <div className="border border-[#d7dde6] rounded overflow-hidden">
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#e9edf3]">
                    <th className="border border-[#cfd6e0] p-2">
                      মোট উপকারভোগী
                    </th>
                    <th className="border border-[#cfd6e0] p-2">আজকের টোকেন</th>
                    <th className="border border-[#cfd6e0] p-2">সফল বিতরণ</th>
                    <th className="border border-[#cfd6e0] p-2">অমীমাংসিত</th>
                    <th className="border border-[#cfd6e0] p-2">
                      বাতিল/ত্রুটি
                    </th>
                    <th className="border border-[#cfd6e0] p-2">মন্তব্য</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {computed.reportRow.totalConsumers}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {computed.reportRow.todayTokens}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {computed.reportRow.successDelivery}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {computed.reportRow.pending}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {computed.reportRow.cancelOrError}
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      {computed.reportRow.note}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="text-[12px] text-[#6b7280]">লোড হচ্ছে...</div>
      )}
    </div>
  );
}
