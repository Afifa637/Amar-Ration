import { useEffect, useState } from "react";
import SectionCard from "../../components/SectionCard";
import { getDistributorSettings } from "../../services/api";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<
    Array<{ key: string; value: unknown }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getDistributorSettings();
        if (Array.isArray(data.settings)) {
          setSettings(data.settings as Array<{ key: string; value: unknown }>);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "সেটিংস লোড ব্যর্থ");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d7dde6] rounded px-3 py-2 text-[12px] text-[#4b5563]">
        অ্যাডমিন <span className="mx-1">›</span> সিস্টেম সেটিংস
      </div>

      <SectionCard title="কোর নীতিমালা সেটিংস">
        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-[#374151]">
          <div className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]">
            <div className="font-semibold text-[#1f2d3d] mb-2">অথেনটিকেশন</div>
            <ul className="space-y-2">
              <li>• অ্যাডমিন লগইন নির্ধারিত ইমেইল/পাসওয়ার্ড ব্যবহার করে</li>
              <li>• ডিস্ট্রিবিউটর অ্যাক্টিভেশন অ্যাডমিন নিয়ন্ত্রিত</li>
              <li>• রোল-ভিত্তিক রুট প্রোটেকশনের জন্য সেশন সংরক্ষণ</li>
            </ul>
          </div>

          <div className="border border-[#d7dde6] rounded p-4 bg-[#fafbfc]">
            <div className="font-semibold text-[#1f2d3d] mb-2">
              QR ও টোকেন নীতি
            </div>
            <ul className="space-y-2">
              <li>• QR হতে পারে সক্রিয়/নিষ্ক্রিয়/বাতিল/মেয়াদোত্তীর্ণ</li>
              <li>• বৈধ QR স্ক্যানের পরেই টোকেন ইস্যু</li>
              <li>• ইন্টারনেট ফিরলে অফলাইন টোকেন সিঙ্ক হবে</li>
            </ul>
          </div>
        </div>
        {loading && (
          <div className="text-[12px] text-[#6b7280] mt-2">লোড হচ্ছে...</div>
        )}
      </SectionCard>

      <SectionCard title="সিস্টেম সেটিংস (শুধু-পঠনযোগ্য)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#f3f5f8] text-left">
                <th className="p-2 border border-[#d7dde6]">কী</th>
                <th className="p-2 border border-[#d7dde6]">মান</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((item) => (
                <tr key={item.key} className="odd:bg-white even:bg-[#fafbfc]">
                  <td className="p-2 border border-[#d7dde6]">{item.key}</td>
                  <td className="p-2 border border-[#d7dde6]">
                    {typeof item.value === "object"
                      ? JSON.stringify(item.value)
                      : String(item.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="ব্যাকএন্ড-নিয়ন্ত্রিত সুপারিশকৃত সেটিংস">
        <ul className="space-y-2 text-sm text-[#374151]">
          <li>• অ্যাডমিন ক্রেডেনশিয়াল সার্ভার এনভায়রনমেন্টে রাখুন।</li>
          <li>• বিতরণ চক্র অনুযায়ী QR মেয়াদ কনফিগারেবল রাখুন।</li>
          <li>• ব্ল্যাকলিস্ট সময়সীমা অস্থায়ী/স্থায়ী নীতিতে নির্ধারণ করুন।</li>
          <li>• ব্যাকএন্ড সার্ভিস থেকে SMS/অ্যাপ নোটিফিকেশন দিন।</li>
        </ul>
      </SectionCard>
    </div>
  );
}
