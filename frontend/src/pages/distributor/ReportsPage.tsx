import { useEffect, useMemo, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { useAuth } from "../../context/useAuth";
import {
  getAuditLogs,
  getConsumerCards,
  getDistributionReport,
  getReportSummary,
  type AuditLogEntry,
  type ConsumerCardRow,
  type DistributionReportRow,
  type TokenStatus,
} from "../../services/api";

type Tab = "distribution" | "stock" | "card" | "audit";
const STOCK_ITEMS = ["চাল", "ডাল", "পেঁয়াজ"] as const;

export default function ReportsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("distribution");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TokenStatus | "">("");
  const [sessionCode, setSessionCode] = useState("");
  const [consumerCode, setConsumerCode] = useState("");
  const [item, setItem] = useState<"" | "চাল" | "ডাল" | "পেঁয়াজ">("");
  const [mismatch, setMismatch] = useState<"" | "true" | "false">("");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "tokenCode" | "expectedKg" | "actualKg"
  >("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState({
    totalTokens: 0,
    usedTokens: 0,
    mismatches: 0,
  });
  const [rows, setRows] = useState<DistributionReportRow[]>([]);
  const [totals, setTotals] = useState({
    expectedKg: 0,
    actualKg: 0,
    differenceKg: 0,
    mismatches: 0,
    itemWise: {
      চাল: { expectedKg: 0, actualKg: 0, differenceKg: 0 },
      ডাল: { expectedKg: 0, actualKg: 0, differenceKg: 0 },
      পেঁয়াজ: { expectedKg: 0, actualKg: 0, differenceKg: 0 },
    },
  });
  const [cardRows, setCardRows] = useState<ConsumerCardRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [scopeInfo, setScopeInfo] = useState({ division: "", ward: "" });

  const cardSummary = useMemo(() => {
    const total = cardRows.length;
    const active = cardRows.filter((x) => x.cardStatus === "Active").length;
    const revoked = cardRows.filter((x) => x.cardStatus === "Revoked").length;
    const expired = cardRows.filter((x) => x.qrStatus === "Expired").length;
    return { total, active, revoked, expired };
  }, [cardRows]);

  const loadData = async (next?: Partial<Record<string, string>>) => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, distributionData, auditData, cardsData] =
        await Promise.all([
          getReportSummary(),
          getDistributionReport({
            page: 1,
            limit: 200,
            from: (next?.from ?? from) || undefined,
            to: (next?.to ?? to) || undefined,
            search: (next?.search ?? search).trim() || undefined,
            status: ((next?.status as TokenStatus | "") ?? status) || undefined,
            sessionCode: (next?.sessionCode ?? sessionCode).trim() || undefined,
            consumerCode:
              (next?.consumerCode ?? consumerCode).trim() || undefined,
            item:
              ((next?.item as "" | "চাল" | "ডাল" | "পেঁয়াজ") ?? item) ||
              undefined,
            mismatch:
              ((next?.mismatch as "" | "true" | "false") ?? mismatch) ||
              undefined,
            sortBy,
            sortOrder,
          }),
          getAuditLogs({ page: 1, limit: 30 }),
          getConsumerCards({
            page: 1,
            limit: 500,
            withImage: false,
          }),
        ]);

      setSummary(summaryData);
      setRows(distributionData.rows);
      const itemWise = {
        চাল: {
          expectedKg: Number(
            distributionData.totals?.itemWise?.চাল?.expectedKg || 0,
          ),
          actualKg: Number(
            distributionData.totals?.itemWise?.চাল?.actualKg || 0,
          ),
          differenceKg: Number(
            distributionData.totals?.itemWise?.চাল?.differenceKg || 0,
          ),
        },
        ডাল: {
          expectedKg: Number(
            distributionData.totals?.itemWise?.ডাল?.expectedKg || 0,
          ),
          actualKg: Number(
            distributionData.totals?.itemWise?.ডাল?.actualKg || 0,
          ),
          differenceKg: Number(
            distributionData.totals?.itemWise?.ডাল?.differenceKg || 0,
          ),
        },
        পেঁয়াজ: {
          expectedKg: Number(
            distributionData.totals?.itemWise?.পেঁয়াজ?.expectedKg || 0,
          ),
          actualKg: Number(
            distributionData.totals?.itemWise?.পেঁয়াজ?.actualKg || 0,
          ),
          differenceKg: Number(
            distributionData.totals?.itemWise?.পেঁয়াজ?.differenceKg || 0,
          ),
        },
      };
      setTotals({
        expectedKg: Number(distributionData.totals?.expectedKg || 0),
        actualKg: Number(distributionData.totals?.actualKg || 0),
        differenceKg: Number(distributionData.totals?.differenceKg || 0),
        mismatches: Number(distributionData.totals?.mismatches || 0),
        itemWise,
      });
      setScopeInfo({
        division: distributionData.scope?.division || user?.division || "",
        ward: distributionData.scope?.ward || user?.wardNo || user?.ward || "",
      });
      setAuditRows(auditData.logs);
      setCardRows(cardsData.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিপোর্ট ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const csvText = useMemo(() => {
    const headers = [
      "Date",
      "Division",
      "Ward",
      "SessionCode",
      "SessionStatus",
      "Distributor",
      "ConsumerCode",
      "ConsumerName",
      "Category",
      "Token",
      "Item",
      "ExpectedKg",
      "ActualKg",
      "Mismatch",
      "MismatchReason",
      "Status",
    ];
    const lines = rows.map((row) => [
      new Date(row.createdAt).toISOString(),
      row.division || "",
      row.ward || "",
      row.sessionCode || "",
      row.sessionStatus || "",
      row.distributorName || "",
      row.consumerCode,
      row.consumerName || "",
      row.category || "",
      row.tokenCode,
      row.rationItem || "",
      String(row.expectedKg),
      String(row.actualKg),
      row.mismatch ? "Yes" : "No",
      row.mismatchReason || "",
      row.tokenStatus,
    ]);

    return [headers, ...lines]
      .map((line) =>
        line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
  }, [rows]);

  const downloadCsv = () => {
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvText], {
      type: "text/csv;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distribution-report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const win = window.open("", "_blank", "width=1200,height=820");
    if (!win) return;
    const printedAt = new Date().toLocaleString("bn-BD");
    const filters = [
      from ? `From: ${from}` : "",
      to ? `To: ${to}` : "",
      search ? `Search: ${search}` : "",
      sessionCode ? `Session: ${sessionCode}` : "",
      consumerCode ? `Consumer: ${consumerCode}` : "",
      status ? `Status: ${status}` : "",
      mismatch ? `Mismatch: ${mismatch}` : "",
      item ? `Item: ${item}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const titleMap: Record<Tab, string> = {
      distribution: "বিতরণ রিপোর্ট",
      stock: "স্টক ও রিকনসিলিয়েশন",
      card: "AR রেশন কার্ড বিশ্লেষণ",
      audit: "অডিট ও জালিয়াতি রিপোর্ট",
    };

    const commonHead = `
      <style>
        body{font-family:Arial,sans-serif;margin:0;background:#f1f5f9;color:#0f172a}
        .wrap{padding:20px}
        .card{background:#fff;border:1px solid #cbd5e1;border-radius:12px;overflow:hidden}
        .head{padding:14px 16px;background:linear-gradient(120deg,#0b4f88,#0284c7,#14b8a6);color:#fff}
        .head h2{margin:0;font-size:20px}
        .head .sub{font-size:12px;opacity:.95;margin-top:4px}
        .meta{padding:10px 16px;font-size:12px;color:#475569;border-bottom:1px solid #e2e8f0}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #cbd5e1;padding:6px;vertical-align:top}
        th{background:#f1f5f9}
      </style>
    `;

    let tableHtml = "";

    if (tab === "distribution") {
      tableHtml = `
        <table>
          <thead><tr><th>Date</th><th>Session</th><th>Consumer</th><th>Area</th><th>Item</th><th>Expected</th><th>Actual</th><th>Mismatch</th><th>Reason</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `<tr>
                <td>${new Date(row.createdAt).toLocaleString("bn-BD")}</td>
                <td>${row.sessionCode || "—"}<br/>${row.sessionStatus || ""}</td>
                <td>${row.consumerCode || "—"}<br/>${row.consumerName || ""}</td>
                <td>${row.division || "—"}<br/>Ward ${row.ward || "—"}</td>
                <td>${row.rationItem || "—"}</td>
                <td>${Number(row.expectedKg || 0).toFixed(2)}</td>
                <td>${Number(row.actualKg || 0).toFixed(2)}</td>
                <td>${row.mismatch ? "Yes" : "No"}</td>
                <td>${row.mismatchReason || "—"}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      `;
    } else if (tab === "stock") {
      tableHtml = `
        <table>
          <thead><tr><th>আইটেম</th><th>Expected</th><th>Actual</th><th>Difference</th></tr></thead>
          <tbody>
            ${STOCK_ITEMS.map(
              (stockItem) => `<tr>
              <td>${stockItem}</td>
              <td>${Number(totals.itemWise?.[stockItem]?.expectedKg || 0).toFixed(2)}</td>
              <td>${Number(totals.itemWise?.[stockItem]?.actualKg || 0).toFixed(2)}</td>
              <td>${Number(totals.itemWise?.[stockItem]?.differenceKg || 0).toFixed(2)}</td>
            </tr>`,
            ).join("")}
            <tr>
              <td><b>মোট</b></td>
              <td><b>${totals.expectedKg.toFixed(2)}</b></td>
              <td><b>${totals.actualKg.toFixed(2)}</b></td>
              <td><b>${totals.differenceKg.toFixed(2)}</b></td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (tab === "card") {
      tableHtml = `
        <table>
          <thead><tr><th>Consumer Code</th><th>নাম</th><th>Category</th><th>এলাকা</th><th>Card</th><th>QR</th><th>মেয়াদ</th></tr></thead>
          <tbody>
            ${cardRows
              .map(
                (card) => `<tr>
                <td>${card.consumerCode || "—"}</td>
                <td>${card.name || "—"}</td>
                <td>${card.category || "—"}</td>
                <td>${card.division || "—"} / ${card.ward || "—"}</td>
                <td>${card.cardStatus || "—"}</td>
                <td>${card.qrStatus || "—"}</td>
                <td>${card.validTo ? new Date(card.validTo).toLocaleDateString("bn-BD") : "—"}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      `;
    } else {
      tableHtml = `
        <table>
          <thead><tr><th>সময়</th><th>ইভেন্ট</th><th>এলাকা/সেশন</th><th>রেফারেন্স</th><th>গুরুত্ব</th></tr></thead>
          <tbody>
            ${auditRows
              .map(
                (log) => `<tr>
                <td>${new Date(log.createdAt).toLocaleString("bn-BD")}</td>
                <td>${log.action}</td>
                <td>${log.division || "—"} / ${log.ward || "—"}<br/>${log.sessionCode || ""}</td>
                <td>${log.consumerCode || log.tokenCode || log.entityId || "—"}</td>
                <td>${log.severity || "—"}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      `;
    }

    win.document.write(`
      <html><head><title>Amar Ration Report</title>${commonHead}</head><body>
      <div class="wrap"><div class="card">
        <div class="head">
          <h2>আমার রেশন — ${titleMap[tab]}</h2>
          <div class="sub">Distributor Operational Report</div>
        </div>
        <div class="meta">Division: ${scopeInfo.division || "—"} | Ward: ${scopeInfo.ward || "—"} | Printed: ${printedAt}</div>
        <div class="meta">Filters: ${filters || "None"}</div>
        ${tableHtml}
      </div></div>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* ================= HEADER ================= */}
      <PortalSection
        title="রিপোর্ট ও বিশ্লেষণ"
        right={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => void loadData()}
              disabled={loading}
            >
              🔄 রিফ্রেশ
            </Button>
            <Button onClick={downloadCsv}>⬇️ CSV</Button>
            <Button variant="secondary" onClick={printReport}>
              🖨️ প্রিন্ট
            </Button>
          </div>
        }
      >
        <div className="text-[12px] text-[#6b7280]">
          নির্বাচিত সময় ও লোকেশন অনুযায়ী আমার রেশন বিতরণ কার্যক্রমের বিস্তারিত
          বিশ্লেষণ।
        </div>
      </PortalSection>

      {/* ================= FILTER BAR ================= */}
      <PortalSection title="রিপোর্ট ফিল্টার">
        <div className="grid grid-cols-1 md:grid-cols-10 gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-1 text-[12px]"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-1 text-[12px]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="টোকেন/কনজিউমার সার্চ"
            className="border rounded px-2 py-1 text-[12px] md:col-span-2"
          />
          <input
            value={scopeInfo.division || user?.division || ""}
            readOnly
            placeholder="বিভাগ"
            className="border rounded px-2 py-1 text-[12px] bg-[#f8fafc]"
          />
          <input
            value={scopeInfo.ward || user?.wardNo || user?.ward || ""}
            readOnly
            placeholder="ওয়ার্ড"
            className="border rounded px-2 py-1 text-[12px] bg-[#f8fafc]"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TokenStatus | "")}
            className="border rounded px-2 py-1 text-[12px] bg-white"
          >
            <option value="">সব স্ট্যাটাস</option>
            <option value="Issued">ইস্যুড</option>
            <option value="Used">ব্যবহৃত</option>
            <option value="Cancelled">বাতিল</option>
            <option value="Expired">মেয়াদোত্তীর্ণ</option>
          </select>
          <select
            value={mismatch}
            onChange={(e) =>
              setMismatch(e.target.value as "" | "true" | "false")
            }
            className="border rounded px-2 py-1 text-[12px] bg-white"
          >
            <option value="">সব মিসম্যাচ</option>
            <option value="true">শুধু মিসম্যাচ</option>
            <option value="false">শুধু মিল</option>
          </select>
          <input
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            placeholder="সেশন কোড"
            className="border rounded px-2 py-1 text-[12px]"
          />
          <input
            value={consumerCode}
            onChange={(e) => setConsumerCode(e.target.value)}
            placeholder="কনজিউমার কোড"
            className="border rounded px-2 py-1 text-[12px]"
          />
          <select
            value={item}
            onChange={(e) =>
              setItem(e.target.value as "" | "চাল" | "ডাল" | "পেঁয়াজ")
            }
            className="border rounded px-2 py-1 text-[12px] bg-white"
          >
            <option value="">সব আইটেম</option>
            <option value="চাল">চাল</option>
            <option value="ডাল">ডাল</option>
            <option value="পেঁয়াজ">পেঁয়াজ</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "createdAt"
                  | "tokenCode"
                  | "expectedKg"
                  | "actualKg",
              )
            }
            className="border rounded px-2 py-1 text-[12px] bg-white"
          >
            <option value="createdAt">সাজান: সময়</option>
            <option value="tokenCode">সাজান: টোকেন</option>
            <option value="expectedKg">সাজান: প্রত্যাশিত</option>
            <option value="actualKg">সাজান: বাস্তব</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
            className="border rounded px-2 py-1 text-[12px] bg-white"
          >
            <option value="desc">অবরোহী</option>
            <option value="asc">আরোহী</option>
          </select>
        </div>
        <div className="mt-2 flex gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setFrom("");
              setTo("");
              setSearch("");
              setStatus("");
              setSessionCode("");
              setConsumerCode("");
              setItem("");
              setMismatch("");
              void loadData({
                from: "",
                to: "",
                search: "",
                status: "",
                sessionCode: "",
                consumerCode: "",
                item: "",
                mismatch: "",
              });
            }}
          >
            রিসেট
          </Button>
          <Button onClick={() => void loadData()} disabled={loading}>
            প্রয়োগ করুন
          </Button>
        </div>
      </PortalSection>

      {/* ================= TABS ================= */}
      <PortalSection title="রিপোর্ট টাইপ">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setTab("distribution")}
            variant={tab === "distribution" ? "primary" : "secondary"}
          >
            📦 বিতরণ রিপোর্ট
          </Button>
          <Button
            onClick={() => setTab("stock")}
            variant={tab === "stock" ? "primary" : "secondary"}
          >
            ⚖️ স্টক ও রিকনসিলিয়েশন
          </Button>
          <Button
            onClick={() => setTab("card")}
            variant={tab === "card" ? "primary" : "secondary"}
          >
            🪪 AR কার্ড বিশ্লেষণ
          </Button>
          <Button
            onClick={() => setTab("audit")}
            variant={tab === "audit" ? "primary" : "secondary"}
          >
            🧾 অডিট ও জালিয়াতি
          </Button>
        </div>
      </PortalSection>

      {/* ================= KPI SUMMARY ================= */}
      <PortalSection title="সারাংশ (KPI)">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="border p-3 bg-[#f0fdf4]">
            <div className="text-[12px]">মোট বিতরণ</div>
            <div className="text-[20px] font-bold">
              {totals.actualKg.toFixed(2)} কেজি
            </div>
          </div>
          <div className="border p-3 bg-[#eff6ff]">
            <div className="text-[12px]">সফল বিতরণ</div>
            <div className="text-[20px] font-bold">{summary.usedTokens}</div>
          </div>
          <div className="border p-3 bg-[#fff7ed]">
            <div className="text-[12px]">মিসম্যাচ</div>
            <div className="text-[20px] font-bold">{summary.mismatches}</div>
          </div>
          <div className="border p-3 bg-[#fef2f2]">
            <div className="text-[12px]">মোট রেকর্ড</div>
            <div className="text-[20px] font-bold">{summary.totalTokens}</div>
          </div>
        </div>
      </PortalSection>

      {/* ================= TABLE ================= */}
      <PortalSection title="রিপোর্ট টেবিল">
        {tab === "distribution" && (
          <div className="border rounded overflow-x-auto">
            <table className="min-w-275 w-full text-[12px]">
              <thead className="bg-[#f8fafc]">
                <tr>
                  <th className="border p-2">তারিখ</th>
                  <th className="border p-2">সেশন</th>
                  <th className="border p-2">এলাকা</th>
                  <th className="border p-2">টোকেন</th>
                  <th className="border p-2">উপকারভোগী</th>
                  <th className="border p-2">আইটেম</th>
                  <th className="border p-2">প্রত্যাশিত</th>
                  <th className="border p-2">বাস্তব</th>
                  <th className="border p-2">কারণ</th>
                  <th className="border p-2">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row._id}
                    className={row.mismatch ? "bg-[#fff7ed]" : ""}
                  >
                    <td className="border p-2 text-center">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </td>
                    <td className="border p-2 text-center">
                      {row.sessionCode || "—"}
                      <div className="text-[10px] text-[#64748b]">
                        {row.sessionStatus || ""}
                      </div>
                    </td>
                    <td className="border p-2 text-center">
                      {row.division || "—"}
                      <div className="text-[10px] text-[#64748b]">
                        Ward {row.ward || "—"}
                      </div>
                    </td>
                    <td className="border p-2 text-center">{row.tokenCode}</td>
                    <td className="border p-2 text-center">
                      {row.consumerCode || "—"}
                      <div className="text-[10px] text-[#64748b]">
                        {row.consumerName || ""}
                      </div>
                    </td>
                    <td className="border p-2 text-center">
                      {row.rationItem || "—"}
                    </td>
                    <td className="border p-2 text-center">
                      {row.expectedKg.toFixed(2)}
                    </td>
                    <td
                      className={`border p-2 text-center ${row.mismatch ? "text-[#b91c1c] font-bold" : ""}`}
                    >
                      {row.actualKg.toFixed(2)}
                    </td>
                    <td className="border p-2 text-center">
                      {row.mismatchReason || "—"}
                    </td>
                    <td className="border p-2 text-center">
                      {row.mismatch ? (
                        <Badge tone="red">মিসম্যাচ</Badge>
                      ) : (
                        <Badge tone="green">সফল</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="border p-3 text-center text-[#6b7280]"
                    >
                      {loading ? "লোড হচ্ছে..." : "ডেটা পাওয়া যায়নি"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "stock" && (
          <div className="space-y-3 text-[12px]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border p-3 bg-[#f8fafc] rounded">
                <div>Expected মোট</div>
                <div className="text-[20px] font-bold">
                  {totals.expectedKg.toFixed(2)} কেজি
                </div>
              </div>
              <div className="border p-3 bg-[#eff6ff] rounded">
                <div>Actual মোট</div>
                <div className="text-[20px] font-bold">
                  {totals.actualKg.toFixed(2)} কেজি
                </div>
              </div>
              <div className="border p-3 bg-[#fff7ed] rounded">
                <div>পার্থক্য</div>
                <div className="text-[20px] font-bold">
                  {Math.abs(totals.differenceKg).toFixed(2)} কেজি
                </div>
              </div>
            </div>
            <div className="border rounded overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="border p-2">আইটেম</th>
                    <th className="border p-2">Expected</th>
                    <th className="border p-2">Actual</th>
                    <th className="border p-2">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {(["চাল", "ডাল", "পেঁয়াজ"] as const).map((stockItem) => (
                    <tr key={stockItem}>
                      <td className="border p-2 text-center">{stockItem}</td>
                      <td className="border p-2 text-center">
                        {Number(
                          totals.itemWise?.[stockItem]?.expectedKg || 0,
                        ).toFixed(2)}
                      </td>
                      <td className="border p-2 text-center">
                        {Number(
                          totals.itemWise?.[stockItem]?.actualKg || 0,
                        ).toFixed(2)}
                      </td>
                      <td className="border p-2 text-center">
                        {Number(
                          totals.itemWise?.[stockItem]?.differenceKg || 0,
                        ).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "card" && (
          <div className="space-y-3 text-[12px]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="border p-2 rounded">
                মোট AR কার্ড: <b>{cardSummary.total}</b>
              </div>
              <div className="border p-2 rounded">
                Active Card: <b>{cardSummary.active}</b>
              </div>
              <div className="border p-2 rounded">
                Revoked Card: <b>{cardSummary.revoked}</b>
              </div>
              <div className="border p-2 rounded">
                মেয়াদোত্তীর্ণ QR: <b>{cardSummary.expired}</b>
              </div>
            </div>

            <div className="border rounded overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="border p-2">AR কোড</th>
                    <th className="border p-2">নাম</th>
                    <th className="border p-2">এলাকা</th>
                    <th className="border p-2">ক্যাটাগরি</th>
                    <th className="border p-2">কার্ড</th>
                    <th className="border p-2">QR</th>
                    <th className="border p-2">মেয়াদ</th>
                  </tr>
                </thead>
                <tbody>
                  {cardRows.map((card) => (
                    <tr key={card.consumerId}>
                      <td className="border p-2 text-center">
                        {card.consumerCode}
                      </td>
                      <td className="border p-2 text-center">{card.name}</td>
                      <td className="border p-2 text-center">
                        {card.division || "—"} / {card.ward || "—"}
                      </td>
                      <td className="border p-2 text-center">
                        {card.category || "—"}
                      </td>
                      <td className="border p-2 text-center">
                        {card.cardStatus}
                      </td>
                      <td className="border p-2 text-center">
                        {card.qrStatus}
                      </td>
                      <td className="border p-2 text-center">
                        {card.validTo
                          ? new Date(card.validTo).toLocaleDateString("bn-BD")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {cardRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="border p-3 text-center text-[#6b7280]"
                      >
                        {loading ? "লোড হচ্ছে..." : "কার্ড ডেটা নেই"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="border rounded overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#f8fafc]">
                <tr>
                  <th className="border p-2">সময়</th>
                  <th className="border p-2">ইভেন্ট</th>
                  <th className="border p-2">এলাকা/সেশন</th>
                  <th className="border p-2">রেফারেন্স</th>
                  <th className="border p-2">গুরুত্ব</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((log) => (
                  <tr key={log._id}>
                    <td className="border p-2 text-center">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="border p-2">{log.action}</td>
                    <td className="border p-2 text-center">
                      {(log.division || "—") + " / " + (log.ward || "—")}
                      <div className="text-[10px] text-[#64748b]">
                        {log.sessionCode || ""}
                      </div>
                    </td>
                    <td className="border p-2 text-center">
                      {log.consumerCode || log.tokenCode || log.entityId || "—"}
                    </td>
                    <td className="border p-2 text-center">
                      {log.severity === "Critical" && (
                        <Badge tone="red">গুরুতর</Badge>
                      )}
                      {log.severity === "Warning" && (
                        <Badge tone="yellow">সতর্ক</Badge>
                      )}
                      {log.severity === "Info" && (
                        <Badge tone="green">তথ্য</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PortalSection>

      {/* ================= FOOTER NOTE ================= */}
      <div className="text-[11px] text-[#6b7280] text-center">
        এই রিপোর্ট শুধুমাত্র প্রদর্শনের উদ্দেশ্যে। বাস্তব ব্যবহারে সমস্ত ডেটা
        Audit Log দ্বারা যাচাইযোগ্য।
      </div>
    </div>
  );
}
