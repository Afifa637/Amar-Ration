import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  getAdminConsumerReview,
  getConsumerStats,
  updateConsumer,
  type AdminConsumerReviewRow,
  type ConsumerStatus,
} from "../../services/api";

export default function AdminConsumersPage() {
  const [rows, setRows] = useState<AdminConsumerReviewRow[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    revoked: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [reviewData, consumerStats] = await Promise.all([
        getAdminConsumerReview({ limit: 200 }),
        getConsumerStats(),
      ]);
      setRows(reviewData.rows || []);
      setStats({
        total: consumerStats.total,
        active: consumerStats.active,
        inactive: consumerStats.inactive,
        revoked: consumerStats.revoked,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "কনজিউমার ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const flaggedCount = useMemo(
    () =>
      rows.filter((row) => row.familyFlag || row.blacklistStatus !== "None")
        .length,
    [rows],
  );

  const updateStatus = async (consumerId: string, status: ConsumerStatus) => {
    try {
      setLoading(true);
      await updateConsumer(consumerId, { status });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "স্ট্যাটাস আপডেট ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> কনজিউমার ও ফ্যামিলি ভেরিফিকেশন
      </div>

      <SectionCard title="ভেরিফিকেশন পাইপলাইন">
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
          {[
            ["লং লিস্ট এন্ট্রি", String(stats.total)],
            ["যাচাইকৃত", String(stats.active)],
            ["ডুপ্লিকেট ফ্ল্যাগ", String(flaggedCount)],
            ["নিষ্ক্রিয়", String(stats.inactive)],
            ["বাতিল অনুরোধ", String(stats.revoked)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]"
            >
              <div className="text-[#6b7280]">{label}</div>
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

      <SectionCard title="ফ্যামিলি-ভিত্তিক পরিচয় যাচাই">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "কনজিউমার আইডি",
                  "ফোন",
                  "ফ্যামিলি চেক",
                  "স্ট্যাটাস",
                  "অ্যাডমিন অ্যাকশন",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">
                    {row.consumerCode}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">—</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.familyFlag ? "ডুপ্লিকেট ফ্ল্যাগ" : "ম্যাচড"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{row.status}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => updateStatus(row.id, "Active")}
                        className="text-[12px] px-2 py-1 rounded bg-emerald-500 text-white hover:bg-emerald-600"
                      >
                        অনুমোদন
                      </button>
                      <button
                        onClick={() => updateStatus(row.id, "Inactive")}
                        className="text-[12px] px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
                      >
                        নিষ্ক্রিয়
                      </button>
                      <button
                        onClick={() => updateStatus(row.id, "Revoked")}
                        className="text-[12px] px-2 py-1 rounded bg-rose-500 text-white hover:bg-rose-600"
                      >
                        বাতিল
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="সিদ্ধান্ত নোট">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• অ্যাডমিন নীতিতে সেলফ-সাইনআপ বন্ধ।</li>
          <li>• একই পরিবারে একাধিক দাবিতে ফ্ল্যাগ আবশ্যক।</li>
          <li>• নিষ্ক্রিয় হলে বিতরণে অযোগ্য হবে।</li>
          <li>• ডুপ্লিকেট/সন্দেহজনক কেসে অ্যাডমিন সিদ্ধান্ত বাধ্যতামূলক।</li>
        </ul>
      </SectionCard>
    </div>
  );
}
