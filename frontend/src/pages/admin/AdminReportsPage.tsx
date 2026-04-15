import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  exportDistributionReport,
  getDistributionReport,
  type DistributionReportRow,
} from "../../services/api";

async function fetchReportRows(
  from?: string,
  to?: string,
  division?: string,
  ward?: string,
  sessionCode?: string,
  consumerCode?: string,
  item?: "চাল" | "ডাল" | "পেঁয়াজ" | "",
  mismatch?: "true" | "false" | "",
) {
  const data = await getDistributionReport({
    page: 1,
    limit: 1000,
    from: from || undefined,
    to: to || undefined,
    division: division || undefined,
    ward: ward || undefined,
    sessionCode: sessionCode || undefined,
    consumerCode: consumerCode || undefined,
    item: item || undefined,
    mismatch: mismatch || undefined,
  });

  return data.rows || [];
}

export default function AdminReportsPage() {
  const [rows, setRows] = useState<DistributionReportRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [division, setDivision] = useState("");
  const [ward, setWard] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [consumerCode, setConsumerCode] = useState("");
  const [item, setItem] = useState<"" | "চাল" | "ডাল" | "পেঁয়াজ">("");
  const [mismatch, setMismatch] = useState<"" | "true" | "false">("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(
        await fetchReportRows(
          from,
          to,
          division,
          ward,
          sessionCode,
          consumerCode,
          item,
          mismatch,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিপোর্ট ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchReportRows(undefined, undefined, undefined, undefined)
      .then((data) => {
        setRows(data);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "রিপোর্ট ডেটা লোড ব্যর্থ",
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const reconciliationRows = useMemo(() => {
    const map = new Map<
      string,
      { expectedKg: number; actualKg: number; mismatch: number }
    >();

    rows.forEach((row) => {
      const key = `${row.division || "অজানা"}::${row.ward || "অজানা"}`;
      const prev = map.get(key) || { expectedKg: 0, actualKg: 0, mismatch: 0 };
      prev.expectedKg += Number(row.expectedKg || 0);
      prev.actualKg += Number(row.actualKg || 0);
      if (row.mismatch) prev.mismatch += 1;
      map.set(key, prev);
    });

    return Array.from(map.entries()).map(([scope, data]) => {
      const [divisionName, wardName] = scope.split("::");
      const variance = Number((data.expectedKg - data.actualKg).toFixed(2));
      return {
        division: divisionName,
        ward: wardName,
        expectedKg: data.expectedKg.toFixed(2),
        actualKg: data.actualKg.toFixed(2),
        variance: variance.toFixed(2),
        status: Math.abs(variance) <= 0.1 ? "ম্যাচড" : "তদন্ত প্রয়োজন",
      };
    });
  }, [rows]);

  const resetFilters = async () => {
    setFrom("");
    setTo("");
    setDivision("");
    setWard("");
    setSessionCode("");
    setConsumerCode("");
    setItem("");
    setMismatch("");
    setLoading(true);
    setError("");
    try {
      setRows(await fetchReportRows());
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিপোর্ট ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) return;
    const filters = [
      from ? `From: ${from}` : "",
      to ? `To: ${to}` : "",
      division ? `Division: ${division}` : "",
      ward ? `Ward: ${ward}` : "",
      sessionCode ? `Session: ${sessionCode}` : "",
      consumerCode ? `Consumer: ${consumerCode}` : "",
      item ? `Item: ${item}` : "",
      mismatch ? `Mismatch: ${mismatch}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    win.document.write(`
      <html><head><title>Admin Detailed Report</title>
      <style>
        body{font-family:Arial,sans-serif;margin:20px}
        h2{margin:0 0 6px}
        .meta{font-size:12px;color:#475569;margin-bottom:12px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #cbd5e1;padding:6px}
        th{background:#f1f5f9}
      </style></head><body>
      <h2>Admin Operational Distribution Report</h2>
      <div class="meta">Rows: ${rows.length} | Printed: ${new Date().toLocaleString("bn-BD")}</div>
      <div class="meta">Filters: ${filters || "None"}</div>
      <table><thead><tr><th>Date</th><th>Division</th><th>Ward</th><th>Session</th><th>Distributor</th><th>Consumer</th><th>Item</th><th>Expected</th><th>Actual</th><th>Mismatch</th><th>Reason</th></tr></thead>
      <tbody>
      ${rows
        .map(
          (row) => `<tr>
            <td>${new Date(row.createdAt).toLocaleString("bn-BD")}</td>
            <td>${row.division || "—"}</td>
            <td>${row.ward || "—"}</td>
            <td>${row.sessionCode || "—"}<br/>${row.sessionStatus || ""}</td>
            <td>${row.distributorName || "—"}<br/>${row.distributorCode || ""}</td>
            <td>${row.consumerCode || "—"}<br/>${row.consumerName || ""}</td>
            <td>${row.rationItem || "—"}</td>
            <td>${Number(row.expectedKg || 0).toFixed(2)}</td>
            <td>${Number(row.actualKg || 0).toFixed(2)}</td>
            <td>${row.mismatch ? "Yes" : "No"}</td>
            <td>${row.mismatchReason || "—"}</td>
          </tr>`,
        )
        .join("")}
      </tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>
    `);
    win.document.close();
  };

  const downloadReport = async (format: "csv" | "xlsx") => {
    try {
      setError("");
      const blob = await exportDistributionReport({
        format,
        from: from || undefined,
        to: to || undefined,
        division: division || undefined,
        ward: ward || undefined,
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const ext = format === "xlsx" ? "xlsx" : "csv";
      link.href = url;
      link.download = `distribution-report-${new Date().toISOString().slice(0, 10)}.${ext}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "এক্সপোর্ট ব্যর্থ");
    }
  };

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> রিপোর্ট ও রিকনসিলিয়েশন
      </div>

      <SectionCard title="রিকনসিলিয়েশন ড্যাশবোর্ড">
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <input
            type="text"
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            placeholder="বিভাগ (যেমন: Dhaka)"
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
          />
          <input
            type="text"
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            placeholder="ওয়ার্ড"
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
          />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
          />
          <input
            type="text"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            placeholder="সেশন কোড"
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
          />
          <input
            type="text"
            value={consumerCode}
            onChange={(e) => setConsumerCode(e.target.value)}
            placeholder="কনজিউমার কোড"
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
          />
          <select
            value={item}
            onChange={(e) =>
              setItem(e.target.value as "" | "চাল" | "ডাল" | "পেঁয়াজ")
            }
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">সব আইটেম</option>
            <option value="চাল">চাল</option>
            <option value="ডাল">ডাল</option>
            <option value="পেঁয়াজ">পেঁয়াজ</option>
          </select>
          <select
            value={mismatch}
            onChange={(e) =>
              setMismatch(e.target.value as "" | "true" | "false")
            }
            className="border border-[#cfd6e0] rounded px-3 py-2 text-[13px] bg-white"
          >
            <option value="">সব ম্যাচ</option>
            <option value="true">শুধু মিসম্যাচ</option>
            <option value="false">শুধু ম্যাচ</option>
          </select>
          <button
            onClick={() => void loadData()}
            className="px-3 py-2 rounded bg-[#16679c] text-white text-[13px] hover:bg-[#0f557f]"
          >
            ফিল্টার প্রয়োগ
          </button>
          <button
            onClick={() => void resetFilters()}
            className="px-3 py-2 rounded bg-[#e5e7eb] text-[#111827] text-[13px] hover:bg-[#d1d5db]"
          >
            রিসেট
          </button>
          <button
            onClick={() => void downloadReport("csv")}
            className="px-3 py-2 rounded bg-[#ecfdf3] border border-[#86efac] text-[#166534] text-[13px] hover:bg-[#dcfce7]"
          >
            সার্ভার CSV এক্সপোর্ট
          </button>
          <button
            onClick={() => void downloadReport("xlsx")}
            className="px-3 py-2 rounded bg-[#eff6ff] border border-[#93c5fd] text-[#1d4ed8] text-[13px] hover:bg-[#dbeafe]"
          >
            সার্ভার XLSX এক্সপোর্ট
          </button>
          <button
            onClick={printReport}
            className="px-3 py-2 rounded bg-[#f8fafc] border border-[#cbd5e1] text-[#0f172a] text-[13px] hover:bg-[#eef2ff]"
          >
            প্রিন্ট প্রিভিউ
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "বিভাগ",
                  "ওয়ার্ড",
                  "প্রত্যাশিত পরিমাণ",
                  "বিতরণকৃত পরিমাণ",
                  "পার্থক্য",
                  "স্ট্যাটাস",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reconciliationRows.map((row) => (
                <tr
                  key={`${row.division}-${row.ward}`}
                  className="odd:bg-white even:bg-[#fafbfc]"
                >
                  <td className="p-2 border border-[#d7dde6]">
                    {row.division}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{row.ward}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.expectedKg} kg
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.actualKg} kg
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.variance} kg
                  </td>
                  <td className="p-2 border border-[#d7dde6]">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="text-[12px] text-[#6b7280] mt-2">লোড হচ্ছে...</div>
        )}
      </SectionCard>

      <SectionCard title="ডিটেইলড অপারেশনাল রো রিপোর্ট">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "সময়",
                  "বিভাগ",
                  "ওয়ার্ড",
                  "সেশন",
                  "ডিস্ট্রিবিউটর",
                  "কনজিউমার",
                  "আইটেম",
                  "Expected",
                  "Actual",
                  "স্ট্যাটাস",
                  "কারণ",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">
                    {new Date(row.createdAt).toLocaleString("bn-BD")}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.division || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.ward || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.sessionCode || "—"}
                    <div className="text-[11px] text-[#64748b]">
                      {row.sessionStatus || ""}
                    </div>
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.distributorName || "—"}
                    <div className="text-[11px] text-[#64748b]">
                      {row.distributorCode || ""}
                    </div>
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.consumerCode || "—"}
                    <div className="text-[11px] text-[#64748b]">
                      {row.consumerName || ""}
                    </div>
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.rationItem || "—"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {Number(row.expectedKg || 0).toFixed(2)}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {Number(row.actualKg || 0).toFixed(2)}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.mismatch ? "Mismatch" : "Matched"}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.mismatchReason || "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-[#6b7280]">
                    {loading ? "লোড হচ্ছে..." : "ডেটা নেই"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          ["দৈনিক রিপোর্ট", "টোকেন সংখ্যা, স্ক্যান ফলাফল, স্টক ব্যবহার"],
          [
            "সাপ্তাহিক অডিট রিপোর্ট",
            "মিসম্যাচ ট্রেন্ড, ফ্ল্যাগড ডিস্ট্রিবিউটর",
          ],
          ["মাসিক উপকারভোগী রিপোর্ট", "সক্রিয় / নিষ্ক্রিয় / বাতিল উপকারভোগী"],
        ].map(([title, text]) => (
          <SectionCard key={title} title={title}>
            <p className="text-sm text-[#374151]">{text}</p>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
