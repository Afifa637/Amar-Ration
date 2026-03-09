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
    category?: string;
    status?: string;
  } | null;
};

type TokenResponse = {
  rows: TokenRow[];
};

type CardRow = {
  consumerId: string;
  name: string;
  ward: string;
  cardStatus: "Active" | "Inactive" | "Revoked";
  qrStatus: "Valid" | "Invalid" | "Expired";
  lastScan: string;
  tokenToday?: string;
};

function toneForCardStatus(s: CardRow["cardStatus"]) {
  if (s === "Active") return "green";
  if (s === "Inactive") return "yellow";
  return "red";
}
function toneForQrStatus(s: CardRow["qrStatus"]) {
  if (s === "Valid") return "blue";
  if (s === "Expired") return "yellow";
  return "red";
}
function toneForTokenStatus(s: TokenRow["status"]) {
  if (s === "Issued") return "blue";
  if (s === "Used") return "green";
  return "red";
}

function formatDate(date?: string) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString("bn-BD");
  } catch {
    return date;
  }
}

export default function CardsTokensPage() {
  const [tab, setTab] = useState<"scan" | "cards" | "tokens" | "rotation" | "offline">("scan");
  const [q, setQ] = useState("");
  const [ward, setWard] = useState("সব");
  const [cardStatus, setCardStatus] = useState<"সব" | CardRow["cardStatus"]>("সব");
  const [qrStatus, setQrStatus] = useState<"সব" | CardRow["qrStatus"]>("সব");

  const [openScan, setOpenScan] = useState(false);
  const [scanInput, setScanInput] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState("");
  const [scanLoading, setScanLoading] = useState(false);

  const [openCardAction, setOpenCardAction] = useState<{ open: boolean; row?: CardRow; action?: string }>({
    open: false,
  });
  const [openTokenPrint, setOpenTokenPrint] = useState<{ open: boolean; token?: TokenRow }>({
    open: false,
  });

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadTokens() {
    try {
      setLoading(true);
      setError("");
      const res = (await api.get("/distributor/tokens")) as TokenResponse;
      setTokens(res.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTokens();
  }, []);

  async function handleScan() {
    try {
      setScanLoading(true);
      setScanError("");
      setScanResult(null);
      const result = await api.post("/distribution/scan", { qrPayload: scanInput });
      setScanResult(result);
      await loadTokens();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "স্ক্যান ব্যর্থ");
    } finally {
      setScanLoading(false);
    }
  }

  const cardRows = useMemo<CardRow[]>(() => {
    const map = new Map<string, CardRow>();

    for (const t of tokens) {
      const id = t.consumer?.consumerCode || t.consumer?.id || "Unknown";
      if (!map.has(id)) {
        map.set(id, {
          consumerId: id,
          name: t.consumer?.name || "-",
          ward: ward === "সব" ? "-" : ward,
          cardStatus: t.consumer?.status === "Active" ? "Active" : "Inactive",
          qrStatus: "Valid",
          lastScan: formatDate(t.issuedAt),
          tokenToday: t.tokenCode,
        });
      }
    }

    return Array.from(map.values()).filter((r) => {
      const matchQ =
        q.trim() === "" ||
        r.consumerId.toLowerCase().includes(q.toLowerCase()) ||
        r.name.includes(q);

      const matchWard = ward === "সব" || r.ward === ward;
      const matchCard = cardStatus === "সব" || r.cardStatus === cardStatus;
      const matchQr = qrStatus === "সব" || r.qrStatus === qrStatus;

      return matchQ && matchWard && matchCard && matchQr;
    });
  }, [tokens, q, ward, cardStatus, qrStatus]);

  const stats = {
    active: cardRows.filter((c) => c.cardStatus === "Active").length,
    inactive: cardRows.filter((c) => c.cardStatus === "Inactive").length,
    revoked: cardRows.filter((c) => c.cardStatus === "Revoked").length,
    todayTokens: tokens.filter((t) => t.status === "Issued" || t.status === "Used").length,
  };

  return (
    <div className="space-y-3">
      <PortalSection
        title="আমার রেশন কার্ড / QR / টোকেন"
        right={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpenScan(true)}>📷 QR স্ক্যান</Button>
            <Button variant="secondary" onClick={loadTokens}>
              🔄 রিফ্রেশ
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              🖨️ প্রিন্ট
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            ["scan", "📷 স্ক্যান ও ভ্যালিডেশন"],
            ["cards", "🪪 কার্ড তালিকা"],
            ["tokens", "🎫 টোকেন তালিকা"],
            ["rotation", "♻️ QR রোটেশন/এক্সপায়ারি"],
            ["offline", "📴 অফলাইন কিউ"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k as "scan" | "cards" | "tokens" | "rotation" | "offline")}
              className={`px-3 py-1.5 rounded text-[13px] border ${
                tab === k ? "bg-[#1f77b4] text-white border-[#1f77b4]" : "bg-white border-[#cfd6e0]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
          <div className="border border-[#d7dde6] rounded p-3 bg-[#ecfdf5]">
            <div className="text-[12px]">Active কার্ড</div>
            <div className="text-[22px] font-bold">{stats.active}</div>
          </div>
          <div className="border border-[#d7dde6] rounded p-3 bg-[#fffbeb]">
            <div className="text-[12px]">Inactive</div>
            <div className="text-[22px] font-bold">{stats.inactive}</div>
          </div>
          <div className="border border-[#d7dde6] rounded p-3 bg-[#fef2f2]">
            <div className="text-[12px]">Revoked</div>
            <div className="text-[22px] font-bold">{stats.revoked}</div>
          </div>
          <div className="border border-[#d7dde6] rounded p-3 bg-[#eff6ff]">
            <div className="text-[12px]">আজকের টোকেন</div>
            <div className="text-[22px] font-bold">{stats.todayTokens}</div>
          </div>
        </div>

        {tab === "scan" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">QR স্ক্যান</div>
              <div className="text-[12px] text-[#374151] mb-2">
                স্ক্যান হলে → কার্ড ভ্যালিডেশন → শর্ট লিস্ট → টোকেন ইস্যু
              </div>
              <div className="flex gap-2">
                <input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  className="flex-1 border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
                  placeholder="যেমন: OMS:C0001:2026"
                />
                <Button onClick={handleScan} disabled={scanLoading}>
                  {scanLoading ? "স্ক্যান..." : "স্ক্যান"}
                </Button>
              </div>

              {scanError && <div className="mt-2 text-sm text-red-600">{scanError}</div>}

              <div className="mt-3 p-3 border border-[#cfd6e0] rounded bg-white">
                <div className="text-[13px] font-semibold">রিয়েল-টাইম ভ্যালিডেশন ফলাফল</div>
                {scanResult ? (
                  <div className="mt-2 space-y-2 text-[12px]">
                    <div>টোকেন: {scanResult?.token?.tokenCode || "-"}</div>
                    <div>পরিমাণ: {scanResult?.token?.rationQtyKg || "-"} কেজি</div>
                    <div>স্ট্যাটাস: {scanResult?.token?.status || "-"}</div>
                  </div>
                ) : (
                  <div className="mt-2 text-[12px] text-[#6b7280]">এখনো কোনো স্ক্যান হয়নি।</div>
                )}
              </div>
            </div>

            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">ভুল/রিজেক্ট কেস</div>
              <ul className="list-disc pl-5 text-[12px] text-[#374151] space-y-1">
                <li>Revoked কার্ড → Reject</li>
                <li>Inactive কার্ড → Reject</li>
                <li>QR Expired → Rotation প্রয়োজন</li>
                <li>Family Flag → Field Verification</li>
              </ul>
            </div>

            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">দ্রুত অ্যাকশন</div>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="secondary" onClick={() => alert("write API পরে যোগ করুন")}>
                  ❌ ইনঅ্যাক্টিভ রিকোয়েস্ট
                </Button>
                <Button variant="secondary" onClick={() => alert("write API পরে যোগ করুন")}>
                  🚫 রিভোক রিকোয়েস্ট
                </Button>
                <Button variant="ghost" onClick={() => alert("rotation API পরে যোগ করুন")}>
                  ♻️ QR রোটেশন
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === "cards" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
                placeholder="সার্চ: Consumer ID / নাম"
              />
              <input
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
                placeholder="ওয়ার্ড"
              />
              <select
                value={cardStatus}
                onChange={(e) => setCardStatus(e.target.value as "সব" | CardRow["cardStatus"])}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
              >
                <option value="সব">সব কার্ড</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Revoked">Revoked</option>
              </select>
              <select
                value={qrStatus}
                onChange={(e) => setQrStatus(e.target.value as "সব" | "Valid" | "Invalid" | "Expired")}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
              >
                <option value="সব">সব QR</option>
                <option value="Valid">Valid</option>
                <option value="Invalid">Invalid</option>
                <option value="Expired">Expired</option>
              </select>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={loadTokens}>
                  {loading ? "লোড..." : "রিফ্রেশ"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setWard("সব");
                    setCardStatus("সব");
                    setQrStatus("সব");
                  }}
                >
                  রিসেট
                </Button>
              </div>
            </div>

            <div className="border border-[#cfd6e0] rounded overflow-hidden">
              <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold flex justify-between">
                <span>আমার রেশন কার্ড তালিকা</span>
                <span className="text-[12px] text-[#6b7280]">মোট: {cardRows.length}</span>
              </div>
              <div className="overflow-x-auto bg-white">
                <table className="min-w-[1100px] w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      <th className="border border-[#cfd6e0] p-2">Consumer</th>
                      <th className="border border-[#cfd6e0] p-2">নাম</th>
                      <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                      <th className="border border-[#cfd6e0] p-2">কার্ড</th>
                      <th className="border border-[#cfd6e0] p-2">QR</th>
                      <th className="border border-[#cfd6e0] p-2">শেষ স্ক্যান</th>
                      <th className="border border-[#cfd6e0] p-2">আজকের টোকেন</th>
                      <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardRows.map((r) => (
                      <tr key={r.consumerId} className="odd:bg-white even:bg-[#f8fafc]">
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.consumerId}</td>
                        <td className="border border-[#cfd6e0] p-2">{r.name}</td>
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.ward}</td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          <Badge tone={toneForCardStatus(r.cardStatus)}>{r.cardStatus}</Badge>
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          <Badge tone={toneForQrStatus(r.qrStatus)}>{r.qrStatus}</Badge>
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.lastScan}</td>
                        <td className="border border-[#cfd6e0] p-2 text-center">{r.tokenToday ?? "-"}</td>
                        <td className="border border-[#cfd6e0] p-2">
                          <div className="flex flex-wrap gap-1 justify-center">
                            <Button variant="ghost" onClick={() => alert("profile API পরে যোগ করুন")}>
                              👁️
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setOpenCardAction({ open: true, row: r, action: "inactive" })}
                            >
                              ❌ নিষ্ক্রিয়
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => setOpenCardAction({ open: true, row: r, action: "revoke" })}
                            >
                              🚫 রিভোক
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {cardRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-[#6b7280]">
                          কোনো ডেটা পাওয়া যায়নি।
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "tokens" && (
          <div className="border border-[#cfd6e0] rounded overflow-hidden">
            <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">টোকেন তালিকা</div>
            <div className="overflow-x-auto bg-white">
              <table className="min-w-[950px] w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="border border-[#cfd6e0] p-2">Token</th>
                    <th className="border border-[#cfd6e0] p-2">Consumer</th>
                    <th className="border border-[#cfd6e0] p-2">নাম</th>
                    <th className="border border-[#cfd6e0] p-2">পরিমাণ</th>
                    <th className="border border-[#cfd6e0] p-2">Issued At</th>
                    <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                    <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.id} className="odd:bg-white even:bg-[#f8fafc]">
                      <td className="border border-[#cfd6e0] p-2 text-center">{t.tokenCode}</td>
                      <td className="border border-[#cfd6e0] p-2 text-center">{t.consumer?.consumerCode || t.consumer?.id || "-"}</td>
                      <td className="border border-[#cfd6e0] p-2">{t.consumer?.name || "-"}</td>
                      <td className="border border-[#cfd6e0] p-2 text-center">{t.rationQtyKg} কেজি</td>
                      <td className="border border-[#cfd6e0] p-2 text-center">{formatDate(t.issuedAt)}</td>
                      <td className="border border-[#cfd6e0] p-2 text-center">
                        <Badge tone={toneForTokenStatus(t.status) as "blue" | "green" | "red"}>{t.status}</Badge>
                      </td>
                      <td className="border border-[#cfd6e0] p-2">
                        <div className="flex flex-wrap gap-1 justify-center">
                          <Button variant="ghost" onClick={() => setOpenTokenPrint({ open: true, token: t })}>
                            🖨️
                          </Button>
                          <Button variant="secondary" onClick={() => alert("reissue/cancel API পরে যোগ করুন")}>
                            🔁
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && tokens.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-[#6b7280]">
                        কোনো টোকেন পাওয়া যায়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "rotation" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">QR এক্সপায়ারি নীতি</div>
              <div className="text-[12px] text-[#374151] space-y-1">
                <div>এখানে backend settings / admin policy থেকে ডেটা আনা হবে।</div>
                <div>এখন read-only UI রাখা হয়েছে।</div>
              </div>
            </div>
            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">এক্সপায়ার্ড কিউ</div>
              <div className="text-[12px] text-[#374151]">Expired QR list API পরে যোগ করুন।</div>
            </div>
          </div>
        )}

        {tab === "offline" && (
          <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold mb-2">অফলাইন কিউ</div>
            <div className="text-[12px] text-[#374151]">
              Offline queue details Monitoring page-এ backend থেকে দেখানো হচ্ছে।
            </div>
          </div>
        )}
      </PortalSection>

      <Modal open={openScan} title="QR স্ক্যান" onClose={() => setOpenScan(false)}>
        <div className="border border-dashed rounded h-52 flex items-center justify-center text-[#6b7280]">
          📷 ক্যামেরা প্রিভিউ এখানে
        </div>
        <div className="mt-3 text-[12px] text-[#374151]">ম্যানুয়ালি QR payload দিয়ে স্ক্যান API চালাতে উপরের স্ক্যান ট্যাব ব্যবহার করুন।</div>
        <div className="mt-3 flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setOpenScan(false)}>
            বন্ধ
          </Button>
        </div>
      </Modal>

      <Modal
        open={openCardAction.open}
        title={`কার্ড অ্যাকশন: ${openCardAction.action === "revoke" ? "রিভোক" : "নিষ্ক্রিয়"}`}
        onClose={() => setOpenCardAction({ open: false })}
      >
        <div className="text-[13px] text-[#111827] space-y-2">
          <div>
            Consumer: <span className="font-semibold">{openCardAction.row?.consumerId}</span> — {openCardAction.row?.name}
          </div>
          <div className="text-[12px] text-[#6b7280]">
            এই অ্যাকশনের write API এখনো যোগ করা হয়নি।
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCardAction({ open: false })}>
              বাতিল
            </Button>
            <Button onClick={() => alert("write API পরে যোগ করুন")}>ঠিক আছে</Button>
          </div>
        </div>
      </Modal>

      <Modal open={openTokenPrint.open} title="টোকেন প্রিন্ট" onClose={() => setOpenTokenPrint({ open: false })}>
        <div className="border border-[#cfd6e0] rounded p-3 bg-[#fbfdff] text-[13px]">
          <div className="font-semibold">আমার রেশন টোকেন</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
            <div>Token: <span className="font-semibold">{openTokenPrint.token?.tokenCode ?? "-"}</span></div>
            <div>Consumer: <span className="font-semibold">{openTokenPrint.token?.consumer?.consumerCode ?? "-"}</span></div>
            <div>পরিমাণ: <span className="font-semibold">{openTokenPrint.token?.rationQtyKg ?? "-"} কেজি</span></div>
            <div>Issued: <span className="font-semibold">{formatDate(openTokenPrint.token?.issuedAt)}</span></div>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenTokenPrint({ open: false })}>
            বন্ধ
          </Button>
          <Button onClick={() => window.print()}>🖨️ প্রিন্ট</Button>
        </div>
      </Modal>
    </div>
  );
}