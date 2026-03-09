import { useEffect, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import api from "../../services/api";

type Tab = "distribution" | "stock" | "token" | "audit";

type ReportsResponse = {
  totalTokens: number;
  usedTokens: number;
  cancelledTokens: number;
  mismatchCount: number;
  totalStockOutKg: number;
};

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("distribution");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReports() {
    try {
      setLoading(true);
      setError("");
      const res = (await api.get("/distributor/reports")) as ReportsResponse;
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিপোর্ট লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <div className="space-y-3">
      <PortalSection
        title="রিপোর্ট ও বিশ্লেষণ (Reports & Analytics)"
        right={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadReports}>
              🔄 রিফ্রেশ
            </Button>
            <Button variant="ghost" onClick={() => window.print()}>
              🖨️ প্রিন্ট
            </Button>
          </div>
        }
      >
        <div className="text-[12px] text-[#6b7280]">
          নির্বাচিত সময় ও লোকেশন অনুযায়ী আমার রেশন বিতরণ কার্যক্রমের বিশ্লেষণ।
        </div>
      </PortalSection>

      {error && <div className="text-sm text-red-600">{error}</div>}

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

      <PortalSection title="সারাংশ (KPI)">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="border p-3 bg-[#f0fdf4]">
            <div className="text-[12px]">মোট বিতরণ</div>
            <div className="text-[20px] font-bold">{data?.totalStockOutKg ?? 0} কেজি</div>
          </div>
          <div className="border p-3 bg-[#eff6ff]">
            <div className="text-[12px]">সফল টোকেন</div>
            <div className="text-[20px] font-bold">{data?.usedTokens ?? 0}</div>
          </div>
          <div className="border p-3 bg-[#fff7ed]">
            <div className="text-[12px]">মিসম্যাচ</div>
            <div className="text-[20px] font-bold">{data?.mismatchCount ?? 0}</div>
          </div>
          <div className="border p-3 bg-[#fef2f2]">
            <div className="text-[12px]">Cancelled</div>
            <div className="text-[20px] font-bold">{data?.cancelledTokens ?? 0}</div>
          </div>
        </div>
      </PortalSection>

      <PortalSection title="রিপোর্ট টেবিল">
        <div className="border rounded overflow-x-auto bg-white">
          <table className="min-w-[850px] w-full text-[12px]">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="border p-2">রিপোর্ট টাইপ</th>
                <th className="border p-2">মান</th>
                <th className="border p-2">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2 text-center">Total Tokens</td>
                <td className="border p-2 text-center">{data?.totalTokens ?? 0}</td>
                <td className="border p-2 text-center"><Badge tone="blue">Loaded</Badge></td>
              </tr>
              <tr>
                <td className="border p-2 text-center">Used Tokens</td>
                <td className="border p-2 text-center">{data?.usedTokens ?? 0}</td>
                <td className="border p-2 text-center"><Badge tone="green">Success</Badge></td>
              </tr>
              <tr>
                <td className="border p-2 text-center">Mismatch Count</td>
                <td className="border p-2 text-center">{data?.mismatchCount ?? 0}</td>
                <td className="border p-2 text-center"><Badge tone="red">Audit</Badge></td>
              </tr>
              <tr>
                <td className="border p-2 text-center">Distributed Stock</td>
                <td className="border p-2 text-center">{data?.totalStockOutKg ?? 0} kg</td>
                <td className="border p-2 text-center"><Badge tone="green">Reconciled</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </PortalSection>

      {loading && <div className="text-[12px] text-[#6b7280] text-center">লোড হচ্ছে...</div>}
    </div>
  );
}