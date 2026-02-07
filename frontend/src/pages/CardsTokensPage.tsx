import { useMemo, useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";

type CardRow = {
  consumerId: string;
  name: string;
  ward: string;
  cardStatus: "Active" | "Inactive" | "Revoked";
  qrStatus: "Valid" | "Invalid" | "Expired";
  lastScan: string;
  tokenToday?: string;
};

const demoCards: CardRow[] = [
  {
    consumerId: "C001",
    name: "রহিম",
    ward: "ওয়ার্ড-০১",
    cardStatus: "Active",
    qrStatus: "Valid",
    lastScan: "আজ 10:12",
    tokenToday: "T-1001",
  },
  {
    consumerId: "C002",
    name: "করিম",
    ward: "ওয়ার্ড-০১",
    cardStatus: "Inactive",
    qrStatus: "Invalid",
    lastScan: "গতকাল",
    tokenToday: undefined,
  },
  {
    consumerId: "C003",
    name: "আয়েশা",
    ward: "ওয়ার্ড-০২",
    cardStatus: "Active",
    qrStatus: "Valid",
    lastScan: "আজ 10:40",
    tokenToday: "T-1012",
  },
  {
    consumerId: "C004",
    name: "হাসান",
    ward: "ওয়ার্ড-০২",
    cardStatus: "Revoked",
    qrStatus: "Invalid",
    lastScan: "৩ দিন আগে",
    tokenToday: undefined,
  },
];

type TokenRow = {
  tokenId: string;
  consumerId: string;
  qtyKg: number;
  slot: string;
  status: "Issued" | "Used" | "Cancelled";
};

const demoTokens: TokenRow[] = [
  {
    tokenId: "T-1001",
    consumerId: "C001",
    qtyKg: 5,
    slot: "10:00-10:30",
    status: "Issued",
  },
  {
    tokenId: "T-1002",
    consumerId: "C003",
    qtyKg: 5,
    slot: "10:30-11:00",
    status: "Used",
  },
  {
    tokenId: "T-1003",
    consumerId: "C006",
    qtyKg: 5,
    slot: "11:00-11:30",
    status: "Cancelled",
  },
];

function ToneForCardStatus(s: CardRow["cardStatus"]) {
  if (s === "Active") return "green";
  if (s === "Inactive") return "yellow";
  return "red";
}
function ToneForQrStatus(s: CardRow["qrStatus"]) {
  if (s === "Valid") return "blue";
  if (s === "Expired") return "yellow";
  return "red";
}
function ToneForTokenStatus(s: TokenRow["status"]) {
  if (s === "Issued") return "blue";
  if (s === "Used") return "green";
  return "red";
}

export default function CardsTokensPage() {
  const [tab, setTab] = useState<
    "scan" | "cards" | "tokens" | "rotation" | "offline"
  >("scan");

  // Card filters
  const [q, setQ] = useState("");
  const [ward, setWard] = useState("সব");
  const [cardStatus, setCardStatus] = useState<"সব" | CardRow["cardStatus"]>(
    "সব",
  );
  const [qrStatus, setQrStatus] = useState<"সব" | CardRow["qrStatus"]>("সব");

  const [openScan, setOpenScan] = useState(false);
  const [openCardAction, setOpenCardAction] = useState<{
    open: boolean;
    row?: CardRow;
    action?: string;
  }>({ open: false });
  const [openTokenPrint, setOpenTokenPrint] = useState<{
    open: boolean;
    token?: TokenRow;
  }>({ open: false });
  const [scanInput, setScanInput] = useState("C001"); // demo

  const cardRows = useMemo(() => {
    return demoCards.filter((r) => {
      const matchQ =
        q.trim() === "" ||
        r.consumerId.toLowerCase().includes(q.toLowerCase()) ||
        r.name.includes(q);

      const matchWard = ward === "সব" || r.ward === ward;
      const matchCard = cardStatus === "সব" || r.cardStatus === cardStatus;
      const matchQr = qrStatus === "সব" || r.qrStatus === qrStatus;

      return matchQ && matchWard && matchCard && matchQr;
    });
  }, [q, ward, cardStatus, qrStatus]);

  const stats = {
    active: demoCards.filter((c) => c.cardStatus === "Active").length,
    inactive: demoCards.filter((c) => c.cardStatus === "Inactive").length,
    revoked: demoCards.filter((c) => c.cardStatus === "Revoked").length,
    todayTokens: demoTokens.filter(
      (t) => t.status === "Issued" || t.status === "Used",
    ).length,
  };

  return (
    <div className="space-y-3">
      <PortalSection
        title="আমার রেশন কার্ড / QR / টোকেন"
        right={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setOpenScan(true)}>📷 QR স্ক্যান</Button>
            <Button
              variant="secondary"
              onClick={() => alert("ডেমো: এক্সপোর্ট হবে")}
            >
              ⬇️ এক্সপোর্ট
            </Button>
            <Button variant="ghost" onClick={() => alert("ডেমো: প্রিন্ট হবে")}>
              🖨️ প্রিন্ট
            </Button>
          </div>
        }
      >
        {/* Tabs */}
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
              onClick={() =>
                setTab(
                  k as "scan" | "cards" | "tokens" | "rotation" | "offline",
                )
              }
              className={`px-3 py-1.5 rounded text-[13px] border ${
                tab === k
                  ? "bg-[#1f77b4] text-white border-[#1f77b4]"
                  : "bg-white border-[#cfd6e0]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
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

        {/* Tab content */}
        {tab === "scan" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">QR স্ক্যান (ডেমো)</div>
              <div className="text-[12px] text-[#374151] mb-2">
                স্ক্যান হলে → কার্ড ভ্যালিডেশন → শর্ট লিস্ট → টোকেন ইস্যু
              </div>
              <div className="flex gap-2">
                <input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  className="flex-1 border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
                  placeholder="ডেমো: Consumer ID বা QR ডাটা"
                />
                <Button
                  onClick={() => alert("ডেমো: স্ক্যান সফল, ভ্যালিডেট হচ্ছে...")}
                >
                  স্ক্যান
                </Button>
              </div>

              <div className="mt-3 p-3 border border-[#cfd6e0] rounded bg-white">
                <div className="text-[13px] font-semibold">
                  রিয়েল-টাইম ভ্যালিডেশন ফলাফল
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                  <div className="flex items-center justify-between border rounded p-2">
                    <span>কার্ড</span>
                    <Badge tone="green">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between border rounded p-2">
                    <span>QR</span>
                    <Badge tone="blue">Valid</Badge>
                  </div>
                  <div className="flex items-center justify-between border rounded p-2">
                    <span>ডুপ্লিকেট</span>
                    <Badge tone="gray">না</Badge>
                  </div>
                  <div className="flex items-center justify-between border rounded p-2">
                    <span>টোকেন</span>
                    <Badge tone="blue">Issued</Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      setOpenTokenPrint({ open: true, token: demoTokens[0] })
                    }
                  >
                    🖨️ টোকেন প্রিন্ট
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => alert("ডেমো: শর্ট লিস্টে যুক্ত হয়েছে")}
                  >
                    ➕ শর্ট লিস্ট
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => alert("ডেমো: অডিট লগ তৈরি হয়েছে")}
                  >
                    📝 অডিট লগ
                  </Button>
                </div>
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

              <div className="mt-3 p-3 border rounded bg-[#fff7ed] text-[12px]">
                <div className="font-semibold text-[#92400e]">
                  ⚠ ডেমো সতর্কতা
                </div>
                <div>
                  যদি ফ্যামিলি ডুপ্লিকেট পাওয়া যায়, ডিলার টোকেন ইস্যু করতে পারবে
                  না।
                </div>
              </div>
            </div>

            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">দ্রুত অ্যাকশন</div>
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => alert("ডেমো: কার্ড ইনঅ্যাক্টিভ রিকোয়েস্ট")}
                >
                  ❌ ইনঅ্যাক্টিভ রিকোয়েস্ট
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => alert("ডেমো: কার্ড রিভোক রিকোয়েস্ট")}
                >
                  🚫 রিভোক রিকোয়েস্ট
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => alert("ডেমো: ব্ল্যাকলিস্ট রিকোয়েস্ট")}
                >
                  ⛔ ব্ল্যাকলিস্ট রিকোয়েস্ট
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => alert("ডেমো: QR রোটেশন পেজ ওপেন")}
                >
                  ♻️ QR রোটেশন
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === "cards" && (
          <>
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
                placeholder="সার্চ: Consumer ID / নাম"
              />
              <select
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
              >
                <option>সব</option>
                <option>ওয়ার্ড-০১</option>
                <option>ওয়ার্ড-০২</option>
              </select>
              <select
                value={cardStatus}
                onChange={(e) =>
                  setCardStatus(e.target.value as "সব" | CardRow["cardStatus"])
                }
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
              >
                <option value="সব">সব কার্ড</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Revoked">Revoked</option>
              </select>
              <select
                value={qrStatus}
                onChange={(e) =>
                  setQrStatus(
                    e.target.value as "সব" | "Valid" | "Invalid" | "Expired",
                  )
                }
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
              >
                <option value="সব">সব QR</option>
                <option value="Valid">Valid</option>
                <option value="Invalid">Invalid</option>
                <option value="Expired">Expired</option>
              </select>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => alert("ডেমো: ফিল্টার প্রয়োগ")}
                >
                  অনুসন্ধান
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

            {/* Table */}
            <div className="border border-[#cfd6e0] rounded overflow-hidden">
              <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold flex justify-between">
                <span>আমার রেশন কার্ড তালিকা</span>
                <span className="text-[12px] text-[#6b7280]">
                  মোট: {cardRows.length}
                </span>
              </div>
              <div className="overflow-x-auto bg-white">
                <table className="min-w-275 w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      <th className="border border-[#cfd6e0] p-2">Consumer</th>
                      <th className="border border-[#cfd6e0] p-2">নাম</th>
                      <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                      <th className="border border-[#cfd6e0] p-2">কার্ড</th>
                      <th className="border border-[#cfd6e0] p-2">QR</th>
                      <th className="border border-[#cfd6e0] p-2">
                        শেষ স্ক্যান
                      </th>
                      <th className="border border-[#cfd6e0] p-2">
                        আজকের টোকেন
                      </th>
                      <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardRows.map((r) => (
                      <tr
                        key={r.consumerId}
                        className="odd:bg-white even:bg-[#f8fafc]"
                      >
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {r.consumerId}
                        </td>
                        <td className="border border-[#cfd6e0] p-2">
                          {r.name}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {r.ward}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          <Badge tone={ToneForCardStatus(r.cardStatus)}>
                            {r.cardStatus}
                          </Badge>
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          <Badge tone={ToneForQrStatus(r.qrStatus)}>
                            {r.qrStatus}
                          </Badge>
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {r.lastScan}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {r.tokenToday ?? "-"}
                        </td>
                        <td className="border border-[#cfd6e0] p-2">
                          <div className="flex flex-wrap gap-1 justify-center">
                            <Button
                              variant="ghost"
                              onClick={() => alert("ডেমো: প্রোফাইল খুলবে")}
                            >
                              👁️
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                setOpenCardAction({
                                  open: true,
                                  row: r,
                                  action: "inactive",
                                })
                              }
                            >
                              ❌ নিষ্ক্রিয়
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() =>
                                setOpenCardAction({
                                  open: true,
                                  row: r,
                                  action: "revoke",
                                })
                              }
                            >
                              🚫 রিভোক
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                alert("ডেমো: QR রিজেনারেট রিকোয়েস্ট")
                              }
                            >
                              ♻️ QR
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {cardRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="p-4 text-center text-[#6b7280]"
                        >
                          কোনো ডেটা পাওয়া যায়নি।
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-3 text-[12px] text-[#374151]">
              <div>পৃষ্ঠা: ১ / ১০ (ডেমো)</div>
              <div className="flex gap-2">
                <Button variant="secondary">⬅ পূর্ববর্তী</Button>
                <Button variant="secondary">পরবর্তী ➡</Button>
              </div>
            </div>
          </>
        )}

        {tab === "tokens" && (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button onClick={() => alert("ডেমো: টোকেন ব্যাচ ক্যান্সেল")}>
                🧯 ব্যাচ ক্যান্সেল
              </Button>
              <Button
                variant="secondary"
                onClick={() => alert("ডেমো: ব্যবহৃত টোকেন ক্লোজ")}
              >
                ✅ ক্লোজ সেশন
              </Button>
              <Button
                variant="ghost"
                onClick={() => alert("ডেমো: টোকেন CSV এক্সপোর্ট")}
              >
                ⬇️ CSV
              </Button>
            </div>

            <div className="border border-[#cfd6e0] rounded overflow-hidden">
              <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
                টোকেন তালিকা (ডেমো)
              </div>
              <div className="overflow-x-auto bg-white">
                <table className="min-w-225 w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      <th className="border border-[#cfd6e0] p-2">Token</th>
                      <th className="border border-[#cfd6e0] p-2">Consumer</th>
                      <th className="border border-[#cfd6e0] p-2">পরিমাণ</th>
                      <th className="border border-[#cfd6e0] p-2">স্লট</th>
                      <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                      <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoTokens.map((t) => (
                      <tr
                        key={t.tokenId}
                        className="odd:bg-white even:bg-[#f8fafc]"
                      >
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {t.tokenId}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {t.consumerId}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {t.qtyKg} কেজি
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {t.slot}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          <Badge
                            tone={
                              ToneForTokenStatus(t.status) as
                                | "blue"
                                | "green"
                                | "red"
                            }
                          >
                            {t.status}
                          </Badge>
                        </td>
                        <td className="border border-[#cfd6e0] p-2">
                          <div className="flex flex-wrap gap-1 justify-center">
                            <Button
                              variant="ghost"
                              onClick={() =>
                                setOpenTokenPrint({ open: true, token: t })
                              }
                            >
                              🖨️
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => alert("ডেমো: টোকেন রি-ইস্যু")}
                            >
                              🔁
                            </Button>
                            <Button
                              variant="danger"
                              onClick={() => alert("ডেমো: টোকেন ক্যান্সেল")}
                            >
                              ❌
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "rotation" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">
                QR এক্সপায়ারি নীতি (ডেমো)
              </div>
              <div className="text-[12px] text-[#374151] space-y-1">
                <div>
                  সাইকেল: <span className="font-semibold">মাসিক</span>
                </div>
                <div>
                  পরবর্তী রোটেশন:{" "}
                  <span className="font-semibold">৩০ দিন পরে</span>
                </div>
                <div>কার্ড পুনঃব্যবহার রোধে QR রিজেনারেট হয়।</div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => alert("ডেমো: আজই রোটেশন শুরু")}>
                  ♻️ রোটেশন শুরু
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => alert("ডেমো: টেস্ট QR জেনারেট")}
                >
                  🧪 টেস্ট QR
                </Button>
              </div>
            </div>

            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">এক্সপায়ার্ড কিউ (ডেমো)</div>
              <div className="text-[12px] text-[#374151] mb-2">
                যেসব কার্ডের QR Expired হয়েছে সেগুলো এখানে দেখাবে।
              </div>
              <div className="border border-[#cfd6e0] rounded overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#f8fafc]">
                    <tr>
                      <th className="border p-2">Consumer</th>
                      <th className="border p-2">QR</th>
                      <th className="border p-2">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2 text-center">C010</td>
                      <td className="border p-2 text-center">
                        <Badge tone="yellow">Expired</Badge>
                      </td>
                      <td className="border p-2 text-center">
                        <Button
                          variant="secondary"
                          onClick={() => alert("ডেমো: QR রিজেনারেট")}
                        >
                          ♻️ রিজেনারেট
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "offline" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">অফলাইন স্ক্যান কিউ</div>
              <div className="text-[12px] text-[#374151]">
                ইন্টারনেট না থাকলে QR স্ক্যান ক্যাশ হবে, পরে সিঙ্ক হবে।
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => alert("ডেমো: এখনই সিঙ্ক")}>
                  🔄 সিঙ্ক
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => alert("ডেমো: কিউ ক্লিয়ার")}
                >
                  🧹 ক্লিয়ার
                </Button>
              </div>
            </div>

            <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
              <div className="font-semibold mb-2">কিউ আইটেম (ডেমো)</div>
              <div className="border border-[#cfd6e0] rounded overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#f8fafc]">
                    <tr>
                      <th className="border p-2">সময়</th>
                      <th className="border p-2">ডেটা</th>
                      <th className="border p-2">স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border p-2 text-center">-</td>
                      <td className="border p-2 text-center">
                        কোনো অফলাইন কিউ নেই
                      </td>
                      <td className="border p-2 text-center">
                        <Badge tone="gray">OK</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </PortalSection>

      {/* Modals */}
      <Modal
        open={openScan}
        title="QR স্ক্যান (ডেমো ক্যামেরা)"
        onClose={() => setOpenScan(false)}
      >
        <div className="border border-dashed rounded h-52 flex items-center justify-center text-[#6b7280]">
          📷 ক্যামেরা প্রিভিউ এখানে
        </div>
        <div className="mt-3 text-[12px] text-[#374151]">
          বাস্তবে এখানে QR scanner লাইব্রেরি বসবে (later).
        </div>
        <div className="mt-3 flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setOpenScan(false)}>
            বন্ধ
          </Button>
          <Button onClick={() => alert("ডেমো: স্ক্যান সফল")}>
            ডেমো স্ক্যান
          </Button>
        </div>
      </Modal>

      <Modal
        open={openCardAction.open}
        title={`কার্ড অ্যাকশন: ${openCardAction.action === "revoke" ? "রিভোক" : "নিষ্ক্রিয়"} (ডেমো)`}
        onClose={() => setOpenCardAction({ open: false })}
      >
        <div className="text-[13px] text-[#111827] space-y-2">
          <div>
            Consumer:{" "}
            <span className="font-semibold">
              {openCardAction.row?.consumerId}
            </span>{" "}
            — {openCardAction.row?.name}
          </div>
          <div className="text-[12px] text-[#6b7280]">
            নোট: এই অ্যাকশন হলে QR Invalid হবে এবং বিতরণে অংশগ্রহণ বন্ধ হবে।
          </div>
          <div>
            <div className="text-[12px] mb-1">কারণ লিখুন</div>
            <textarea
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              rows={3}
              placeholder="কারণ..."
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setOpenCardAction({ open: false })}
            >
              বাতিল
            </Button>
            <Button
              variant={
                openCardAction.action === "revoke" ? "danger" : "primary"
              }
              onClick={() => alert("ডেমো: রিকোয়েস্ট সাবমিট")}
            >
              নিশ্চিত করুন
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={openTokenPrint.open}
        title="টোকেন প্রিন্ট (ডেমো স্লিপ)"
        onClose={() => setOpenTokenPrint({ open: false })}
      >
        <div className="border border-[#cfd6e0] rounded p-3 bg-[#fbfdff] text-[13px]">
          <div className="font-semibold">আমার রেশন টোকেন</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
            <div>
              Token:{" "}
              <span className="font-semibold">
                {openTokenPrint.token?.tokenId ?? "-"}
              </span>
            </div>
            <div>
              Consumer:{" "}
              <span className="font-semibold">
                {openTokenPrint.token?.consumerId ?? "-"}
              </span>
            </div>
            <div>
              পরিমাণ:{" "}
              <span className="font-semibold">
                {openTokenPrint.token?.qtyKg ?? "-"} কেজি
              </span>
            </div>
            <div>
              স্লট:{" "}
              <span className="font-semibold">
                {openTokenPrint.token?.slot ?? "-"}
              </span>
            </div>
          </div>
          <div className="mt-3 text-[12px] text-[#6b7280]">
            (ডেমো) — পরে QR/Barcode সহ প্রিন্ট ফরম্যাট হবে।
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => setOpenTokenPrint({ open: false })}
          >
            বন্ধ
          </Button>
          <Button onClick={() => alert("ডেমো: প্রিন্ট কমান্ড")}>
            🖨️ প্রিন্ট
          </Button>
        </div>
      </Modal>
    </div>
  );
}
