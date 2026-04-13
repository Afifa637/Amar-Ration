import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import { getAppeals, reviewAppeal } from "../../services/api";
import { formatDate } from "../../utils/date";

type AppealStatus = "pending" | "under_review" | "approved" | "rejected";

interface AppealItem {
  _id: string;
  appealId: string;
  consumerPhone: string;
  reason: string;
  supportingInfo?: string;
  status: AppealStatus;
  createdAt: string;
  adminNote?: string;
}

export default function AdminAppealsPage() {
  const [items, setItems] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [active, setActive] = useState<AppealItem | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    "approved" | "rejected" | null
  >(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getAppeals({
        page: 1,
        limit: 100,
        status: status || undefined,
        startDate: from || undefined,
        endDate: to || undefined,
      });
      const mappedItems = (data.items || []).map((item) => {
        const row = item as Record<string, unknown>;
        return {
          _id: String(row._id || ""),
          appealId: String(row.appealId || ""),
          consumerPhone: String(row.consumerPhone || ""),
          reason: String(row.reason || ""),
          supportingInfo: row.supportingInfo
            ? String(row.supportingInfo)
            : undefined,
          status: String(row.status || "pending") as AppealStatus,
          createdAt: String(row.createdAt || new Date().toISOString()),
          adminNote: row.adminNote ? String(row.adminNote) : undefined,
        } as AppealItem;
      });
      setItems(mappedItems.filter((x) => x._id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const pending = items.filter((i) => i.status === "pending").length;
    const approved = items.filter((i) => i.status === "approved").length;
    const rejected = items.filter((i) => i.status === "rejected").length;
    return { total, pending, approved, rejected };
  }, [items]);

  const onReview = async () => {
    if (!active || !confirmAction) return;
    if (!adminNote.trim()) {
      setError("কারণ/মন্তব্য প্রয়োজন");
      return;
    }
    try {
      setLoading(true);
      await reviewAppeal(active.appealId, {
        decision: confirmAction,
        adminNote,
      });
      setActive(null);
      setConfirmAction(null);
      setAdminNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "রিভিউ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        কালো তালিকা আবেদন
      </h1>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="text-xs">মোট আবেদন</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-yellow-50 rounded-xl p-3">
            <div className="text-xs">অপেক্ষমাণ</div>
            <div className="text-2xl font-bold text-yellow-700">
              {stats.pending}
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-3">
            <div className="text-xs">অনুমোদিত</div>
            <div className="text-2xl font-bold text-green-700">
              {stats.approved}
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-3">
            <div className="text-xs">প্রত্যাখ্যাত</div>
            <div className="text-2xl font-bold text-red-700">
              {stats.rejected}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">সব স্ট্যাটাস</option>
            <option value="pending">অপেক্ষমাণ</option>
            <option value="under_review">পর্যালোচনাধীন</option>
            <option value="approved">অনুমোদিত</option>
            <option value="rejected">প্রত্যাখ্যাত</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={() => void load()}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
          >
            খুঁজুন
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  আবেদন ID
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  ভোক্তা
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  ফোন
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  কারণ
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  তারিখ
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  স্ট্যাটাস
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  কার্যক্রম
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="border-t border-gray-100">
                  <td className="p-2 text-sm">{item.appealId}</td>
                  <td className="p-2 text-sm">—</td>
                  <td className="p-2 text-sm">{item.consumerPhone}</td>
                  <td className="p-2 text-sm">{item.reason.slice(0, 35)}...</td>
                  <td className="p-2 text-sm">{formatDate(item.createdAt)}</td>
                  <td className="p-2 text-sm">
                    <span className="bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 text-xs">
                      {item.status}
                    </span>
                  </td>
                  <td className="p-2 text-sm">
                    <button
                      onClick={() => {
                        setActive(item);
                        setAdminNote(item.adminNote || "");
                      }}
                      className="bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg px-3 py-1"
                    >
                      বিস্তারিত
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-500">
                    {loading ? "লোড হচ্ছে..." : "কোনো আবেদন পাওয়া যায়নি"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={Boolean(active)}
        title="আবেদন পর্যালোচনা"
        onClose={() => setActive(null)}
      >
        {active && (
          <div className="space-y-3 text-sm">
            <div>
              <b>আবেদন:</b> {active.appealId}
            </div>
            <div>
              <b>ফোন:</b> {active.consumerPhone}
            </div>
            <div>
              <b>আবেদনের কারণ:</b> {active.reason}
            </div>
            <div>
              <b>Supporting Info:</b> {active.supportingInfo || "—"}
            </div>
            <textarea
              rows={4}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2"
              placeholder="প্রশাসকের নোট"
            />

            {!confirmAction ? (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmAction("approved")}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2"
                >
                  অনুমোদন করুন
                </button>
                <button
                  onClick={() => setConfirmAction("rejected")}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2"
                >
                  প্রত্যাখ্যান করুন
                </button>
              </div>
            ) : (
              <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-3">
                <p className="mb-3">আপনি কি নিশ্চিত?</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="bg-gray-100 rounded-lg px-3 py-2"
                  >
                    বাতিল করুন
                  </button>
                  <button
                    onClick={() => void onReview()}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-3 py-2"
                  >
                    নিশ্চিত করুন
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
