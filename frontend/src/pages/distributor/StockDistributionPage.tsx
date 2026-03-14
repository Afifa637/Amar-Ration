import { useEffect, useMemo, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import {
  completeDistribution,
  getDistributionRecords,
  getDistributionStats,
  getDistributionTokens,
  type DistributionRecord,
  type DistributionToken,
} from "../../services/api";

export default function StockDistributionPage() {
  const [records, setRecords] = useState<DistributionRecord[]>([]);
  const [tokens, setTokens] = useState<DistributionToken[]>([]);
  const [stats, setStats] = useState({
    totalTokens: 0,
    issued: 0,
    used: 0,
    cancelled: 0,
    mismatches: 0,
    completedRecords: 0,
    expectedKg: 0,
    actualKg: 0,
  });
  const [stockOutKg, setStockOutKg] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"সব" | "Issued" | "Used" | "Cancelled">(
    "সব",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [openComplete, setOpenComplete] = useState(false);
  const [selectedToken, setSelectedToken] = useState<DistributionToken | null>(
    null,
  );
  const [actualKg, setActualKg] = useState(0);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [tokenData, recordData, statData] = await Promise.all([
        getDistributionTokens({ limit: 300 }),
        getDistributionRecords({ limit: 300 }),
        getDistributionStats(),
      ]);
      setTokens(tokenData.tokens);
      setRecords(recordData.records);
      setStats(statData);
      setStockOutKg(recordData.stock.stockOutKg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredTokens = useMemo(() => {
    return tokens.filter((token) => {
      const consumer =
        typeof token.consumerId === "string" ? null : token.consumerId;
      const matchSearch =
        !search.trim() ||
        token.tokenCode.toLowerCase().includes(search.toLowerCase()) ||
        consumer?.consumerCode?.toLowerCase().includes(search.toLowerCase()) ||
        consumer?.name?.includes(search);
      const matchStatus = status === "সব" || token.status === status;
      return matchSearch && matchStatus;
    });
  }, [tokens, search, status]);

  const openCompleteModal = (token: DistributionToken) => {
    setSelectedToken(token);
    setActualKg(token.rationQtyKg);
    setOpenComplete(true);
  };

  const onComplete = async () => {
    if (!selectedToken) return;

    try {
      setLoading(true);
      await completeDistribution(selectedToken.tokenCode, actualKg);
      setMessage("বিতরণ সম্পন্ন হয়েছে");
      setOpenComplete(false);
      setSelectedToken(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "বিতরণ সম্পন্ন করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  const delta = Number((stats.expectedKg - stats.actualKg).toFixed(2));

  return (
    <div className="space-y-3">
      <PortalSection
        title="স্টক ও বিতরণ সেশন"
        right={
          <Button variant="secondary" onClick={() => void loadData()}>
            🔄 রিফ্রেশ
          </Button>
        }
      >
        {(error || message) && (
          <div
            className={`mb-3 rounded border px-3 py-2 text-[12px] ${error ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]" : "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"}`}
          >
            {error || message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
          <div className="border rounded p-2 text-[12px]">
            মোট টোকেন: <b>{stats.totalTokens}</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            ইস্যুড: <b>{stats.issued}</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            ব্যবহৃত: <b>{stats.used}</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            মিসম্যাচ: <b>{stats.mismatches}</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            Actual বিতরণ (kg): <b>{stats.actualKg}</b>
          </div>
          <div className="border rounded p-2 text-[12px]">
            স্টক OUT (kg): <b>{stockOutKg}</b>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="সার্চ: Token / Consumer / নাম"
          />
          <select
            value={status}
            onChange={(e) =>
              setStatus(
                e.target.value as "সব" | "Issued" | "Used" | "Cancelled",
              )
            }
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="সব">সব স্ট্যাটাস</option>
            <option value="Issued">ইস্যুড</option>
            <option value="Used">ব্যবহৃত</option>
            <option value="Cancelled">বাতিল</option>
          </select>
          <div className="text-[12px] border rounded px-3 py-2 bg-white">
            পার্থক্য (প্রত্যাশিত-বাস্তব):{" "}
            <b className={delta > 0 ? "text-[#b91c1c]" : ""}>{delta}</b>
          </div>
        </div>

        <div className="border border-[#cfd6e0] rounded overflow-hidden mb-4">
          <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
            লাইভ টোকেন তালিকা
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-250 text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="border border-[#cfd6e0] p-2">টোকেন</th>
                  <th className="border border-[#cfd6e0] p-2">উপকারভোগী</th>
                  <th className="border border-[#cfd6e0] p-2">নাম</th>
                  <th className="border border-[#cfd6e0] p-2">প্রত্যাশিত</th>
                  <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                  <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map((token) => {
                  const consumer =
                    typeof token.consumerId === "string"
                      ? null
                      : token.consumerId;
                  return (
                    <tr
                      key={token._id}
                      className="odd:bg-white even:bg-[#f8fafc]"
                    >
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.tokenCode}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {consumer?.consumerCode || "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2">
                        {consumer?.name || "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.rationQtyKg.toFixed(2)} kg
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.status === "Issued" && (
                          <Badge tone="blue">ইস্যুড</Badge>
                        )}
                        {token.status === "Used" && (
                          <Badge tone="green">ব্যবহৃত</Badge>
                        )}
                        {token.status === "Cancelled" && (
                          <Badge tone="red">বাতিল</Badge>
                        )}
                        {token.status === "Expired" && (
                          <Badge tone="yellow">মেয়াদোত্তীর্ণ</Badge>
                        )}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.status === "Issued" ? (
                          <Button onClick={() => openCompleteModal(token)}>
                            ⚖️ সম্পন্ন
                          </Button>
                        ) : (
                          <span className="text-[#6b7280]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredTokens.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-[#6b7280]">
                      {loading ? "লোড হচ্ছে..." : "কোনো টোকেন নেই"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-[#cfd6e0] rounded overflow-hidden">
          <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
            বিতরণ রেকর্ড
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-250 text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="border border-[#cfd6e0] p-2">সময়</th>
                  <th className="border border-[#cfd6e0] p-2">টোকেন</th>
                  <th className="border border-[#cfd6e0] p-2">উপকারভোগী</th>
                  <th className="border border-[#cfd6e0] p-2">প্রত্যাশিত</th>
                  <th className="border border-[#cfd6e0] p-2">বাস্তব</th>
                  <th className="border border-[#cfd6e0] p-2">ফলাফল</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const token =
                    typeof record.tokenId === "string" ? null : record.tokenId;
                  const consumer = token?.consumerId;
                  return (
                    <tr
                      key={record._id}
                      className="odd:bg-white even:bg-[#f8fafc]"
                    >
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {new Date(record.createdAt).toLocaleString()}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token?._id ? token.tokenCode : "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {consumer?.consumerCode || "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {record.expectedKg.toFixed(2)}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {record.actualKg.toFixed(2)}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {record.mismatch ? (
                          <Badge tone="red">মিসম্যাচ</Badge>
                        ) : (
                          <Badge tone="green">মিলেছে</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-[#6b7280]">
                      কোনো বিতরণ রেকর্ড নেই
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PortalSection>

      <Modal
        open={openComplete}
        title="বিতরণ সম্পন্ন করুন"
        onClose={() => setOpenComplete(false)}
      >
        <div className="space-y-3">
          <div className="text-[13px]">
            টোকেন: <b>{selectedToken?.tokenCode}</b>
          </div>
          <div className="text-[13px]">
            প্রত্যাশিত: <b>{selectedToken?.rationQtyKg.toFixed(2)} kg</b>
          </div>
          <input
            type="number"
            step="0.01"
            value={actualKg}
            onChange={(e) => setActualKg(Number(e.target.value))}
            className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="বাস্তব কেজি"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenComplete(false)}>
              বাতিল
            </Button>
            <Button onClick={() => void onComplete()} disabled={loading}>
              সেভ করুন
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
