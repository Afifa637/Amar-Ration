import { useCallback, useEffect, useState } from "react";
import {
  approveFieldApplication,
  getFieldApplications,
  rejectFieldApplication,
  type FieldApplication,
} from "../../services/api";

type FilterStatus = "Pending" | "Active" | "Revoked";

function toBanglaDigits(value: number | string) {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value).replace(/\d/g, (d) => bn[Number(d)] || d);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("bn-BD", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const statusBadge: Record<FilterStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Active: "bg-green-100 text-green-800",
  Revoked: "bg-red-100 text-red-800",
};

const statusLabel: Record<FilterStatus, string> = {
  Pending: "অপেক্ষমাণ",
  Active: "অনুমোদিত",
  Revoked: "প্রত্যাখ্যাত",
};

export default function FieldApplicationsPage() {
  const [filter, setFilter] = useState<FilterStatus>("Pending");
  const [applications, setApplications] = useState<FieldApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ userId: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getFieldApplications({ status: filter, page, limit: 15 });
      setApplications(data.applications);
      setTotalPages(data.pagination.pages);
      setTotalCount(data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ডেটা লোড ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  async function handleApprove(userId: string) {
    setActionLoading(userId);
    setSuccessMsg("");
    try {
      const result = await approveFieldApplication(userId);
      setSuccessMsg(
        `✅ ${result.name} এর আবেদন অনুমোদিত হয়েছে।${result.emailSent ? " ইমেইলে লগইন তথ্য পাঠানো হয়েছে।" : " ইমেইল পাঠাতে সমস্যা হয়েছে।"}`,
      );
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "অনুমোদন ব্যর্থ হয়েছে");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectConfirm() {
    if (!rejectModal) return;
    setActionLoading(rejectModal.userId);
    setSuccessMsg("");
    try {
      await rejectFieldApplication(rejectModal.userId, rejectReason);
      setSuccessMsg(`${rejectModal.name} এর আবেদন প্রত্যাখ্যাত হয়েছে।`);
      setRejectModal(null);
      setRejectReason("");
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "প্রত্যাখ্যান ব্যর্থ হয়েছে");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#0d2b3a]">ফিল্ড ডিস্ট্রিবিউটর আবেদন</h1>
        <p className="text-sm text-gray-500 mt-1">
          আপনার ওয়ার্ড থেকে ফিল্ড ডিস্ট্রিবিউটর পদের জন্য আবেদনকারীদের তালিকা।
          অনুমোদন করলে আবেদনকারীর ইমেইলে স্বয়ংক্রিয় লগইন তথ্য পাঠানো হবে।
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["Pending", "Active", "Revoked"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
              filter === s
                ? "bg-[#0d2b3a] text-white border-[#0d2b3a]"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {statusLabel[s]}
            {s === filter && totalCount > 0 && (
              <span className="ml-1 text-xs opacity-75">({toBanglaDigits(totalCount)})</span>
            )}
          </button>
        ))}
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">লোড হচ্ছে...</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {filter === "Pending" ? "কোনো অপেক্ষমাণ আবেদন নেই।" : "কোনো তথ্য পাওয়া যায়নি।"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-[#0d2b3a] text-white">
                <tr>
                  <th className="px-4 py-3 text-left">নাম</th>
                  <th className="px-4 py-3 text-left">ইমেইল / ফোন</th>
                  <th className="px-4 py-3 text-left">বিভাগ / ওয়ার্ড</th>
                  <th className="px-4 py-3 text-left">উপজেলা / ইউনিয়ন</th>
                  <th className="px-4 py-3 text-left">আবেদনের তারিখ</th>
                  <th className="px-4 py-3 text-left">অবস্থা</th>
                  {filter === "Pending" && (
                    <th className="px-4 py-3 text-center">পদক্ষেপ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app) => (
                  <tr key={app._id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-medium text-gray-900">{app.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{app.email || "—"}</div>
                      {app.phone && <div className="text-xs text-gray-400">{app.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{app.division || "—"}</div>
                      <div className="text-xs text-gray-400">
                        ওয়ার্ড {app.wardNo || "—"}{app.ward ? ` (${app.ward})` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{app.upazila || "—"}</div>
                      <div className="text-xs text-gray-400">{app.unionName || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(app.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge[app.authorityStatus as FilterStatus] || "bg-gray-100 text-gray-600"}`}
                      >
                        {statusLabel[app.authorityStatus as FilterStatus] || app.authorityStatus}
                      </span>
                    </td>
                    {filter === "Pending" && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={actionLoading === app._id}
                            onClick={() => void handleApprove(app._id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md disabled:opacity-50 transition"
                          >
                            {actionLoading === app._id ? "..." : "অনুমোদন"}
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === app._id}
                            onClick={() => {
                              setRejectModal({ userId: app._id, name: app.name });
                              setRejectReason("");
                            }}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded-md disabled:opacity-50 transition"
                          >
                            প্রত্যাখ্যান
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            ← আগের পাতা
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {toBanglaDigits(page)} / {toBanglaDigits(totalPages)}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50"
          >
            পরের পাতা →
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">আবেদন প্রত্যাখ্যান</h2>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{rejectModal.name}</strong> এর আবেদন প্রত্যাখ্যান করতে চান?
              কারণ লিখুন (ঐচ্ছিক):
            </p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              rows={3}
              placeholder="প্রত্যাখ্যানের কারণ লিখুন..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={actionLoading === rejectModal.userId}
                onClick={() => void handleRejectConfirm()}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {actionLoading === rejectModal.userId ? "..." : "প্রত্যাখ্যান করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
