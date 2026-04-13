import { useEffect, useState } from "react";
import Modal from "../../components/ui/Modal";
import {
  deactivateConsumer,
  getEligibilityStats,
  getInactiveConsumers,
  reactivateConsumer,
  runEligibilityNow,
} from "../../services/api";
import { formatDate } from "../../utils/date";

interface InactiveRow {
  _id: string;
  consumerCode: string;
  name: string;
  ward?: string;
  flaggedInactiveAt?: string;
  lastCollectionDate?: string | null;
}

export default function AdminEligibilityPage() {
  const [stats, setStats] = useState({
    active: 0,
    inactive_review: 0,
    suspended: 0,
    blacklisted: 0,
  });
  const [items, setItems] = useState<InactiveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [confirm, setConfirm] = useState<{
    id: string;
    action: "reactivate" | "deactivate";
  } | null>(null);

  const load = async (targetPage = page) => {
    try {
      setLoading(true);
      setError("");
      const [statsData, rowsData] = await Promise.all([
        getEligibilityStats(),
        getInactiveConsumers({ page: targetPage, limit: 15 }),
      ]);
      setStats(statsData);
      const mappedItems = (rowsData.items || []).map((item) => {
        const row = item as Record<string, unknown>;
        return {
          _id: String(row._id || ""),
          consumerCode: String(row.consumerCode || ""),
          name: String(row.name || ""),
          ward: row.ward ? String(row.ward) : undefined,
          flaggedInactiveAt: row.flaggedInactiveAt
            ? String(row.flaggedInactiveAt)
            : undefined,
          lastCollectionDate: row.lastCollectionDate
            ? String(row.lastCollectionDate)
            : null,
        } as InactiveRow;
      });
      setItems(mappedItems.filter((x) => x._id));
      setPage(rowsData.pagination.page);
      setPages(rowsData.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFlag = async () => {
    try {
      setLoading(true);
      const r = await runEligibilityNow();
      setMessage(`${r.flagged} জন ভোক্তা চিহ্নিত হয়েছে`);
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "অপারেশন ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const doAction = async () => {
    if (!confirm) return;
    try {
      setLoading(true);
      if (confirm.action === "reactivate") {
        await reactivateConsumer(confirm.id);
      } else {
        await deactivateConsumer(confirm.id);
      }
      setConfirm(null);
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "অপারেশন ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        যোগ্যতা ব্যবস্থাপনা
      </h1>

      {(error || message) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}
        >
          {error || message}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl p-3 bg-green-50">
            <div className="text-xs">সক্রিয়</div>
            <div className="text-xl font-bold text-green-700">
              {stats.active}
            </div>
          </div>
          <div className="rounded-xl p-3 bg-yellow-50">
            <div className="text-xs">পর্যালোচনা প্রয়োজন</div>
            <div className="text-xl font-bold text-yellow-700">
              {stats.inactive_review}
            </div>
          </div>
          <div className="rounded-xl p-3 bg-red-50">
            <div className="text-xs">স্থগিত</div>
            <div className="text-xl font-bold text-red-700">
              {stats.suspended}
            </div>
          </div>
          <div className="rounded-xl p-3 bg-gray-100">
            <div className="text-xs">কালো তালিকাভুক্ত</div>
            <div className="text-xl font-bold text-gray-700">
              {stats.blacklisted}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <button
          onClick={() => void onFlag()}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
        >
          এখনই নিষ্ক্রিয় ভোক্তা চিহ্নিত করুন
        </button>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  ভোক্তা কোড
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  নাম
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  ওয়ার্ড
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  শেষ রেশন গ্রহণ
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  চিহ্নিত তারিখ
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  কার্যক্রম
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id} className="border-t border-gray-100">
                  <td className="p-2 text-sm">{row.consumerCode}</td>
                  <td className="p-2 text-sm">{row.name}</td>
                  <td className="p-2 text-sm">{row.ward || "—"}</td>
                  <td className="p-2 text-sm">
                    {row.lastCollectionDate
                      ? formatDate(row.lastCollectionDate)
                      : "কখনো নেননি"}
                  </td>
                  <td className="p-2 text-sm">
                    {formatDate(row.flaggedInactiveAt || "")}
                  </td>
                  <td className="p-2 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setConfirm({ id: row._id, action: "reactivate" })
                        }
                        className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1"
                      >
                        পুনরায় সক্রিয় করুন
                      </button>
                      <button
                        onClick={() =>
                          setConfirm({ id: row._id, action: "deactivate" })
                        }
                        className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1"
                      >
                        স্থগিত করুন
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-500">
                    {loading ? "লোড হচ্ছে..." : "কোনো তথ্য নেই"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
          <span>
            মোট ফলাফল | পৃষ্ঠা {page}/{pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => void load(page - 1)}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
            >
              পূর্বের
            </button>
            <button
              disabled={page >= pages}
              onClick={() => void load(page + 1)}
              className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
            >
              পরের
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={Boolean(confirm)}
        title="নিশ্চিতকরণ"
        onClose={() => setConfirm(null)}
      >
        <p className="text-sm text-gray-700 mb-4">আপনি কি নিশ্চিত?</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setConfirm(null)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2"
          >
            বাতিল
          </button>
          <button
            onClick={() => void doAction()}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
          >
            নিশ্চিত করুন
          </button>
        </div>
      </Modal>
    </div>
  );
}
