import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  getDistributionReport,
  type DistributionReportRow,
} from "../../services/api";

export default function AdminReportsPage() {
  const [rows, setRows] = useState<DistributionReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDistributionReport({ page: 1, limit: 1000 });
      setRows(data.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিপোর্ট ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const reconciliationRows = useMemo(() => {
    const map = new Map<
      string,
      { expectedKg: number; actualKg: number; mismatch: number }
    >();

    rows.forEach((row) => {
      const key = row.ward || "অজানা";
      const prev = map.get(key) || { expectedKg: 0, actualKg: 0, mismatch: 0 };
      prev.expectedKg += Number(row.expectedKg || 0);
      prev.actualKg += Number(row.actualKg || 0);
      if (row.mismatch) prev.mismatch += 1;
      map.set(key, prev);
    });

    return Array.from(map.entries()).map(([ward, data]) => {
      const variance = Number((data.expectedKg - data.actualKg).toFixed(2));
      const status = Math.abs(variance) <= 0.1 ? "ম্যাচড" : "তদন্ত প্রয়োজন";
      return {
        ward,
        expectedKg: data.expectedKg.toFixed(2),
        actualKg: data.actualKg.toFixed(2),
        variance: variance.toFixed(2),
        status,
      };
    });
  }, [rows]);

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
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "এলাকা/ওয়ার্ড",
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
                <tr key={row.ward} className="odd:bg-white even:bg-[#fafbfc]">
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
