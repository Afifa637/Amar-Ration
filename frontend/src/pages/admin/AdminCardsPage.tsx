import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import {
  getAdminCardsSummary,
  type AdminCardsSummary,
} from "../../services/api";

export default function AdminCardsPage() {
  const [summary, setSummary] = useState<AdminCardsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getAdminCardsSummary();
        setSummary(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "কার্ড ডেটা লোড ব্যর্থ");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> OMS কার্ড ও QR কন্ট্রোল
      </div>

      <SectionCard title="QR কার্ড কন্ট্রোল সারাংশ">
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["ইস্যুকৃত কার্ড", String(summary?.issuedCards ?? 0)],
            ["সক্রিয় QR", String(summary?.activeQR ?? 0)],
            ["নিষ্ক্রিয় / বাতিল", String(summary?.inactiveRevoked ?? 0)],
            ["রোটেশনের জন্য বাকি", String(summary?.dueForRotation ?? 0)],
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

      <SectionCard title="QR লাইফসাইকেল নীতি">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                <th className="p-2 border border-[#d7dde6]">অবস্থা</th>
                <th className="p-2 border border-[#d7dde6]">অর্থ</th>
                <th className="p-2 border border-[#d7dde6]">স্ক্যান ফলাফল</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "সক্রিয়",
                  "যাচাইকৃত উপকারভোগী বিতরণে অংশ নিতে পারে",
                  "টোকেন ইস্যু হবে",
                ],
                ["নিষ্ক্রিয়", "সাময়িকভাবে ব্লক/অঅনুমোদিত", "স্ক্যান বাতিল"],
                [
                  "বাতিল",
                  "অ্যাডমিন অ্যাকশনে কার্ড বাতিল",
                  "স্ক্যান বাতিল + লগ",
                ],
                ["মেয়াদোত্তীর্ণ", "রোটেশন সময় অতিক্রান্ত", "নতুন QR প্রয়োজন"],
              ].map((row) => (
                <tr key={row[0]} className="odd:bg-white even:bg-[#fafbfc]">
                  {row.map((cell) => (
                    <td key={cell} className="p-2 border border-[#d7dde6]">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="অ্যাডমিন অ্যাকশন">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• যাচাই সফল হলে OMS রেশন কার্ড ইস্যু।</li>
          <li>• নিষ্ক্রিয় অনুমোদনের পর QR সঙ্গে সঙ্গে বাতিল।</li>
          <li>• নির্ধারিত সময় অনুযায়ী QR রোটেশন।</li>
          <li>• প্রতিটি QR স্টেট পরিবর্তন অডিটে নথিভুক্ত।</li>
        </ul>
      </SectionCard>
    </div>
  );
}
