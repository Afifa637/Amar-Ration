import { useState } from "react";
import PortalSection from "../components/PortalSection";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";

type Tab = "distribution" | "stock" | "token" | "audit";

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("distribution");

  return (
    <div className="space-y-3">
      {/* ================= HEADER ================= */}
      <PortalSection
        title="রিপোর্ট ও বিশ্লেষণ (Reports & Analytics)"
        right={
          <div className="flex gap-2">
            <Button variant="secondary">📅 তারিখ নির্বাচন</Button>
            <Button>⬇️ PDF</Button>
            <Button variant="secondary">⬇️ Excel</Button>
            <Button variant="ghost">🖨️ প্রিন্ট</Button>
          </div>
        }
      >
        <div className="text-[12px] text-[#6b7280]">
          নির্বাচিত সময় ও লোকেশন অনুযায়ী আমার রেশন বিতরণ কার্যক্রমের বিস্তারিত বিশ্লেষণ।
        </div>
      </PortalSection>

      {/* ================= FILTER BAR ================= */}
      <PortalSection title="রিপোর্ট ফিল্টার">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <select className="border rounded px-2 py-1 text-[12px]">
            <option>বিভাগ</option>
            <option>ঢাকা</option>
          </select>
          <select className="border rounded px-2 py-1 text-[12px]">
            <option>জেলা</option>
            <option>ঢাকা</option>
          </select>
          <select className="border rounded px-2 py-1 text-[12px]">
            <option>উপজেলা</option>
            <option>সাভার</option>
          </select>
          <select className="border rounded px-2 py-1 text-[12px]">
            <option>ইউনিয়ন</option>
            <option>তেঁতুলঝোড়া</option>
          </select>
          <select className="border rounded px-2 py-1 text-[12px]">
            <option>ডিলার</option>
            <option>D-01</option>
          </select>
          <select className="border rounded px-2 py-1 text-[12px]">
            <option>গ্রানুলারিটি</option>
            <option>দৈনিক</option>
            <option>মাসিক</option>
          </select>
        </div>
      </PortalSection>

      {/* ================= TABS ================= */}
      <PortalSection title="রিপোর্ট টাইপ">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setTab("distribution")} variant={tab === "distribution" ? "primary" : "secondary"}>
            📦 বিতরণ রিপোর্ট
          </Button>
          <Button onClick={() => setTab("stock")} variant={tab === "stock" ? "primary" : "secondary"}>
            ⚖️ স্টক ও রিকনসিলিয়েশন
          </Button>
          <Button onClick={() => setTab("token")} variant={tab === "token" ? "primary" : "secondary"}>
            🎫 টোকেন বিশ্লেষণ
          </Button>
          <Button onClick={() => setTab("audit")} variant={tab === "audit" ? "primary" : "secondary"}>
            🧾 অডিট ও জালিয়াতি
          </Button>
        </div>
      </PortalSection>

      {/* ================= KPI SUMMARY ================= */}
      <PortalSection title="সারাংশ (KPI)">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="border p-3 bg-[#f0fdf4]">
            <div className="text-[12px]">মোট বিতরণ</div>
            <div className="text-[20px] font-bold">১৮,৫০০ কেজি</div>
          </div>
          <div className="border p-3 bg-[#eff6ff]">
            <div className="text-[12px]">সফল টোকেন</div>
            <div className="text-[20px] font-bold">৩,০৯৮</div>
          </div>
          <div className="border p-3 bg-[#fff7ed]">
            <div className="text-[12px]">মিসম্যাচ</div>
            <div className="text-[20px] font-bold">২</div>
          </div>
          <div className="border p-3 bg-[#fef2f2]">
            <div className="text-[12px]">Fraud Flag</div>
            <div className="text-[20px] font-bold">১</div>
          </div>
        </div>
      </PortalSection>

      {/* ================= TABLE ================= */}
      <PortalSection title="রিপোর্ট টেবিল">
        <div className="border rounded overflow-x-auto">
          <table className="min-w-[1100px] w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">তারিখ</th>
                <th className="border p-2">ডিলার</th>
                <th className="border p-2">টোকেন</th>
                <th className="border p-2">বিতরণ (কেজি)</th>
                <th className="border p-2">Expected</th>
                <th className="border p-2">Actual</th>
                <th className="border p-2">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2 text-center">01-01-2026</td>
                <td className="border p-2 text-center">D-01</td>
                <td className="border p-2 text-center">T-1001</td>
                <td className="border p-2 text-center">৫.০০</td>
                <td className="border p-2 text-center">৫.০০</td>
                <td className="border p-2 text-center">৫.০০</td>
                <td className="border p-2 text-center">
                  <Badge tone="green">সফল</Badge>
                </td>
              </tr>
              <tr className="bg-[#fff7ed]">
                <td className="border p-2 text-center">01-01-2026</td>
                <td className="border p-2 text-center">D-01</td>
                <td className="border p-2 text-center">T-1004</td>
                <td className="border p-2 text-center">৫.০০</td>
                <td className="border p-2 text-center">৫.০০</td>
                <td className="border p-2 text-center text-[#b91c1c] font-bold">৪.৫০</td>
                <td className="border p-2 text-center">
                  <Badge tone="red">মিসম্যাচ</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </PortalSection>

      {/* ================= FOOTER NOTE ================= */}
      <div className="text-[11px] text-[#6b7280] text-center">
        এই রিপোর্ট শুধুমাত্র প্রদর্শনের উদ্দেশ্যে। বাস্তব ব্যবহারে সমস্ত ডেটা Audit Log দ্বারা যাচাইযোগ্য।
      </div>
    </div>
  );
}
