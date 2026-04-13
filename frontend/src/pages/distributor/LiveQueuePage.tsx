import { useCallback, useEffect, useState } from "react";
import PortalSection from "../../components/PortalSection";
import Button from "../../components/ui/Button";
import {
  callNextInQueue,
  getQueueStatus,
  getSessionQueueEntries,
  skipQueueEntry,
  type QueueStatus,
} from "../../services/api";

interface QueueItem {
  _id: string;
  queueNumber: number;
  status: string;
  consumerId?: { name?: string; consumerCode?: string };
  joinedAt?: string;
}

export default function LiveQueuePage() {
  const [sessionId, setSessionId] = useState("");
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
        const mappedItems = (list.items || []).map((item) => {
          const row = item as Record<string, unknown>;
          const consumer = (row.consumerId || {}) as Record<string, unknown>;
          return {
            _id: String(row._id || ""),
            queueNumber: Number(row.queueNumber || 0),
            status: String(row.status || ""),
            joinedAt: row.issuedAt
              ? String(row.issuedAt)
              : row.joinedAt
                ? String(row.joinedAt)
                : undefined,
            consumerId: {
              name: consumer.name ? String(consumer.name) : undefined,
              consumerCode: consumer.consumerCode
                ? String(consumer.consumerCode)
                : undefined,
            },
          } as QueueItem;
        });
        setItems(mappedItems.filter((x) => x._id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "কিউ ডেটা লোড ব্যর্থ");
      } finally {
        setLoading(false);
      }
    },
    [sessionId],
  );

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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="md:col-span-2 border border-gray-300 rounded px-3 py-2"
            placeholder="সেশন আইডি দিন"
          />
          <Button onClick={() => void load()} disabled={!sessionId || loading}>
            রিফ্রেশ
          </Button>
          <Button
            onClick={() => void onCallNext()}
            disabled={!sessionId || loading}
          >
            পরবর্তী কল
          </Button>
        </div>

        {status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-sm">
            <div className="border rounded p-2">
              মোট:{" "}
              <b>
                {(status.waitingCount || 0) +
                  (status.nextUp?.length || 0) +
                  (status.currentlyServing ? 1 : 0)}
              </b>
            </div>
            <div className="border rounded p-2">
              অপেক্ষমাণ: <b>{String(status.waitingCount || 0)}</b>
            </div>
            <div className="border rounded p-2">
              কলড: <b>{status.currentlyServing ? "১" : "০"}</b>
            </div>
            <div className="border rounded p-2">
              চলমান:{" "}
              <b>
                {status.currentlyServing
                  ? `#${status.currentlyServing.queueNumber}`
                  : "—"}
              </b>
            </div>
          </div>
        )}

        <div className="border rounded overflow-x-auto bg-white">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 border">টোকেন নং</th>
                <th className="p-2 border">ভোক্তা</th>
                <th className="p-2 border">স্ট্যাটাস</th>
                <th className="p-2 border">যোগদানের সময়</th>
                <th className="p-2 border">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id}>
                  <td className="p-2 border text-center">#{it.queueNumber}</td>
                  <td className="p-2 border">
                    {it.consumerId?.name || "—"} (
                    {it.consumerId?.consumerCode || "—"})
                  </td>
                  <td className="p-2 border text-center">{it.status}</td>
                  <td className="p-2 border text-center">
                    {it.joinedAt
                      ? new Date(it.joinedAt).toLocaleTimeString("bn-BD")
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
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-500">
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
