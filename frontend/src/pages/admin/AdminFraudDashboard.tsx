import { useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import {
  getAllMonthlyPerf,
  getFraudReport,
  getTopRiskyDistributors,
} from "../../services/api";

interface RiskRow {
  distributorId: string;
  distributorName: string;
  score: number;
  riskLevel: string;
  totalTokens?: number;
  breakdown?: Record<string, number>;
  recommendation?: string;
}

interface MonthlyRow {
  distributorId: string;
  distributorName: string;
  totalSessions: number;
  totalDistributions: number;
  mismatchCount: number;
  iotVerifiedCount: number;
  fraudScore: number;
  rating: number;
  badge: string;
}

function riskColor(level: string) {
  if (level === "CRITICAL") return "bg-red-500";
  if (level === "HIGH") return "bg-orange-500";
  if (level === "MEDIUM") return "bg-yellow-500";
  return "bg-green-500";
}

function stars(rating: number) {
  const full = "★".repeat(Math.max(0, Math.min(5, rating)));
  const empty = "☆".repeat(Math.max(0, 5 - Math.min(5, rating)));
  return { full, empty };
}

export default function AdminFraudDashboard() {
  const [tab, setTab] = useState<"score" | "monthly">("score");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [top, setTop] = useState<RiskRow[]>([]);
  const [sortAsc, setSortAsc] = useState(false);
  const [active, setActive] = useState<RiskRow | null>(null);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);

  const loadFraud = async () => {
    try {
      setLoading(true);
      setError("");
      const [report, risky] = await Promise.all([
        getFraudReport(days),
        getTopRiskyDistributors(5, days),
      ]);
      setSummary({
        total: report.summary.total || 0,
        critical: report.summary.critical || 0,
        high: report.summary.high || 0,
        medium: report.summary.medium || 0,
        low: report.summary.low || 0,
      });
      setRows((report.distributors || []) as RiskRow[]);
      setTop((risky || []) as RiskRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিপোর্ট লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const loadMonthly = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getAllMonthlyPerf(year, month);
      setMonthlyRows((data.distributors || []) as MonthlyRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "মাসিক রিপোর্ট লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const sortedRows = useMemo(() => {
    const clone = [...rows];
    clone.sort((a, b) => (sortAsc ? a.score - b.score : b.score - a.score));
    return clone;
  }, [rows, sortAsc]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        জালিয়াতি বিশ্লেষণ
      </h1>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex gap-2">
        <button
          onClick={() => setTab("score")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "score" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Fraud Score
        </button>
        <button
          onClick={() => setTab("monthly")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === "monthly" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          Monthly Performance
        </button>
      </div>

      {tab === "score" && (
        <>
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-sm text-gray-600">গত কত দিনের ডেটা?</span>
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`rounded-lg px-3 py-2 text-sm ${days === d ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-700"}`}
                >
                  {d} দিন
                </button>
              ))}
              <button
                onClick={() => void loadFraud()}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 ml-auto"
              >
                রিপোর্ট তৈরি করুন
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-xl p-3 bg-purple-50">
                <div className="text-xs">মোট বিতরণকারী</div>
                <div className="text-xl font-bold">{summary.total}</div>
              </div>
              <div className="rounded-xl p-3 bg-red-100">
                <div className="text-xs">সংকটাপন্ন</div>
                <div className="text-xl font-bold text-red-700">
                  {summary.critical}
                </div>
              </div>
              <div className="rounded-xl p-3 bg-orange-100">
                <div className="text-xs">উচ্চ ঝুঁকি</div>
                <div className="text-xl font-bold text-orange-700">
                  {summary.high}
                </div>
              </div>
              <div className="rounded-xl p-3 bg-yellow-100">
                <div className="text-xs">মধ্যম ঝুঁকি</div>
                <div className="text-xl font-bold text-yellow-700">
                  {summary.medium}
                </div>
              </div>
              <div className="rounded-xl p-3 bg-green-100">
                <div className="text-xs">স্বাভাবিক</div>
                <div className="text-xl font-bold text-green-700">
                  {summary.low}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold mb-3">Top Risky Distributors</h2>
            <div className="space-y-2">
              {top.map((row) => (
                <div
                  key={row.distributorId}
                  className="grid grid-cols-12 items-center gap-2"
                >
                  <div className="col-span-3 text-sm text-gray-700">
                    {row.distributorName}
                  </div>
                  <div className="col-span-7 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`${riskColor(row.riskLevel)} h-full`}
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(row.score || 0)))}%`,
                      }}
                    />
                  </div>
                  <div className="col-span-2 text-right text-sm font-semibold">
                    {row.score}
                  </div>
                </div>
              ))}
              {top.length === 0 && (
                <div className="text-sm text-gray-500">
                  {loading ? "লোড হচ্ছে..." : "ডেটা নেই"}
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      বিতরণকারী
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      মোট টোকেন
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      মিসম্যাচ হার
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      ম্যানুয়াল হার
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      গড় ঘাটতি
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      স্পিড
                    </th>
                    <th
                      onClick={() => setSortAsc((v) => !v)}
                      className="text-xs uppercase text-gray-500 p-2 text-left cursor-pointer"
                    >
                      মোট স্কোর {sortAsc ? "↑" : "↓"}
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      ঝুঁকি
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      পরামর্শ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.distributorId}
                      className="border-t border-gray-100 cursor-pointer"
                      onClick={() => setActive(row)}
                    >
                      <td className="p-2 text-sm">{row.distributorName}</td>
                      <td className="p-2 text-sm">{row.totalTokens || 0}</td>
                      <td className="p-2 text-sm">—</td>
                      <td className="p-2 text-sm">—</td>
                      <td className="p-2 text-sm">—</td>
                      <td className="p-2 text-sm">—</td>
                      <td className="p-2 text-sm font-semibold">{row.score}</td>
                      <td className="p-2 text-sm">
                        <span className="rounded-full px-2 py-0.5 bg-purple-100 text-purple-700 text-xs">
                          {row.riskLevel}
                        </span>
                      </td>
                      <td className="p-2 text-sm">
                        {row.recommendation || "—"}
                      </td>
                    </tr>
                  ))}
                  {sortedRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-gray-500">
                        {loading ? "লোড হচ্ছে..." : "রিপোর্ট আনুন"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === "monthly" && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 w-28"
            />
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 w-24"
            />
            <button
              onClick={() => void loadMonthly()}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
            >
              রিপোর্ট লোড করুন
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    বিতরণকারী
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    সেশন
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    বিতরণ
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    মিসম্যাচ
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    IoT যাচাই
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    স্কোর
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    রেটিং
                  </th>
                  <th className="text-xs uppercase text-gray-500 p-2 text-left">
                    ব্যাজ
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((r) => {
                  const s = stars(r.rating);
                  return (
                    <tr
                      key={r.distributorId}
                      className="border-t border-gray-100"
                    >
                      <td className="p-2 text-sm">{r.distributorName}</td>
                      <td className="p-2 text-sm">{r.totalSessions}</td>
                      <td className="p-2 text-sm">{r.totalDistributions}</td>
                      <td className="p-2 text-sm">{r.mismatchCount}</td>
                      <td className="p-2 text-sm">{r.iotVerifiedCount}</td>
                      <td className="p-2 text-sm">{r.fraudScore}</td>
                      <td className="p-2 text-sm">
                        <span className="text-yellow-500">{s.full}</span>
                        <span className="text-gray-300">{s.empty}</span>
                      </td>
                      <td className="p-2 text-sm">
                        <span className="rounded-full px-2 py-0.5 bg-purple-100 text-purple-700 text-xs">
                          {r.badge}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {monthlyRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-gray-500">
                      {loading ? "লোড হচ্ছে..." : "রিপোর্ট আনুন"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal
        open={Boolean(active)}
        title="স্কোর বিস্তারিত"
        onClose={() => setActive(null)}
      >
        {active && (
          <div className="space-y-2 text-sm">
            <div>
              <b>বিতরণকারী:</b> {active.distributorName}
            </div>
            <div>
              <b>স্কোর:</b> {active.score}
            </div>
            <div>
              <b>ঝুঁকি:</b> {active.riskLevel}
            </div>
            <div>
              <b>ব্রেকডাউন:</b> {JSON.stringify(active.breakdown || {})}
            </div>
            <div>
              <b>পরামর্শ:</b> {active.recommendation || "—"}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
