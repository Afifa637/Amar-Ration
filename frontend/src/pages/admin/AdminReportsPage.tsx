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
) {
  const data = await getDistributionReport({
    page: 1,
    limit: 1000,
    from: from || undefined,
    to: to || undefined,
    division: division || undefined,
    ward: ward || undefined,
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

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await fetchReportRows(from, to, division, ward));
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
