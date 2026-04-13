import { useEffect, useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import {
  getComplaintStats,
  getComplaints,
  resolveComplaint,
  type ComplaintStats,
} from "../../services/api";
import { formatDate } from "../../utils/date";

type ComplaintStatus = "open" | "under_review" | "resolved" | "rejected";

interface ComplaintItem {
  _id: string;
  complaintId: string;
  consumerPhone: string;
  category: string;
  description: string;
  status: ComplaintStatus;
  adminNote?: string;
  resolvedAt?: string;
  createdAt: string;
}

function statusBadge(status: ComplaintStatus) {
  if (status === "open") return "bg-yellow-100 text-yellow-800";
  if (status === "under_review") return "bg-purple-100 text-purple-800";
  if (status === "resolved") return "bg-green-100 text-green-800";
  return "bg-red-100 text-red-800";
}

function categoryLabel(category: string) {
  const map: Record<string, string> = {
    weight_mismatch: "ওজন গরমিল",
    missing_ration: "রেশন নেই",
    wrong_amount: "ভুল পরিমাণ",
    distributor_behavior: "বিতরণকারীর আচরণ",
    registration_issue: "নিবন্ধন সমস্যা",
    other: "অন্যান্য",
  };
  return map[category] || category;
}

export default function AdminComplaintsPage() {
  const [stats, setStats] = useState<ComplaintStats | null>(null);
  const [items, setItems] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [active, setActive] = useState<ComplaintItem | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const load = async (targetPage = page) => {
    try {
      setLoading(true);
      setError("");
      const [statsData, rowsData] = await Promise.all([
        getComplaintStats(),
        getComplaints({
          page: targetPage,
          limit: 20,
          status: status || undefined,
          category: category || undefined,
          startDate: from || undefined,
          endDate: to || undefined,
        }),
      ]);
      setStats(statsData);
      const mappedItems = (rowsData.items || []).map((item) => {
        const row = item as Record<string, unknown>;
        return {
          _id: String(row._id || ""),
          complaintId: String(row.complaintId || ""),
          consumerPhone: String(row.consumerPhone || ""),
          category: String(row.category || "other"),
          description: String(row.description || ""),
          status: String(row.status || "open") as ComplaintStatus,
          adminNote: row.adminNote ? String(row.adminNote) : undefined,
          resolvedAt: row.resolvedAt ? String(row.resolvedAt) : undefined,
          createdAt: String(row.createdAt || new Date().toISOString()),
        } as ComplaintItem;
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

  const statCards = useMemo(
    () => [
      { title: "মোট", value: stats?.total || 0 },
      { title: "অমীমাংসিত", value: stats?.open || 0 },
      { title: "পর্যালোচনাধীন", value: stats?.under_review || 0 },
      { title: "সমাধান হয়েছে", value: stats?.resolved || 0 },
    ],
    [stats],
  );

  const onResolve = async (decision: "resolved" | "rejected") => {
    if (!active) return;
    try {
      setLoading(true);
      await resolveComplaint(active.complaintId, {
        status: decision,
        adminNote,
      });
      setActive(null);
      setAdminNote("");
      await load(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "আপডেট ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        অভিযোগ ব্যবস্থাপনা
      </h1>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-gray-100 bg-gray-50 p-3"
            >
              <div className="text-xs text-gray-500">{card.title}</div>
              <div className="text-2xl font-bold text-gray-800">
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">সব স্ট্যাটাস</option>
            <option value="open">খোলা</option>
            <option value="under_review">পর্যালোচনাধীন</option>
            <option value="resolved">সমাধান</option>
            <option value="rejected">প্রত্যাখ্যাত</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">সব ক্যাটাগরি</option>
            <option value="weight_mismatch">ওজন গরমিল</option>
            <option value="missing_ration">রেশন নেই</option>
            <option value="wrong_amount">ভুল পরিমাণ</option>
            <option value="distributor_behavior">বিতরণকারীর আচরণ</option>
            <option value="registration_issue">নিবন্ধন সমস্যা</option>
            <option value="other">অন্যান্য</option>
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
            onClick={() => void load(1)}
            className="md:col-span-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
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
                  অভিযোগ ID
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  ফোন
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  ক্যাটাগরি
                </th>
                <th className="text-xs uppercase text-gray-500 p-2 text-left">
                  বর্ণনা
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
                  <td className="p-2 text-sm">{item.complaintId}</td>
                  <td className="p-2 text-sm">{item.consumerPhone}</td>
                  <td className="p-2 text-sm">
                    {categoryLabel(item.category)}
                  </td>
                  <td className="p-2 text-sm">
                    {item.description.slice(0, 40)}...
                  </td>
                  <td className="p-2 text-sm">{formatDate(item.createdAt)}</td>
                  <td className="p-2 text-sm">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(item.status)}`}
                    >
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
                    {loading ? "লোড হচ্ছে..." : "কোনো অভিযোগ পাওয়া যায়নি"}
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
        open={Boolean(active)}
        title="অভিযোগ বিস্তারিত"
        onClose={() => setActive(null)}
      >
        {active && (
          <div className="space-y-3 text-sm">
            <div>
              <b>ID:</b> {active.complaintId}
            </div>
            <div>
              <b>ফোন:</b> {active.consumerPhone}
            </div>
            <div>
              <b>ক্যাটাগরি:</b> {categoryLabel(active.category)}
            </div>
            <div>
              <b>বিবরণ:</b> {active.description}
            </div>

            {(active.status === "open" || active.status === "under_review") && (
              <>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                  placeholder="প্রশাসকের মন্তব্য"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => void onResolve("resolved")}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2"
                  >
                    সমাধান করুন
                  </button>
                  <button
                    onClick={() => void onResolve("rejected")}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-4 py-2"
                  >
                    প্রত্যাখ্যান করুন
                  </button>
                </div>
              </>
            )}

            {(active.status === "resolved" || active.status === "rejected") && (
              <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
                <div>
                  <b>মন্তব্য:</b> {active.adminNote || "—"}
                </div>
                <div>
                  <b>সময়:</b> {formatDate(active.resolvedAt || "")}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
