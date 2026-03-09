import { useEffect, useMemo, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import api from "../../services/api";

type TokenRow = {
  id: string;
  tokenCode: string;
  status: "Issued" | "Used" | "Cancelled";
  rationQtyKg: number;
  issuedAt?: string;
  usedAt?: string;
  consumer: {
    id: string;
    consumerCode?: string;
    name: string;
    status?: string;
  } | null;
};

type TokensResponse = {
  rows: TokenRow[];
};

type ReportResponse = {
  totalTokens: number;
  usedTokens: number;
  cancelledTokens: number;
  mismatchCount: number;
  totalStockOutKg: number;
};

type DistRow = {
  tokenId: string;
  consumerId: string;
  name: string;
  ward: string;
  qtyKg: number;
  actualKg: number | null;
  status: "Issued" | "Delivered" | "Mismatch" | "Paused";
  time: string;
};

function toneForStatus(s: DistRow["status"]) {
  if (s === "Delivered") return "green";
  if (s === "Mismatch") return "red";
  if (s === "Paused") return "yellow";
  return "blue";
}

export default function StockDistributionPage() {
  const [sessionStatus, setSessionStatus] = useState<"Running" | "Paused" | "Closed">("Running");
  const [mode, setMode] = useState<"Online" | "Offline">("Online");
  const [tab, setTab] = useState<"live" | "reconcile" | "stock">("live");
  const [q, setQ] = useState("");
  const [ward, setWard] = useState("সব");
  const [status, setStatus] = useState<"সব" | DistRow["status"]>("সব");

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [openIssue, setOpenIssue] = useState(false);
  const [openWeight, setOpenWeight] = useState(false);
  const [openClose, setOpenClose] = useState(false);
  const [openOffline, setOpenOffline] = useState(false);

  const [selectedToken, setSelectedToken] = useState<DistRow | null>(null);
  const [expectedKg, setExpectedKg] = useState(5);
  const [actualKg, setActualKg] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [tokensRes, reportsRes] = await Promise.all([
        api.get("/distributor/tokens") as Promise<TokensResponse>,
        api.get("/distributor/reports") as Promise<ReportResponse>,
      ]);
      setTokens(tokensRes.rows || []);
      setReport(reportsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const rows = useMemo<DistRow[]>(() => {
    return tokens.map((t) => {
      let rowStatus: DistRow["status"] = "Issued";
      if (t.status === "Used") rowStatus = "Delivered";
      if (t.status === "Cancelled") rowStatus = "Paused";

      return {
        tokenId: t.tokenCode,
        consumerId: t.consumer?.consumerCode || t.consumer?.id || "-",
        name: t.consumer?.name || "-",
        ward: ward === "সব" ? "-" : ward,
        qtyKg: t.rationQtyKg,
        actualKg: t.status === "Used" ? t.rationQtyKg : null,
        status: rowStatus,
        time: t.issuedAt ? new Date(t.issuedAt).toLocaleTimeString("bn-BD") : "-",
      };
    });
  }, [tokens, ward]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchQ =
        q.trim() === "" ||
        r.tokenId.toLowerCase().includes(q.toLowerCase()) ||
        r.consumerId.toLowerCase().includes(q.toLowerCase()) ||
        r.name.includes(q);

      const matchWard = ward === "সব" || r.ward === ward;
      const matchStatus = status === "সব" || r.status === status;
      return matchQ && matchWard && matchStatus;
    });
  }, [rows, q, ward, status]);

  const kpi = useMemo(() => {
    const total = rows.length;
    const issued = rows.filter((x) => x.status === "Issued").length;
    const delivered = rows.filter((x) => x.status === "Delivered").length;
    const mismatch = report?.mismatchCount || 0;
    const paused = rows.filter((x) => x.status === "Paused").length;
    const expectedTotal = rows.reduce((sum, r) => sum + r.qtyKg, 0);
    const actualTotal = rows
      .filter((r) => r.status === "Delivered")
      .reduce((sum, r) => sum + (r.actualKg ?? 0), 0);

    return { total, issued, delivered, mismatch, paused, expectedTotal, actualTotal };
  }, [rows, report]);

  const mismatchDelta = Number((kpi.expectedTotal - kpi.actualTotal).toFixed(2));

  async function handleCompleteDistribution() {
    if (!selectedToken) return;

    try {
      setSubmitting(true);
      await api.post("/distribution/complete", {
        tokenCode: selectedToken.tokenId,
        actualKg,
      });
      setOpenWeight(false);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Complete failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <PortalSection
        title="স্টক ও বিতরণ সেশন (Token + Weight + Stock Reconciliation)"
        right={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSessionStatus("Running")}>▶️ চালু</Button>
            <Button variant="secondary" onClick={() => setSessionStatus("Paused")}>
              ⏸️ বিরতি
            </Button>
            <Button variant="danger" onClick={() => setOpenClose(true)}>
              ⛔ সেশন বন্ধ
            </Button>
            <Button variant="ghost" onClick={() => setMode((m) => (m === "Online" ? "Offline" : "Online"))}>
              {mode === "Online" ? "🌐 অনলাইন" : "📴 অফলাইন"} মোড
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span>সেশন স্ট্যাটাস:</span>
          {sessionStatus === "Running" && <Badge tone="green">চলমান</Badge>}
          {sessionStatus === "Paused" && <Badge tone="yellow">বিরতিতে</Badge>}
          {sessionStatus === "Closed" && <Badge tone="red">বন্ধ</Badge>}
          <span className="ml-4">মোড:</span>
          {mode === "Online" ? <Badge tone="blue">অনলাইন</Badge> : <Badge tone="purple">অফলাইন</Badge>}
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setTab("live")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "live" ? "bg-[#1f77b4] text-white border-[#1f77b4]" : "bg-white border-[#cfd6e0]"
            }`}
          >
            🟢 লাইভ বিতরণ
          </button>
          <button
            onClick={() => setTab("reconcile")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "reconcile" ? "bg-[#1f77b4] text-white border-[#1f77b4]" : "bg-white border-[#cfd6e0]"
            }`}
          >
            🧮 রিকনসাইলিয়েশন
          </button>
          <button
            onClick={() => setTab("stock")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "stock" ? "bg-[#1f77b4] text-white border-[#1f77b4]" : "bg-white border-[#cfd6e0]"
            }`}
          >
            📦 স্টক ম্যানেজমেন্ট
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
          <div className="border rounded p-3 bg-white"><div className="text-[12px]">মোট টোকেন</div><div className="text-[20px] font-bold">{kpi.total}</div></div>
          <div className="border rounded p-3 bg-white"><div className="text-[12px]">Issued</div><div className="text-[20px] font-bold">{kpi.issued}</div></div>
          <div className="border rounded p-3 bg-white"><div className="text-[12px]">সফল বিতরণ</div><div className="text-[20px] font-bold">{kpi.delivered}</div></div>
          <div className="border rounded p-3 bg-white"><div className="text-[12px]">মিসম্যাচ</div><div className="text-[20px] font-bold text-[#b91c1c]">{kpi.mismatch}</div></div>
          <div className="border rounded p-3 bg-white"><div className="text-[12px]">Expected মোট</div><div className="text-[20px] font-bold">{kpi.expectedTotal}</div></div>
          <div className="border rounded p-3 bg-white"><div className="text-[12px]">Delta</div><div className="text-[20px] font-bold">{mismatchDelta}</div></div>
        </div>

        {tab === "live" && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setOpenIssue(true)}>🎫 টোকেন ইস্যু</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const firstIssued = filtered.find((x) => x.status === "Issued");
                  if (!firstIssued) return alert("কোনো issued token নেই");
                  setSelectedToken(firstIssued);
                  setExpectedKg(firstIssued.qtyKg);
                  setActualKg(firstIssued.qtyKg);
                  setOpenWeight(true);
                }}
              >
                ⚖️ ওজন যাচাই
              </Button>
              <Button variant="secondary" onClick={() => setOpenOffline(true)}>
                📴 অফলাইন কিউ
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
                placeholder="সার্চ: Token / Consumer / নাম"
              />
              <input
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
                placeholder="ওয়ার্ড"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "সব" | DistRow["status"])}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
              >
                <option value="সব">সব স্ট্যাটাস</option>
                <option value="Issued">Issued</option>
                <option value="Delivered">Delivered</option>
                <option value="Mismatch">Mismatch</option>
                <option value="Paused">Paused</option>
              </select>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={loadData}>
                  {loading ? "লোড..." : "রিফ্রেশ"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setWard("সব");
                    setStatus("সব");
                  }}
                >
                  রিসেট
                </Button>
              </div>
            </div>

            <div className="border border-[#cfd6e0] rounded overflow-hidden">
              <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold flex items-center justify-between">
                <span>বিতরণ রেজিস্টার</span>
                <span className="text-[12px] text-[#6b7280]">মোট: {filtered.length}</span>
              </div>

              <div className="overflow-x-auto bg-white">
                <table className="w-full min-w-[1100px] text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      <th className="border border-[#cfd6e0] p-2">সময়</th>
                      <th className="border border-[#cfd6e0] p-2">Token</th>
                      <th className="border border-[#cfd6e0] p-2">Consumer</th>
                      <th className="border border-[#cfd6e0] p-2">নাম</th>
                      <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                      <th className="border border-[#cfd6e0] p-2">Expected</th>
                      <th className="border border-[#cfd6e0] p-2">Actual</th>
                      <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                      <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.tokenId} className="odd:bg-white even:bg-[#f8fafc]">
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.time}</td>
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.tokenId}</td>
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.consumerId}</td>
                        <td className="border border-[#cfd6e0] p-2">{r.name}</td>
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.ward}</td>
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.qtyKg.toFixed(2)}</td>
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.actualKg === null ? "—" : r.actualKg.toFixed(2)}</td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          <Badge tone={toneForStatus(r.status) as "green" | "red" | "yellow" | "blue"}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="border border-[#cfd6e0] p-2">
                          <div className="flex flex-wrap gap-1 justify-center">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setSelectedToken(r);
                                setExpectedKg(r.qtyKg);
                                setActualKg(r.actualKg ?? r.qtyKg);
                                setOpenWeight(true);
                              }}
                            >
                              ⚖️ ওজন
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-4 text-center text-[#6b7280]">
                          কোনো ডেটা পাওয়া যায়নি।
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "reconcile" && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="border rounded p-3 bg-white">
                <div className="font-semibold text-[13px]">🧮 রিসোর্স রিকনসাইলিয়েশন</div>
                <div className="text-[12px] mt-1">ব্যবহৃত টোকেন, স্টক আউট এবং মিসম্যাচ backend summary থেকে আসছে।</div>
              </div>

              <div className="border rounded p-3 bg-[#fff7ed]">
                <div className="font-semibold text-[13px]">⚠ মিসম্যাচ সারাংশ</div>
                <div className="text-[12px] mt-1">Mismatch Count: <span className="font-semibold">{report?.mismatchCount || 0}</span></div>
                <div className="text-[12px] mt-1">Total Stock Out: <span className="font-semibold">{report?.totalStockOutKg || 0} kg</span></div>
              </div>

              <div className="border rounded p-3 bg-white">
                <div className="font-semibold text-[13px]">✅ অ্যাকশন</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button onClick={() => loadData()}>রিফ্রেশ</Button>
                  <Button variant="secondary" onClick={() => alert("Admin notify API পরে যোগ করুন")}>
                    এডমিন নোটিফাই
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "stock" && (
          <div className="mt-4 space-y-3">
            <div className="border border-[#cfd6e0] rounded overflow-hidden">
              <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">স্টক সারাংশ</div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3 bg-white">
                <div className="border p-3 rounded">
                  <div className="text-[12px]">Total Tokens</div>
                  <div className="text-[22px] font-bold">{report?.totalTokens || 0}</div>
                </div>
                <div className="border p-3 rounded">
                  <div className="text-[12px]">Used Tokens</div>
                  <div className="text-[22px] font-bold">{report?.usedTokens || 0}</div>
                </div>
                <div className="border p-3 rounded">
                  <div className="text-[12px]">Cancelled</div>
                  <div className="text-[22px] font-bold">{report?.cancelledTokens || 0}</div>
                </div>
                <div className="border p-3 rounded">
                  <div className="text-[12px]">Distributed</div>
                  <div className="text-[22px] font-bold">{report?.totalStockOutKg || 0} kg</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PortalSection>

      <Modal open={openIssue} title="টোকেন ইস্যু" onClose={() => setOpenIssue(false)}>
        <div className="text-[13px] text-[#374151]">
          টোকেন ইস্যু এখন `CardsTokensPage`-এর scan action থেকে backend-এ চলছে।
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setOpenIssue(false)}>ঠিক আছে</Button>
        </div>
      </Modal>

      <Modal open={openWeight} title="IoT ওজন যাচাই" onClose={() => setOpenWeight(false)}>
        <div className="text-[12px] text-[#374151]">
          টোকেন: <span className="font-semibold">{selectedToken?.tokenId ?? "—"}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div className="border rounded p-3 bg-white">
            <div className="text-[12px]">Expected (কেজি)</div>
            <input
              type="number"
              step="0.01"
              value={expectedKg}
              onChange={(e) => setExpectedKg(Number(e.target.value))}
              className="mt-1 w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            />
          </div>

          <div className="border rounded p-3 bg-white">
            <div className="text-[12px]">Actual (কেজি)</div>
            <input
              type="number"
              step="0.01"
              value={actualKg}
              onChange={(e) => setActualKg(Number(e.target.value))}
              className="mt-1 w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            />
          </div>

          <div className="border rounded p-3 bg-[#f8fafc]">
            <div className="text-[12px]">ফলাফল</div>
            <div className="mt-2">
              {Math.abs(expectedKg - actualKg) <= 0.05 ? (
                <Badge tone="green">✅ মিলেছে</Badge>
              ) : (
                <Badge tone="red">⚠ মিসম্যাচ</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenWeight(false)}>
            বাতিল
          </Button>
          <Button onClick={handleCompleteDistribution} disabled={submitting}>
            {submitting ? "সংরক্ষণ..." : "সংরক্ষণ"}
          </Button>
        </div>
      </Modal>

      <Modal open={openClose} title="সেশন বন্ধ" onClose={() => setOpenClose(false)}>
        <div className="text-[13px]">এটি UI state only. Session close backend API এখনো যোগ করা হয়নি।</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenClose(false)}>
            বাতিল
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setSessionStatus("Closed");
              setOpenClose(false);
            }}
          >
            বন্ধ করুন
          </Button>
        </div>
      </Modal>

      <Modal open={openOffline} title="অফলাইন কিউ" onClose={() => setOpenOffline(false)}>
        <div className="text-[13px]">Offline queue বিস্তারিত `MonitoringPage`-এ backend থেকে দেখানো হচ্ছে।</div>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setOpenOffline(false)}>ঠিক আছে</Button>
        </div>
      </Modal>
    </div>
  );
}