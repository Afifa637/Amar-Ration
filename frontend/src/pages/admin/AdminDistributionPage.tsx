import { useEffect, useMemo, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  getAdminDistributionMonitoring,
  getAdminSummary,
  type AdminDistributionMonitorRow,
  type AdminSummary,
} from "../../services/api";

export default function AdminDistributionPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [rows, setRows] = useState<AdminDistributionMonitorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryData, monitoringData] = await Promise.all([
        getAdminSummary(),
        getAdminDistributionMonitoring(),
      ]);
      setSummary(summaryData);
      setRows(monitoringData.rows || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "ডিস্ট্রিবিউশন ডেটা লোড ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const pausedPoints = useMemo(
    () => rows.filter((row) => row.status === "Mismatch").length,
    [rows],
  );

  const statusLabel = (status: AdminDistributionMonitorRow["status"]) =>
    status === "Mismatch" ? "মিসম্যাচ" : "ম্যাচড";

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> টোকেন ও ডিস্ট্রিবিউশন কন্ট্রোল
      </div>

      <SectionCard title="বিতরণ দিনের নিয়ন্ত্রণ">
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["ভ্যালিড স্ক্যান", String(summary?.ops.validScans ?? 0)],
            ["রিজেক্টেড স্ক্যান", String(summary?.ops.rejectedScans ?? 0)],
            ["ইস্যুকৃত টোকেন", String(summary?.ops.tokensGenerated ?? 0)],
            ["স্থগিত পয়েন্ট", String(pausedPoints)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]"
            >
              <div className="text-sm text-[#6b7280]">{label}</div>
              <div className="text-2xl font-bold text-[#1f2d3d] mt-1">
                {value}
              </div>
            </div>
          ))}
        </div>
        {loading && (
          <div className="text-[12px] text-[#6b7280] mt-2">লোড হচ্ছে...</div>
        )}
      </SectionCard>

      <SectionCard title="রিয়েল-টাইম ভ্যালিডেশন লজিক">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• QR ভ্যালিডিটি যাচাই</li>
          <li>• উপকারভোগীর সক্রিয়/নিষ্ক্রিয় স্ট্যাটাস যাচাই</li>
          <li>• ডুপ্লিকেট ফ্যামিলি কনফ্লিক্ট যাচাই</li>
          <li>• শুধুমাত্র বৈধ উপকারভোগীর জন্য টোকেন ইস্যু</li>
          <li>• ব্যবহৃত টোকেন পুনর্ব্যবহারযোগ্য নয়</li>
        </ul>
      </SectionCard>

      <SectionCard title="আইওটি ওজন ও স্টক মনিটরিং">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                {[
                  "পয়েন্ট",
                  "প্রত্যাশিত ওজন",
                  "প্রকৃত ওজন",
                  "স্ট্যাটাস",
                  "অ্যাকশন",
                ].map((head) => (
                  <th key={head} className="p-2 border border-[#d7dde6]">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={`${row.ward}-${idx}`}
                  className="odd:bg-white even:bg-[#fafbfc]"
                >
                  <td className="p-2 border border-[#d7dde6]">{row.ward}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.expectedKg}kg
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.actualKg}kg
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {statusLabel(row.status)}
                  </td>
                  <td className="p-2 border border-[#d7dde6]">
                    {row.status === "Mismatch" ? "স্থগিত + এলার্ট" : "চলমান"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
