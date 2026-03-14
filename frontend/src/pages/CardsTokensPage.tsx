import { useEffect, useMemo, useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import {
  cancelDistributionToken,
  getDistributionStats,
  getDistributionTokens,
  issueToken,
  type DistributionToken,
  type TokenStatus,
} from "../services/api";

const statusTone: Record<TokenStatus, "blue" | "green" | "red" | "yellow"> = {
  Issued: "blue",
  Used: "green",
  Cancelled: "red",
  Expired: "yellow",
};

function tokenStatusLabel(status: TokenStatus): string {
  if (status === "Issued") return "ইস্যুড";
  if (status === "Used") return "ব্যবহৃত";
  if (status === "Cancelled") return "বাতিল";
  return "মেয়াদোত্তীর্ণ";
}

export default function CardsTokensPage() {
  const [tokens, setTokens] = useState<DistributionToken[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"সব" | TokenStatus>("সব");
  const [scanInput, setScanInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalTokens: 0,
    issued: 0,
    used: 0,
    cancelled: 0,
    mismatches: 0,
  });
  const [openScan, setOpenScan] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [tokenData, statsData] = await Promise.all([
        getDistributionTokens({ limit: 300 }),
        getDistributionStats(),
      ]);
      setTokens(tokenData.tokens);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
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

  const onIssue = async () => {
    if (!scanInput.trim()) {
      setError("Consumer Code বা QR payload দিন");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await issueToken(scanInput.trim());
      setMessage("টোকেন ইস্যু হয়েছে");
      setOpenScan(false);
      setScanInput("");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "টোকেন ইস্যু ব্যর্থ হয়েছে",
      );
    } finally {
      setLoading(false);
    }
  };

  const onCancel = async (tokenId: string) => {
    const confirmed = window.confirm("এই টোকেনটি বাতিল করবেন?");
    if (!confirmed) return;

    try {
      setLoading(true);
      await cancelDistributionToken(tokenId);
      setMessage("টোকেন বাতিল করা হয়েছে");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "টোকেন বাতিল ব্যর্থ হয়েছে",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <PortalSection
        title="কার্ড / টোকেন ব্যবস্থাপনা"
        right={
          <div className="flex gap-2">
            <Button onClick={() => setOpenScan(true)}>🎫 টোকেন ইস্যু</Button>
            <Button variant="secondary" onClick={() => void loadData()}>
              🔄 রিফ্রেশ
            </Button>
          </div>
        }
      >
        {(error || message) && (
          <div
            className={`mb-3 rounded border px-3 py-2 text-[12px] ${error ? "bg-[#fef2f2] border-[#fecaca] text-[#991b1b]" : "bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]"}`}
          >
            {error || message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <div className="border rounded p-2 text-[12px]">
            মোট টোকেন: <b>{stats.totalTokens}</b>
          </div>
          <div className="border rounded p-2 bg-[#eff6ff] text-[12px]">
            ইস্যুড: <b>{stats.issued}</b>
          </div>
          <div className="border rounded p-2 bg-[#ecfdf5] text-[12px]">
            ব্যবহৃত: <b>{stats.used}</b>
          </div>
          <div className="border rounded p-2 bg-[#fef2f2] text-[12px]">
            বাতিল: <b>{stats.cancelled}</b>
          </div>
          <div className="border rounded p-2 bg-[#fffbeb] text-[12px]">
            মিসম্যাচ: <b>{stats.mismatches}</b>
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
            onChange={(e) => setStatus(e.target.value as "সব" | TokenStatus)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="সব">সব স্ট্যাটাস</option>
            <option value="Issued">ইস্যুড</option>
            <option value="Used">ব্যবহৃত</option>
            <option value="Cancelled">বাতিল</option>
            <option value="Expired">মেয়াদোত্তীর্ণ</option>
          </select>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setStatus("সব");
            }}
          >
            রিসেট
          </Button>
        </div>

        <div className="border border-[#cfd6e0] rounded overflow-hidden">
          <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
            টোকেন তালিকা
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-225 text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="border border-[#cfd6e0] p-2">টোকেন</th>
                  <th className="border border-[#cfd6e0] p-2">উপকারভোগী</th>
                  <th className="border border-[#cfd6e0] p-2">নাম</th>
                  <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                  <th className="border border-[#cfd6e0] p-2">পরিমাণ (কেজি)</th>
                  <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                  <th className="border border-[#cfd6e0] p-2">ইস্যু সময়</th>
                  <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((token) => {
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
                        {consumer?.ward || "—"}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.rationQtyKg.toFixed(2)}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        <Badge tone={statusTone[token.status]}>
                          {tokenStatusLabel(token.status)}
                        </Badge>
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {new Date(token.issuedAt).toLocaleString()}
                      </td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        {token.status === "Issued" ? (
                          <Button
                            variant="danger"
                            onClick={() => void onCancel(token._id)}
                          >
                            বাতিল
                          </Button>
                        ) : (
                          <span className="text-[#6b7280]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-[#6b7280]">
                      {loading ? "লোড হচ্ছে..." : "কোনো ডেটা নেই"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PortalSection>

      <Modal
        open={openScan}
        title="স্ক্যান / টোকেন ইস্যু"
        onClose={() => setOpenScan(false)}
      >
        <div className="space-y-3">
          <div className="text-[12px] text-[#374151]">
            উপকারভোগী কোড / QR ডাটা দিন
          </div>
          <input
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            placeholder="C0001"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenScan(false)}>
              বাতিল
            </Button>
            <Button onClick={() => void onIssue()} disabled={loading}>
              ইস্যু করুন
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
