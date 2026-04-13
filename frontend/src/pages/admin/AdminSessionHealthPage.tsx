import { useEffect, useMemo, useRef, useState } from "react";
import {
  downloadReconciliationReport,
  generateReconciliationReport,
  getDistributionSessions,
  openSessionHealthSSE,
  type DistributionSession,
} from "../../services/api";

interface SessionHealthData {
  sessionId: string;
  status: string;
  tokensIssued: number;
  tokensUsed: number;
  mismatchCount: number;
  stockIn: number;
  stockOut: number;
  remainingStock: number;
  servedPeople?: number;
  eligiblePeople?: number;
  remainingPeople?: number;
  byItem?: Record<
    "চাল" | "ডাল" | "পেঁয়াজ",
    {
      expectedKg: number;
      actualKg: number;
      stockInKg: number;
      stockOutKg: number;
    }
  >;
  recentActivity?: Array<{
    action: string;
    severity: string;
    createdAt: string;
  }>;
  lastUpdated: string;
}

const STOCK_ITEMS: Array<"চাল" | "ডাল" | "পেঁয়াজ"> = ["চাল", "ডাল", "পেঁয়াজ"];

export default function AdminSessionHealthPage() {
  const [sessions, setSessions] = useState<DistributionSession[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [health, setHealth] = useState<SessionHealthData | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sseRef = useRef<EventSource | null>(null);

  const loadSessions = async () => {
    try {
      const data = await getDistributionSessions({
        limit: 100,
      });
      const active = (data.sessions || []).filter(
        (s) => s.status === "Open" || s.status === "Paused",
      );
      setSessions(active);
      if (!selectedSession && active.length) {
        setSelectedSession(active[0]._id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেশন লোড ব্যর্থ");
    }
  };

  useEffect(() => {
    void loadSessions();
    return () => {
      sseRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectLive = () => {
    if (!selectedSession) return;
    sseRef.current?.close();
    setConnected(false);
    setError("");

    const es = openSessionHealthSSE(
      selectedSession,
      (data) => {
        setHealth(data as unknown as SessionHealthData);
        setConnected(true);
      },
      () => {
        setConnected(false);
      },
    );

    sseRef.current = es;
  };

  const progress = useMemo(() => {
    if (!health?.tokensIssued) return 0;
    return Math.min(
      100,
      Math.max(0, Math.round((health.tokensUsed / health.tokensIssued) * 100)),
    );
  }, [health]);

  const onDownload = async () => {
    if (!selectedSession) return;
    try {
      setLoading(true);
      const blob = await downloadReconciliationReport(selectedSession);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reconciliation-${selectedSession}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডাউনলোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onGenerate = async () => {
    if (!selectedSession) return;
    try {
      setLoading(true);
      await generateReconciliationReport(selectedSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিপোর্ট জেনারেট ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        লাইভ সেশন পর্যবেক্ষণ
      </h1>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 min-w-[320px]"
          >
            <option value="">সেশন নির্বাচন করুন</option>
            {sessions.map((s) => (
              <option key={s._id} value={s._id}>
                সেশন #{s._id.slice(-6)} — {s.dateKey}
              </option>
            ))}
          </select>
          <button
            onClick={connectLive}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
          >
            লাইভ দেখুন
          </button>
          {!connected && health && (
            <button
              onClick={connectLive}
              className="bg-yellow-100 text-yellow-800 rounded-lg px-4 py-2"
            >
              সংযোগ বিচ্ছিন্ন — পুনরায় সংযোগ করুন
            </button>
          )}
          {connected && (
            <div className="ml-auto flex items-center gap-2 text-green-600 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              লাইভ আপডেট
            </div>
          )}
        </div>
      </section>

      {health && (
        <>
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl p-3 bg-gray-50">
                <div className="text-xs">সেশন অবস্থা</div>
                <div className="font-bold">{health.status}</div>
              </div>
              <div className="rounded-xl p-3 bg-gray-50">
                <div className="text-xs">জারিকৃত টোকেন</div>
                <div className="font-bold">{health.tokensIssued}</div>
              </div>
              <div className="rounded-xl p-3 bg-gray-50">
                <div className="text-xs">সম্পন্ন বিতরণ</div>
                <div className="font-bold">{health.tokensUsed}</div>
              </div>
              <div
                className={`rounded-xl p-3 ${health.mismatchCount > 0 ? "bg-red-50" : "bg-gray-50"}`}
              >
                <div className="text-xs">মিসম্যাচ সংখ্যা</div>
                <div className="font-bold">{health.mismatchCount}</div>
              </div>
              <div className="rounded-xl p-3 bg-gray-50">
                <div className="text-xs">মজুদ প্রবেশ (কেজি)</div>
                <div className="font-bold">{health.stockIn}</div>
              </div>
              <div className="rounded-xl p-3 bg-gray-50">
                <div className="text-xs">প্রদত্ত (কেজি)</div>
                <div className="font-bold">{health.stockOut}</div>
              </div>
              <div className="rounded-xl p-3 bg-gray-50">
                <div className="text-xs">সেবা প্রাপ্ত পরিবার</div>
                <div className="font-bold">{health.servedPeople ?? 0}</div>
              </div>
              <div className="rounded-xl p-3 bg-gray-50">
                <div className="text-xs">অবশিষ্ট পরিবার</div>
                <div className="font-bold">{health.remainingPeople ?? 0}</div>
              </div>
              <div
                className={`rounded-xl p-3 ${health.stockIn > 0 && health.remainingStock < health.stockIn * 0.2 ? "bg-yellow-50" : "bg-gray-50"}`}
              >
                <div className="text-xs">অবশিষ্ট মজুদ (কেজি)</div>
                <div className="font-bold">{health.remainingStock}</div>
              </div>
              <div className="rounded-xl p-3 bg-gray-50">
                <div className="text-xs">সর্বশেষ আপডেট</div>
                <div className="font-bold text-sm">
                  {new Date(health.lastUpdated).toLocaleTimeString("bn-BD")}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>প্রগতি</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold text-gray-700 mb-2">
                ৩ আইটেম ভিত্তিক সেশন চিত্র
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">আইটেম</th>
                      <th className="p-2 text-left">Expected (kg)</th>
                      <th className="p-2 text-left">Received (kg)</th>
                      <th className="p-2 text-left">Stock In (kg)</th>
                      <th className="p-2 text-left">Stock Out (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STOCK_ITEMS.map((item) => {
                      const row = health.byItem?.[item];
                      return (
                        <tr key={item} className="border-t border-gray-100">
                          <td className="p-2">{item}</td>
                          <td className="p-2">{row?.expectedKg ?? 0}</td>
                          <td className="p-2">{row?.actualKg ?? 0}</td>
                          <td className="p-2">{row?.stockInKg ?? 0}</td>
                          <td className="p-2">{row?.stockOutKg ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {(health.recentActivity?.length || 0) > 0 && (
              <div className="mt-5">
                <div className="text-sm font-semibold text-gray-700 mb-2">
                  সাম্প্রতিক কার্যক্রম
                </div>
                <div className="space-y-2">
                  {(health.recentActivity || []).map((log, idx) => (
                    <div
                      key={`${log.createdAt}-${idx}`}
                      className="text-xs border border-gray-200 rounded px-3 py-2 bg-gray-50"
                    >
                      <span className="font-medium">{log.action}</span>
                      <span className="mx-2">•</span>
                      <span>{log.severity}</span>
                      <span className="mx-2">•</span>
                      <span>
                        {new Date(log.createdAt).toLocaleString("bn-BD")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void onDownload()}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
              >
                সমন্বয় রিপোর্ট ডাউনলোড করুন
              </button>
              <button
                onClick={() => void onGenerate()}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg px-4 py-2"
              >
                রিপোর্ট তৈরি করুন
              </button>
              {loading && (
                <span className="text-sm text-gray-500">লোড হচ্ছে...</span>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
