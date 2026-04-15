import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import {
  callNextInQueue,
  getDistributionSessions,
  getQueueStatus,
  getSessionQueueEntries,
  skipQueueEntry,
  type QueueEntryRow,
  type QueueStatus,
} from "../../services/api";

const STOCK_ITEMS = ["চাল", "ডাল", "পেঁয়াজ"] as const;

function normalizeByItem(
  item?: string,
  qty?: number,
  byItem?: Record<string, number>,
) {
  const out: Record<string, number> = { চাল: 0, ডাল: 0, পেঁয়াজ: 0 };
  if (byItem) {
    for (const key of Object.keys(out)) {
      out[key] = Number(byItem[key] || 0);
    }
    return out;
  }
  if (item && STOCK_ITEMS.includes(item as (typeof STOCK_ITEMS)[number])) {
    out[item] = Number(qty || 0);
  }
  return out;
}

function byItemText(byItem: Record<string, number>) {
  return STOCK_ITEMS.map(
    (item) => `${item}: ${Number(byItem[item] || 0).toFixed(2)}kg`,
  ).join(" | ");
}

export default function LiveQueuePage() {
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessions, setSessions] = useState<
    Array<{
      _id: string;
      dateKey: string;
      status: "Planned" | "Open" | "Paused" | "Closed";
      sessionCode?: string;
      division?: string;
      ward?: string;
    }>
  >([]);
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [items, setItems] = useState<QueueEntryRow[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    waiting: number;
    serving: number;
    served: number;
    skipped: number;
    mismatchCount: number;
    remaining: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fromQuery = String(searchParams.get("sessionId") || "").trim();
    if (fromQuery) {
      setSessionId(fromQuery);
    }
  }, [searchParams]);

  const loadSessions = useCallback(async () => {
    try {
      const [open, planned, recent] = await Promise.all([
        getDistributionSessions({ page: 1, limit: 30, status: "Open" }),
        getDistributionSessions({ page: 1, limit: 30, status: "Planned" }),
        getDistributionSessions({ page: 1, limit: 30, status: "Closed" }),
      ]);

      const merged = [
        ...(open.sessions || []),
        ...(planned.sessions || []),
        ...(recent.sessions || []),
      ]
        .sort((a, b) => {
          const aDate = `${a.dateKey || ""}T00:00:00`;
          const bDate = `${b.dateKey || ""}T00:00:00`;
          return new Date(bDate).getTime() - new Date(aDate).getTime();
        })
        .slice(0, 60);
      setSessions(merged);

      if (!sessionId && merged[0]?._id) {
        setSessionId(String(merged[0]._id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেশন তালিকা লোড ব্যর্থ");
    }
  }, [sessionId]);

  const load = useCallback(
    async (id = sessionId) => {
      if (!id) return;
      try {
        setLoading(true);
        setError("");
        const [s, list] = await Promise.all([
          getQueueStatus(id),
          getSessionQueueEntries(id, 1, 100),
        ]);
        setStatus(s);
        setSummary(list.summary || null);
        setItems((list.items || []).filter((x) => x._id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "কিউ ডেটা লোড ব্যর্থ");
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!sessionId) return;
    void load(sessionId);
    const timer = window.setInterval(() => {
      void load(sessionId);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [sessionId, load]);

  const onCallNext = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      await callNextInQueue(sessionId);
      setMessage("পরবর্তী ভোক্তাকে কল করা হয়েছে");
      await load(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "কল ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onSkip = async (entryId: string) => {
    try {
      setLoading(true);
      await skipQueueEntry(entryId);
      setMessage("ভোক্তা স্কিপ করা হয়েছে");
      await load(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "স্কিপ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const printQueue = () => {
    if (!sessionId) return;
    const win = window.open("", "_blank", "width=1200,height=820");
    if (!win) return;
    win.document.write(`
      <html><head><title>Live Queue</title>
      <style>
        body{font-family:Arial,sans-serif;margin:20px}
        h2{margin:0 0 6px}
        .meta{font-size:12px;color:#475569;margin-bottom:12px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #cbd5e1;padding:6px;vertical-align:top}
        th{background:#f1f5f9}
      </style></head><body>
      <h2>লাইভ কিউ বোর্ড</h2>
      <div class="meta">Session: ${status?.sessionCode || sessionId} | Division: ${status?.division || "—"} | Ward: ${status?.ward || "—"} | Rows: ${items.length} | Printed: ${new Date().toLocaleString("bn-BD")}</div>
      <table><thead><tr><th>#</th><th>Consumer</th><th>Token</th><th>Category</th><th>Item</th><th>Expected</th><th>Actual</th><th>Mismatch</th><th>Status</th><th>Joined</th></tr></thead>
      <tbody>
      ${items
        .map((it) => {
          const expectedByItem = normalizeByItem(
            it.rationItem,
            it.expectedKg,
            it.expectedByItem,
          );
          const actualByItem = normalizeByItem(
            it.rationItem,
            it.actualKg,
            it.actualByItem,
          );
          return `<tr>
            <td>${it.queueNumber}</td>
            <td>${it.consumerCode || "—"}<br/>${it.consumerName || ""}</td>
            <td>${it.tokenCode || "—"}</td>
            <td>${it.category || "—"}</td>
            <td>${it.rationItem || "—"}</td>
            <td>${byItemText(expectedByItem)}</td>
            <td>${byItemText(actualByItem)}</td>
            <td>${it.mismatch ? "Yes" : "No"}${it.mismatchReason ? `<br/>${it.mismatchReason}` : ""}</td>
            <td>${it.status}</td>
            <td>${it.joinedAt ? new Date(it.joinedAt).toLocaleTimeString("bn-BD") : "—"}</td>
          </tr>`;
        })
        .join("")}
      </tbody></table>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `);
    win.document.close();
  };

  const sessionOptions = sessions.filter((session) => {
    if (!sessionQuery.trim()) return true;
    const needle = sessionQuery.toLowerCase();
    return (
      String(session.sessionCode || "")
        .toLowerCase()
        .includes(needle) ||
      String(session.dateKey || "")
        .toLowerCase()
        .includes(needle) ||
      String(session.status || "")
        .toLowerCase()
        .includes(needle)
    );
  });

  return (
    <div className="space-y-3">
      <PortalSection title="লাইভ কিউ বোর্ড">
        {(error || message) && (
          <div
            className={`mb-3 rounded border px-3 py-2 text-[12px] ${error ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700"}`}
          >
            {error || message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
          <input
            value={sessionQuery}
            onChange={(e) => setSessionQuery(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
            placeholder="সেশন সার্চ"
          />
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="md:col-span-2 border border-gray-300 rounded px-3 py-2 bg-white"
          >
            <option value="">সেশন নির্বাচন করুন</option>
            {sessionOptions.map((session) => (
              <option key={session._id} value={session._id}>
                {session.sessionCode || session._id} | {session.dateKey} |{" "}
                {session.status}
              </option>
            ))}
          </select>
          <input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
            placeholder="Debug: raw session ID"
          />
          <Button onClick={() => void loadSessions()} disabled={loading}>
            সেশন রিফ্রেশ
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <Button onClick={() => void load()} disabled={!sessionId || loading}>
            কিউ রিফ্রেশ
          </Button>
          <Button
            onClick={() => void onCallNext()}
            disabled={!sessionId || loading}
          >
            পরবর্তী কল
          </Button>
          <Button
            variant="secondary"
            onClick={printQueue}
            disabled={!sessionId}
          >
            🖨️ সেশন প্রিন্ট
          </Button>
        </div>

        {status && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3 text-sm">
            <div className="border rounded p-2">
              মোট: <b>{summary?.total ?? status.summary?.totalInQueue ?? 0}</b>
            </div>
            <div className="border rounded p-2">
              অপেক্ষমাণ:{" "}
              <b>
                {String(
                  summary?.waiting ??
                    status.summary?.waiting ??
                    status.waitingCount ??
                    0,
                )}
              </b>
            </div>
            <div className="border rounded p-2">
              Serving:{" "}
              <b>{String(summary?.serving ?? status.summary?.serving ?? 0)}</b>
            </div>
            <div className="border rounded p-2">
              Served:{" "}
              <b>{String(summary?.served ?? status.summary?.served ?? 0)}</b>
            </div>
            <div className="border rounded p-2">
              Skipped:{" "}
              <b>{String(summary?.skipped ?? status.summary?.skipped ?? 0)}</b>
            </div>
            <div className="border rounded p-2">
              Mismatch:{" "}
              <b>
                {String(
                  summary?.mismatchCount ?? status.summary?.mismatchCount ?? 0,
                )}
              </b>
            </div>
          </div>
        )}

        <div className="border rounded overflow-x-auto bg-white">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 border">টোকেন নং</th>
                <th className="p-2 border">সেশন/এলাকা</th>
                <th className="p-2 border">ভোক্তা</th>
                <th className="p-2 border">টোকেন/আইটেম</th>
                <th className="p-2 border">Expected/Actual</th>
                <th className="p-2 border">Mismatch</th>
                <th className="p-2 border">স্ট্যাটাস</th>
                <th className="p-2 border">যোগদানের সময়</th>
                <th className="p-2 border">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id}>
                  {(() => {
                    const expectedByItem = normalizeByItem(
                      it.rationItem,
                      it.expectedKg,
                      it.expectedByItem,
                    );
                    const actualByItem = normalizeByItem(
                      it.rationItem,
                      it.actualKg,
                      it.actualByItem,
                    );
                    const expectedTotal = STOCK_ITEMS.reduce(
                      (sum, item) => sum + Number(expectedByItem[item] || 0),
                      0,
                    );
                    const actualTotal = STOCK_ITEMS.reduce(
                      (sum, item) => sum + Number(actualByItem[item] || 0),
                      0,
                    );

                    return (
                      <>
                        <td className="p-2 border text-center">
                          #{it.queueNumber}
                        </td>
                        <td className="p-2 border text-center">
                          {it.sessionCode || status?.sessionCode || "—"}
                          <div className="text-[10px] text-gray-500">
                            {it.division || status?.division || "—"} /{" "}
                            {it.ward || status?.ward || "—"}
                          </div>
                        </td>
                        <td className="p-2 border">
                          {it.consumerName || "—"} ({it.consumerCode || "—"})
                          <div className="text-[10px] text-gray-500">
                            {it.category || "—"}
                          </div>
                        </td>
                        <td className="p-2 border text-center">
                          {it.tokenCode || "—"}
                          <div className="text-[10px] text-gray-500">
                            {it.rationItem || "—"}
                          </div>
                        </td>
                        <td className="p-2 border text-left">
                          <div className="text-[11px]">
                            E: {byItemText(expectedByItem)}
                          </div>
                          <div className="text-[11px]">
                            A: {byItemText(actualByItem)}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Total: {expectedTotal.toFixed(2)} /{" "}
                            {actualTotal.toFixed(2)}
                          </div>
                        </td>
                        <td className="p-2 border text-center">
                          {it.mismatch ? "Yes" : "No"}
                          <div className="text-[10px] text-gray-500">
                            {it.mismatchReason || "—"}
                          </div>
                        </td>
                        <td className="p-2 border text-center">{it.status}</td>
                        <td className="p-2 border text-center">
                          {it.joinedAt || it.issuedAt
                            ? new Date(
                                it.joinedAt || it.issuedAt || "",
                              ).toLocaleTimeString("bn-BD")
                            : "—"}
                        </td>
                        <td className="p-2 border text-center">
                          {it.status === "waiting" ? (
                            <button
                              onClick={() => void onSkip(it._id)}
                              className="bg-rose-600 hover:bg-rose-700 text-white rounded px-2 py-1 text-xs"
                            >
                              স্কিপ
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-500">
                    {loading ? "লোড হচ্ছে..." : "কিউ ডেটা নেই"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PortalSection>
    </div>
  );
}
