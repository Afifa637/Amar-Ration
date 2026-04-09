import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import {
  getConsumerById,
  getConsumerCard,
  getAdminConsumerReview,
  getConsumerStats,
  reissueConsumerCard,
  updateConsumer,
  type Consumer,
  type ConsumerCardDetail,
  type AdminConsumerReviewRow,
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
  const [message, setMessage] = useState("");
  const [wardFilter, setWardFilter] = useState("সব ওয়ার্ড");
  const [detail, setDetail] = useState<{
    row: AdminConsumerReviewRow;
    consumer: Consumer | null;
    card: ConsumerCardDetail | null;
  } | null>(null);

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

  const activateConsumer = async (consumerId: string) => {
    try {
      setLoading(true);
      setError("");
      await updateConsumer(consumerId, { status: "Active" });
      setMessage("উপকারভোগী সক্রিয় করা হয়েছে");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সক্রিয় করতে ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const revokeConsumer = async (consumerId: string) => {
    try {
      setLoading(true);
      setError("");
      await updateConsumer(consumerId, { status: "Revoked" });
      setMessage("উপকারভোগী বাতিল করা হয়েছে");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "বাতিল করতে ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const reissueQr = async (consumerId: string) => {
    try {
      setLoading(true);
      setError("");
      await reissueConsumerCard(consumerId);
      setMessage("QR কার্ড পুনরায় ইস্যু করা হয়েছে।");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR রিইস্যু ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (row: AdminConsumerReviewRow) => {
    try {
      setLoading(true);
      setError("");
      const [consumer, card] = await Promise.all([
        getConsumerById(row.id),
        getConsumerCard(row.id),
      ]);
      setDetail({ row, consumer, card });
    } catch (err) {
      setError(err instanceof Error ? err.message : "বিস্তারিত লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const wardOptions = useMemo(() => {
    const wards = Array.from(
      new Set(rows.map((row) => row.ward || "").filter(Boolean)),
    );
    return ["সব ওয়ার্ড", ...wards];
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (wardFilter === "সব ওয়ার্ড") return rows;
    return rows.filter((row) => (row.ward || "") === wardFilter);
  }, [rows, wardFilter]);

  const blacklistBadge = (row: AdminConsumerReviewRow) => {
    if (row.familyFlag) {
      return (
        <span className="inline-flex rounded px-2 py-0.5 text-[11px] bg-orange-100 text-orange-700">
          পারিবারিক সন্দেহ ⚠️
        </span>
      );
    }
    if (row.blacklistStatus === "Permanent") {
      return (
        <span className="inline-flex rounded px-2 py-0.5 text-[11px] bg-red-100 text-red-700">
          স্থায়ী ব্লক 🚫
        </span>
      );
    }
    if (row.blacklistStatus === "Temp") {
      return (
        <span className="inline-flex rounded px-2 py-0.5 text-[11px] bg-yellow-100 text-yellow-700">
          অস্থায়ী ব্লক ⚠️
        </span>
      );
    }
    return (
      <span className="inline-flex rounded px-2 py-0.5 text-[11px] bg-gray-100 text-gray-700">
        পরিষ্কার
      </span>
    );
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
        {message && (
          <div className="mb-3 text-[12px] bg-[#ecfdf3] border border-[#86efac] text-[#166534] px-3 py-2 rounded">
            {message}
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
        <div className="mb-3 flex items-center gap-2">
          <label className="text-[12px] text-[#6b7280]">ওয়ার্ড:</label>
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            {wardOptions.map((ward) => (
              <option key={ward} value={ward}>
                {ward}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "কনজিউমার আইডি",
                  "ওয়ার্ড",
                  "ব্ল্যাকলিস্ট/ফ্ল্যাগ",
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
              {filteredRows.map((row) => (
                <tr key={row.id} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">
                    {row.consumerCode}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.ward || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {blacklistBadge(row)}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{row.status}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    <div className="flex flex-wrap gap-2">
                      {row.status !== "Active" && (
                        <Button
                          variant="ghost"
                          onClick={() => void activateConsumer(row.id)}
                        >
                          ✅ সক্রিয় করুন
                        </Button>
                      )}
                      {row.status === "Active" && (
                        <Button
                          variant="danger"
                          onClick={() => void revokeConsumer(row.id)}
                        >
                          বাতিল করুন
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => void openDetail(row)}
                      >
                        বিস্তারিত
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void reissueQr(row.id)}
                      >
                        QR পুনরায় ইস্যু
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-[#6b7280]">
                    কোনো ডেটা পাওয়া যায়নি
                  </td>
                </tr>
              )}
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

      <Modal
        open={!!detail}
        title="উপকারভোগী বিস্তারিত"
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div className="space-y-3 text-[13px]">
            <div className="border rounded p-3 bg-[#f8fafc] space-y-1">
              <div>
                <strong>কোড:</strong> {detail.row.consumerCode}
              </div>
              <div>
                <strong>নাম:</strong> {detail.row.name}
              </div>
              <div>
                <strong>ওয়ার্ড:</strong>{" "}
                {detail.row.ward || detail.consumer?.ward || "—"}
              </div>
              <div>
                <strong>স্ট্যাটাস:</strong> {detail.row.status}
              </div>
              <div>
                <strong>ব্ল্যাকলিস্ট:</strong>{" "}
                {detail.row.blacklistStatus || "None"}
              </div>
            </div>
            <div className="border rounded p-3 bg-[#f8fafc] space-y-1">
              <div>
                <strong>নিজের NID:</strong>{" "}
                {detail.consumer?.nidFull || `****${detail.row.nidLast4}`}
              </div>
              <div>
                <strong>পিতার NID:</strong>{" "}
                {detail.consumer?.fatherNidFull || "—"}
              </div>
              <div>
                <strong>মাতার NID:</strong>{" "}
                {detail.consumer?.motherNidFull || "—"}
              </div>
            </div>
            <div className="border rounded p-3 bg-[#f8fafc] space-y-1">
              <div>
                <strong>কার্ড স্ট্যাটাস:</strong>{" "}
                {detail.card?.cardStatus || "—"}
              </div>
              <div>
                <strong>QR স্ট্যাটাস:</strong> {detail.card?.qrStatus || "—"}
              </div>
              <div>
                <strong>QR মেয়াদ:</strong>{" "}
                {detail.card?.validTo
                  ? new Date(detail.card.validTo).toLocaleDateString("bn-BD")
                  : "—"}
              </div>
              {detail.card?.qrImageDataUrl && (
                <img
                  src={detail.card.qrImageDataUrl}
                  alt="QR"
                  className="w-32 h-32 border rounded"
                />
              )}
            </div>
            {detail.row.familyFlag && (
              <div className="rounded border border-orange-300 bg-orange-50 px-3 py-2 text-orange-700">
                ⚠️ পরিবারের অন্য সদস্য নিবন্ধিত আছেন
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
