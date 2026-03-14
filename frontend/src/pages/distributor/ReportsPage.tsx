import { useEffect, useMemo, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import {
  getAuditLogs,
  getDistributionReport,
  getReportSummary,
  getTokenAnalytics,
  type AuditLogEntry,
  type DistributionReportRow,
  type TokenAnalytics,
  type TokenStatus,
} from "../../services/api";

type Tab = "distribution" | "stock" | "token" | "audit";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("distribution");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TokenStatus | "">("");
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
    mismatches: 0,
  });
  const [tokenAnalytics, setTokenAnalytics] = useState<TokenAnalytics | null>(
    null,
  );
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, distributionData, analyticsData, auditData] =
        await Promise.all([
          getReportSummary(),
          getDistributionReport({
            page: 1,
            limit: 200,
            from: from || undefined,
            to: to || undefined,
            search: search.trim() || undefined,
            status: status || undefined,
            mismatch: mismatch || undefined,
            sortBy,
            sortOrder,
          }),
          getTokenAnalytics(),
          getAuditLogs({ page: 1, limit: 30 }),
        ]);

      setSummary(summaryData);
      setRows(distributionData.rows);
      setTotals(distributionData.totals);
      setTokenAnalytics(analyticsData);
      setAuditRows(auditData.logs);
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
      "Token",
      "Consumer",
      "ExpectedKg",
      "ActualKg",
      "Mismatch",
      "Status",
    ];
    const lines = rows.map((row) => [
      new Date(row.createdAt).toISOString(),
      row.tokenCode,
      row.consumerCode,
      String(row.expectedKg),
      String(row.actualKg),
      row.mismatch ? "Yes" : "No",
      row.tokenStatus,
    ]);

    return [headers, ...lines]
      .map((line) =>
        line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
  }, [rows]);

  const downloadCsv = () => {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `distribution-report-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
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
            <Button variant="secondary" onClick={() => window.print()}>
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
        <div className="grid grid-cols-1 md:grid-cols-8 gap-2">
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
              setMismatch("");
              void loadData();
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
            onClick={() => setTab("token")}
            variant={tab === "token" ? "primary" : "secondary"}
          >
            🎫 টোকেন বিশ্লেষণ
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
            <div className="text-[12px]">সফল টোকেন</div>
            <div className="text-[20px] font-bold">{summary.usedTokens}</div>
          </div>
          <div className="border p-3 bg-[#fff7ed]">
            <div className="text-[12px]">মিসম্যাচ</div>
            <div className="text-[20px] font-bold">{summary.mismatches}</div>
          </div>
          <div className="border p-3 bg-[#fef2f2]">
            <div className="text-[12px]">মোট টোকেন</div>
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
                  <th className="border p-2">টোকেন</th>
                  <th className="border p-2">উপকারভোগী</th>
                  <th className="border p-2">প্রত্যাশিত</th>
                  <th className="border p-2">বাস্তব</th>
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
                    <td className="border p-2 text-center">{row.tokenCode}</td>
                    <td className="border p-2 text-center">
                      {row.consumerCode || "—"}
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
                      colSpan={6}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
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
                {Math.abs(totals.expectedKg - totals.actualKg).toFixed(2)} কেজি
              </div>
            </div>
          </div>
        )}

        {tab === "token" && (
          <div className="space-y-3 text-[12px]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="border p-2 rounded">
                ইস্যুড: <b>{tokenAnalytics?.byStatus.Issued ?? 0}</b>
              </div>
              <div className="border p-2 rounded">
                ব্যবহৃত: <b>{tokenAnalytics?.byStatus.Used ?? 0}</b>
              </div>
              <div className="border p-2 rounded">
                বাতিল: <b>{tokenAnalytics?.byStatus.Cancelled ?? 0}</b>
              </div>
              <div className="border p-2 rounded">
                মেয়াদোত্তীর্ণ: <b>{tokenAnalytics?.byStatus.Expired ?? 0}</b>
              </div>
            </div>

            <div className="border rounded overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="border p-2">শীর্ষ উপকারভোগী</th>
                    <th className="border p-2">ব্যবহৃত টোকেন</th>
                  </tr>
                </thead>
                <tbody>
                  {(tokenAnalytics?.topConsumers || []).map((item) => (
                    <tr key={item.consumerCode || item.name}>
                      <td className="border p-2 text-center">
                        {item.consumerCode} - {item.name}
                      </td>
                      <td className="border p-2 text-center">
                        {item.usedTokens}
                      </td>
                    </tr>
                  ))}
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
