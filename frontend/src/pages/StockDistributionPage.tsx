import { useMemo, useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Modal from "../components/ui/Modal";

type DistRow = {
  tokenId: string;
  consumerId: string;
  name: string;
  ward: string;
  qtyKg: number; // expected
  actualKg: number | null;
  status: "Issued" | "Delivered" | "Mismatch" | "Paused";
  time: string;
};

type StockItem = {
  item: string;
  unit: string;
  opening: number;
  received: number;
  distributed: number;
  balance: number;
};

const demoStock: StockItem[] = [
  {
    item: "চাল",
    unit: "কেজি",
    opening: 250,
    received: 0,
    distributed: 190,
    balance: 60,
  },
  {
    item: "ডাল",
    unit: "কেজি",
    opening: 120,
    received: 0,
    distributed: 70,
    balance: 50,
  },
  {
    item: "তেল",
    unit: "লিটার",
    opening: 80,
    received: 0,
    distributed: 38,
    balance: 42,
  },
];

const demoRows: DistRow[] = [
  {
    tokenId: "T-1001",
    consumerId: "C001",
    name: "রহিম",
    ward: "ওয়ার্ড-০১",
    qtyKg: 5,
    actualKg: 5,
    status: "Delivered",
    time: "10:12 AM",
  },
  {
    tokenId: "T-1002",
    consumerId: "C003",
    name: "আয়েশা",
    ward: "ওয়ার্ড-০১",
    qtyKg: 5,
    actualKg: null,
    status: "Issued",
    time: "10:14 AM",
  },
  {
    tokenId: "T-1004",
    consumerId: "C006",
    name: "মাহি",
    ward: "ওয়ার্ড-০২",
    qtyKg: 5,
    actualKg: 4.5,
    status: "Mismatch",
    time: "10:18 AM",
  },
  {
    tokenId: "T-1006",
    consumerId: "C010",
    name: "হাসান",
    ward: "ওয়ার্ড-০২",
    qtyKg: 5,
    actualKg: null,
    status: "Paused",
    time: "10:22 AM",
  },
];

function toneForStatus(s: DistRow["status"]) {
  if (s === "Delivered") return "green";
  if (s === "Mismatch") return "red";
  if (s === "Paused") return "yellow";
  return "blue";
}

export default function StockDistributionPage() {
  // Session controls (demo)
  const [sessionStatus, setSessionStatus] = useState<
    "Running" | "Paused" | "Closed"
  >("Running");
  const [mode, setMode] = useState<"Online" | "Offline">("Online");

  // Filters
  const [tab, setTab] = useState<"live" | "reconcile" | "stock">("live");
  const [q, setQ] = useState("");
  const [ward, setWard] = useState("সব");
  const [status, setStatus] = useState<"সব" | DistRow["status"]>("সব");

  // Modals
  const [openIssue, setOpenIssue] = useState(false);
  const [openWeight, setOpenWeight] = useState(false);
  const [openClose, setOpenClose] = useState(false);
  const [openOffline, setOpenOffline] = useState(false);

  // Weight modal state
  const [selectedToken, setSelectedToken] = useState<DistRow | null>(null);
  const [expectedKg, setExpectedKg] = useState(5);
  const [actualKg, setActualKg] = useState(5);

  const filtered = useMemo(() => {
    return demoRows.filter((r) => {
      const matchQ =
        q.trim() === "" ||
        r.tokenId.toLowerCase().includes(q.toLowerCase()) ||
        r.consumerId.toLowerCase().includes(q.toLowerCase()) ||
        r.name.includes(q);

      const matchWard = ward === "সব" || r.ward === ward;
      const matchStatus = status === "সব" || r.status === status;

      return matchQ && matchWard && matchStatus;
    });
  }, [q, ward, status]);

  // KPI computed (demo)
  const kpi = useMemo(() => {
    const total = demoRows.length;
    const issued = demoRows.filter((x) => x.status === "Issued").length;
    const delivered = demoRows.filter((x) => x.status === "Delivered").length;
    const mismatch = demoRows.filter((x) => x.status === "Mismatch").length;
    const paused = demoRows.filter((x) => x.status === "Paused").length;

    const expectedTotal = demoRows.reduce((sum, r) => sum + r.qtyKg, 0);
    const actualTotal = demoRows.reduce((sum, r) => sum + (r.actualKg ?? 0), 0);

    return {
      total,
      issued,
      delivered,
      mismatch,
      paused,
      expectedTotal,
      actualTotal,
    };
  }, []);

  const mismatchDelta = Number(
    (kpi.expectedTotal - kpi.actualTotal).toFixed(2),
  );

  return (
    <div className="space-y-3">
      {/* Session header */}
      <PortalSection
        title="স্টক ও বিতরণ সেশন (Token + Weight + Stock Reconciliation)"
        right={
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (sessionStatus === "Closed")
                  return alert("সেশন বন্ধ আছে। নতুন সেশন খুলুন (ডেমো)");
                setSessionStatus("Running");
              }}
            >
              ▶️ চালু
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (sessionStatus === "Closed") return alert("সেশন বন্ধ আছে।");
                setSessionStatus("Paused");
              }}
            >
              ⏸️ বিরতি
            </Button>
            <Button variant="danger" onClick={() => setOpenClose(true)}>
              ⛔ সেশন বন্ধ
            </Button>

            <Button
              variant="ghost"
              onClick={() =>
                setMode((m) => (m === "Online" ? "Offline" : "Online"))
              }
            >
              {mode === "Online" ? "🌐 অনলাইন" : "📴 অফলাইন"} মোড
            </Button>

            <Button
              variant="secondary"
              onClick={() => alert("ডেমো: প্রিন্ট হবে")}
            >
              🖨️ প্রিন্ট
            </Button>
            <Button
              variant="secondary"
              onClick={() => alert("ডেমো: এক্সপোর্ট (Excel/PDF) হবে")}
            >
              ⬇️ এক্সপোর্ট
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
          {mode === "Online" ? (
            <Badge tone="blue">অনলাইন</Badge>
          ) : (
            <Badge tone="purple">অফলাইন (ক্যাশ)</Badge>
          )}

          <span className="ml-4 text-[#6b7280]">
            টিপস: QR স্ক্যান → টোকেন → ওজন যাচাই → বিতরণ → স্টক আপডেট → অডিট লগ
          </span>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={() => setTab("live")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "live"
                ? "bg-[#1f77b4] text-white border-[#1f77b4]"
                : "bg-white border-[#cfd6e0]"
            }`}
          >
            🟢 লাইভ বিতরণ
          </button>
          <button
            onClick={() => setTab("reconcile")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "reconcile"
                ? "bg-[#1f77b4] text-white border-[#1f77b4]"
                : "bg-white border-[#cfd6e0]"
            }`}
          >
            🧮 রিকনসাইলিয়েশন
          </button>
          <button
            onClick={() => setTab("stock")}
            className={`px-3 py-1.5 rounded text-[13px] border ${
              tab === "stock"
                ? "bg-[#1f77b4] text-white border-[#1f77b4]"
                : "bg-white border-[#cfd6e0]"
            }`}
          >
            📦 স্টক ম্যানেজমেন্ট
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-3">
          <div className="border rounded p-3 bg-white">
            <div className="text-[12px] text-[#374151]">মোট টোকেন</div>
            <div className="text-[20px] font-bold">{kpi.total}</div>
          </div>
          <div className="border rounded p-3 bg-white">
            <div className="text-[12px] text-[#374151]">Issued</div>
            <div className="text-[20px] font-bold">{kpi.issued}</div>
          </div>
          <div className="border rounded p-3 bg-white">
            <div className="text-[12px] text-[#374151]">সফল বিতরণ</div>
            <div className="text-[20px] font-bold">{kpi.delivered}</div>
          </div>
          <div className="border rounded p-3 bg-white">
            <div className="text-[12px] text-[#374151]">মিসম্যাচ</div>
            <div className="text-[20px] font-bold text-[#b91c1c]">
              {kpi.mismatch}
            </div>
          </div>
          <div className="border rounded p-3 bg-white">
            <div className="text-[12px] text-[#374151]">
              Expected মোট (কেজি)
            </div>
            <div className="text-[20px] font-bold">{kpi.expectedTotal}</div>
          </div>
          <div className="border rounded p-3 bg-white">
            <div className="text-[12px] text-[#374151]">
              Delta (Expected-Actual)
            </div>
            <div
              className={`text-[20px] font-bold ${mismatchDelta > 0 ? "text-[#b91c1c]" : ""}`}
            >
              {mismatchDelta}
            </div>
          </div>
        </div>

        {/* Tab content */}
        {tab === "live" && (
          <div className="mt-4 space-y-3">
            {/* Actions row */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setOpenIssue(true)}>🎫 টোকেন ইস্যু</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedToken(demoRows[1]);
                  setExpectedKg(5);
                  setActualKg(5);
                  setOpenWeight(true);
                }}
              >
                ⚖️ ওজন যাচাই
              </Button>
              <Button variant="secondary" onClick={() => setOpenOffline(true)}>
                📴 অফলাইন কিউ
              </Button>
              <Button
                variant="ghost"
                onClick={() => alert("ডেমো: জরুরি অ্যালার্ট তৈরি")}
              >
                🚨 জরুরি অ্যালার্ট
              </Button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
                placeholder="সার্চ: Token / Consumer / নাম"
              />
              <select
                value={ward}
                onChange={(e) => setWard(e.target.value)}
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
              >
                <option value="সব">সব ওয়ার্ড</option>
                <option value="ওয়ার্ড-০১">ওয়ার্ড-০১</option>
                <option value="ওয়ার্ড-০২">ওয়ার্ড-০২</option>
              </select>

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "সব" | DistRow["status"])
                }
                className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
              >
                <option value="সব">সব স্ট্যাটাস</option>
                <option value="Issued">Issued</option>
                <option value="Delivered">Delivered</option>
                <option value="Mismatch">Mismatch</option>
                <option value="Paused">Paused</option>
              </select>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => alert("ডেমো: ফিল্টার প্রয়োগ হয়েছে")}
                >
                  অনুসন্ধান
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

            {/* Distribution table */}
            <div className="border border-[#cfd6e0] rounded overflow-hidden">
              <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold flex items-center justify-between">
                <span>বিতরণ রেজিস্টার</span>
                <span className="text-[12px] text-[#6b7280]">
                  মোট: {filtered.length}
                </span>
              </div>

              <div className="overflow-x-auto bg-white">
                <table className="w-full min-w-[1000px] text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      <th className="border border-[#cfd6e0] p-2">সময়</th>
                      <th className="border border-[#cfd6e0] p-2">Token</th>
                      <th className="border border-[#cfd6e0] p-2">Consumer</th>
                      <th className="border border-[#cfd6e0] p-2">নাম</th>
                      <th className="border border-[#cfd6e0] p-2">ওয়ার্ড</th>
                      <th className="border border-[#cfd6e0] p-2">
                        Expected (কেজি)
                      </th>
                      <th className="border border-[#cfd6e0] p-2">
                        Actual (কেজি)
                      </th>
                      <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                      <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r.tokenId}
                        className="odd:bg-white even:bg-[#f8fafc]"
                      >
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {r.time}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {r.tokenId}
                        </td>
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
                          {r.qtyKg.toFixed(2)}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {r.actualKg === null ? "—" : r.actualKg.toFixed(2)}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          <Badge
                            tone={
                              toneForStatus(r.status) as
                                | "green"
                                | "red"
                                | "yellow"
                                | "blue"
                            }
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="border border-[#cfd6e0] p-2">
                          <div className="flex flex-wrap gap-1 justify-center">
                            <Button
                              variant="ghost"
                              onClick={() =>
                                alert(`ডেমো: ${r.consumerId} প্রোফাইল`)
                              }
                            >
                              👁️
                            </Button>
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
                            <Button
                              variant="danger"
                              onClick={() =>
                                alert("ডেমো: বিতরণ বাতিল/ফ্ল্যাগড (অডিট হবে)")
                              }
                            >
                              🚫 ফ্ল্যাগ
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filtered.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
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

            {/* Pagination (demo) */}
            <div className="flex items-center justify-between mt-2 text-[12px] text-[#374151]">
              <div>পৃষ্ঠা: ১ / ৩ (ডেমো)</div>
              <div className="flex gap-2">
                <Button variant="secondary">⬅ পূর্ববর্তী</Button>
                <Button variant="secondary">পরবর্তী ➡</Button>
              </div>
            </div>
          </div>
        )}

        {tab === "reconcile" && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="border rounded p-3 bg-white">
                <div className="font-semibold text-[13px]">
                  🧮 রিসোর্স রিকনসাইলিয়েশন
                </div>
                <div className="text-[12px] text-[#374151] mt-1">
                  Expected Resource == Distributed Resource ? না হলে Fraud
                  suspected → অডিট লগ + এডমিন নোটিফাই।
                </div>
              </div>

              <div className="border rounded p-3 bg-[#fff7ed]">
                <div className="font-semibold text-[13px]">
                  ⚠ মিসম্যাচ সারাংশ
                </div>
                <div className="text-[12px] mt-1">
                  Expected মোট:{" "}
                  <span className="font-semibold">{kpi.expectedTotal} kg</span>
                </div>
                <div className="text-[12px]">
                  Actual মোট:{" "}
                  <span className="font-semibold">{kpi.actualTotal} kg</span>
                </div>
                <div className="text-[12px] text-[#b91c1c] font-semibold mt-1">
                  Delta: {mismatchDelta} kg (ডেমো)
                </div>
              </div>

              <div className="border rounded p-3 bg-white">
                <div className="font-semibold text-[13px]">✅ অ্যাকশন</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button
                    onClick={() => alert("ডেমো: রিকনসাইল রিপোর্ট জেনারেট")}
                  >
                    রিপোর্ট জেনারেট
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => alert("ডেমো: এডমিন নোটিফাই")}
                  >
                    এডমিন নোটিফাই
                  </Button>
                </div>
              </div>
            </div>

            <div className="border border-[#cfd6e0] rounded overflow-hidden">
              <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
                মিসম্যাচ কেস তালিকা (ডেমো)
              </div>

              <table className="w-full text-[12px] border-collapse bg-white">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="border border-[#cfd6e0] p-2">Token</th>
                    <th className="border border-[#cfd6e0] p-2">Expected</th>
                    <th className="border border-[#cfd6e0] p-2">Actual</th>
                    <th className="border border-[#cfd6e0] p-2">Delta</th>
                    <th className="border border-[#cfd6e0] p-2">স্ট্যাটাস</th>
                    <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      T-1004
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      5.00
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center text-[#b91c1c] font-semibold">
                      4.50
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center text-[#b91c1c] font-semibold">
                      0.50
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      <Badge tone="red">Fraud Suspected</Badge>
                    </td>
                    <td className="border border-[#cfd6e0] p-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button
                          variant="secondary"
                          onClick={() => alert("ডেমো: কেস ওপেন")}
                        >
                          কেস ওপেন
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => alert("ডেমো: ডিলার ফ্ল্যাগড")}
                        >
                          ডিলার ফ্ল্যাগ
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "stock" && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => alert("ডেমো: নতুন স্টক যোগ হবে")}>
                ➕ স্টক যোগ
              </Button>
              <Button
                variant="secondary"
                onClick={() => alert("ডেমো: স্টক এডজাস্টমেন্ট")}
              >
                🛠️ এডজাস্ট
              </Button>
              <Button
                variant="secondary"
                onClick={() => alert("ডেমো: স্টক মুভমেন্ট রিপোর্ট")}
              >
                📄 মুভমেন্ট রিপোর্ট
              </Button>
            </div>

            <div className="border border-[#cfd6e0] rounded overflow-hidden">
              <div className="bg-[#e9edf3] px-3 py-2 text-[13px] font-semibold">
                স্টক রেজিস্টার
              </div>
              <div className="overflow-x-auto bg-white">
                <table className="min-w-[900px] w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      <th className="border border-[#cfd6e0] p-2">আইটেম</th>
                      <th className="border border-[#cfd6e0] p-2">ইউনিট</th>
                      <th className="border border-[#cfd6e0] p-2">Opening</th>
                      <th className="border border-[#cfd6e0] p-2">Received</th>
                      <th className="border border-[#cfd6e0] p-2">
                        Distributed
                      </th>
                      <th className="border border-[#cfd6e0] p-2">Balance</th>
                      <th className="border border-[#cfd6e0] p-2">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoStock.map((s) => (
                      <tr
                        key={s.item}
                        className="odd:bg-white even:bg-[#f8fafc]"
                      >
                        <td className="border border-[#cfd6e0] p-2">
                          {s.item}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {s.unit}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {s.opening}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {s.received}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          {s.distributed}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center font-semibold">
                          {s.balance}
                        </td>
                        <td className="border border-[#cfd6e0] p-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="secondary"
                              onClick={() => alert("ডেমো: লেজার দেখুন")}
                            >
                              📒 লেজার
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => alert("ডেমো: অডিট ট্রেইল")}
                            >
                              🧾 অডিট
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </PortalSection>

      {/* Modals */}
      <Modal
        open={openIssue}
        title="টোকেন ইস্যু (ডেমো) — QR স্ক্যান/ম্যানুয়াল"
        onClose={() => setOpenIssue(false)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-[12px] mb-1">আমার রেশন QR স্ক্যান</div>
            <div className="border border-dashed rounded h-36 flex items-center justify-center text-[#6b7280]">
              📷 ক্যামেরা প্রিভিউ এখানে
            </div>
            <div className="text-[12px] text-[#6b7280] mt-1">
              স্ক্যান হলে → কার্ড ভ্যালিডেশন → টোকেন জেনারেট → শর্ট লিস্টে যোগ
            </div>
          </div>

          <div>
            <div className="text-[12px] mb-1">ম্যানুয়াল Consumer ID</div>
            <input
              className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
              placeholder="যেমন: C001"
            />
            <div className="text-[12px] text-[#6b7280] mt-1">
              (ডেমো) ম্যানুয়াল ইস্যু করলে অডিট লগে কারণ যুক্ত হবে।
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[12px] mb-1">পরিমাণ (কেজি)</div>
                <input
                  className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
                  defaultValue="5"
                />
              </div>
              <div>
                <div className="text-[12px] mb-1">স্লট</div>
                <select className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white">
                  <option>সকাল</option>
                  <option>দুপুর</option>
                  <option>বিকাল</option>
                </select>
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpenIssue(false)}>
                বাতিল
              </Button>
              <Button
                onClick={() => alert("ডেমো: টোকেন ইস্যু হয়েছে + অডিট লগ")}
              >
                ইস্যু করুন
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={openWeight}
        title="IoT ওজন যাচাই (ডেমো)"
        onClose={() => setOpenWeight(false)}
      >
        <div className="text-[12px] text-[#374151]">
          টোকেন:{" "}
          <span className="font-semibold">{selectedToken?.tokenId ?? "—"}</span>{" "}
          | কনজিউমার:{" "}
          <span className="font-semibold">
            {selectedToken?.consumerId ?? "—"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <div className="border rounded p-3 bg-white">
            <div className="text-[12px] text-[#374151]">Expected (কেজি)</div>
            <input
              type="number"
              step="0.01"
              value={expectedKg}
              onChange={(e) => setExpectedKg(Number(e.target.value))}
              className="mt-1 w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            />
          </div>

          <div className="border rounded p-3 bg-white">
            <div className="text-[12px] text-[#374151]">
              Actual (IoT) (কেজি)
            </div>
            <input
              type="number"
              step="0.01"
              value={actualKg}
              onChange={(e) => setActualKg(Number(e.target.value))}
              className="mt-1 w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
            />
            <div className="text-[12px] text-[#6b7280] mt-1">
              (ডেমো) সেন্সর রিডিং
            </div>
          </div>

          <div className="border rounded p-3 bg-[#f8fafc]">
            <div className="text-[12px] text-[#374151]">ফলাফল</div>
            <div className="mt-2">
              {Math.abs(expectedKg - actualKg) <= 0.05 ? (
                <Badge tone="green">✅ মিলেছে</Badge>
              ) : (
                <Badge tone="red">⚠ মিসম্যাচ</Badge>
              )}
            </div>
            <div className="text-[12px] text-[#6b7280] mt-2">
              থ্রেশহোল্ড: ±০.০৫ কেজি (ডেমো)
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => alert("ডেমো: বিতরণ সাময়িক বিরতি")}
          >
            ⏸️ বিতরণ থামান
          </Button>
          <Button
            variant="danger"
            onClick={() => alert("ডেমো: অডিট লগ + এডমিন অ্যালার্ট (Critical)")}
          >
            🚨 ফ্রড অ্যালার্ট
          </Button>
          <Button onClick={() => alert("ডেমো: ওজন সেভ + স্টক আপডেট")}>
            সংরক্ষণ
          </Button>
        </div>
      </Modal>

      <Modal
        open={openClose}
        title="সেশন বন্ধ (ডেমো)"
        onClose={() => setOpenClose(false)}
      >
        <div className="text-[13px] text-[#111827]">
          সেশন বন্ধ করলে আজকের বিতরণ ফাইনালাইজ হবে, স্টক রিকনসাইল হবে এবং
          রিপোর্ট জেনারেট হবে।
        </div>

        <div className="mt-3 border rounded p-3 bg-[#fff7ed] text-[12px]">
          ⚠ সতর্কতা: মিসম্যাচ থাকলে “Fraud suspected” ফ্ল্যাগ তৈরি হবে (ডেমো)।
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpenClose(false)}>
            বাতিল
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setSessionStatus("Closed");
              setOpenClose(false);
              alert("ডেমো: সেশন বন্ধ + রিপোর্ট তৈরি + অডিট লগ");
            }}
          >
            ⛔ বন্ধ করুন
          </Button>
        </div>
      </Modal>

      <Modal
        open={openOffline}
        title="অফলাইন কিউ (ডেমো)"
        onClose={() => setOpenOffline(false)}
      >
        <div className="text-[12px] text-[#374151] mb-2">
          ইন্টারনেট না থাকলে স্ক্যান/টোকেন ক্যাশ হবে। অনলাইন হলে সিঙ্ক হবে।
        </div>

        <div className="border border-[#cfd6e0] rounded overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">টাইম</th>
                <th className="border p-2">টাইপ</th>
                <th className="border p-2">রেফারেন্স</th>
                <th className="border p-2">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2 text-center">—</td>
                <td className="border p-2 text-center">—</td>
                <td className="border p-2 text-center">—</td>
                <td className="border p-2 text-center">কোনো পেন্ডিং নেই</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => alert("ডেমো: সিঙ্ক চেষ্টা")}
          >
            🔄 সিঙ্ক
          </Button>
          <Button onClick={() => setOpenOffline(false)}>ঠিক আছে</Button>
        </div>
      </Modal>
    </div>
  );
}
