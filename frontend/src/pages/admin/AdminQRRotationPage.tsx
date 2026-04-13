import { useMemo, useState } from "react";
import Modal from "../../components/ui/Modal";
import {
  forceResetAllQRCodes,
  getConsumers,
  regenerateConsumerQR,
  type Consumer,
} from "../../services/api";

export default function AdminQRRotationPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Consumer[]>([]);
  const [selected, setSelected] = useState<Consumer | null>(null);
  const [newPayload, setNewPayload] = useState("");

  const nextRotationDate = useMemo(() => {
    const now = new Date();
    return new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
    ).toLocaleDateString("bn-BD");
  }, []);

  const onRotateAll = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await forceResetAllQRCodes();
      setMessage(
        `মোট ${data.total} জনের মধ্যে ${data.updated} জনের QR আপডেট হয়েছে। ${data.failed} টি ব্যর্থ হয়েছে।`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "রোটেশন ব্যর্থ");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  const onSearch = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getConsumers({ search, limit: 10 });
      setResults(data.consumers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "সার্চ ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  const onRegenerate = async () => {
    if (!selected) return;
    try {
      setLoading(true);
      setError("");
      const data = await regenerateConsumerQR(selected._id);
      setNewPayload(data.newQrPayload);
      setMessage("নতুন QR তৈরি হয়েছে");
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR তৈরি ব্যর্থ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">QR ব্যবস্থাপনা</h1>

      {(error || message) && (
        <div
          className={`rounded-xl px-4 py-3 text-sm border ${error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}
        >
          {error || message}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
          প্রতি মাসের ১ তারিখ রাত ১২টায় স্বয়ংক্রিয়ভাবে QR কোড পরিবর্তন হয়।
          <div className="mt-1">পরবর্তী রোটেশন: {nextRotationDate}</div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-3">Manual Rotation</h2>
        <button
          onClick={() => setConfirmOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2"
        >
          এখনই সব QR পরিবর্তন করুন
        </button>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
        <h2 className="font-semibold text-gray-800">
          Individual QR Regeneration
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 min-w-70"
            placeholder="consumer code বা নাম লিখুন"
          />
          <button
            onClick={() => void onSearch()}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
          >
            সার্চ
          </button>
        </div>

        {results.length > 0 && (
          <div className="border border-gray-100 rounded-xl">
            {results.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelected(c)}
                className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b border-gray-100 last:border-b-0"
              >
                {c.name} ({c.consumerCode})
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
            <div>
              <b>নাম:</b> {selected.name}
            </div>
            <div>
              <b>কোড:</b> {selected.consumerCode}
            </div>
            <div>
              <b>ওয়ার্ড:</b> {selected.ward || "—"}
            </div>
            <button
              onClick={() => void onRegenerate()}
              className="mt-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
            >
              নতুন QR তৈরি করুন
            </button>
          </div>
        )}

        {newPayload && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 break-all">
            নতুন QR payload: {newPayload}
          </div>
        )}

        {loading && <div className="text-sm text-gray-500">লোড হচ্ছে...</div>}
      </section>

      <Modal
        open={confirmOpen}
        title="রোটেশন নিশ্চিত করুন"
        onClose={() => setConfirmOpen(false)}
      >
        <p className="text-sm text-gray-700 mb-4">
          আপনি কি নিশ্চিত? সব ভোক্তার QR কোড বদলে যাবে।
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setConfirmOpen(false)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2"
          >
            বাতিল
          </button>
          <button
            onClick={() => void onRotateAll()}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-4 py-2"
          >
            নিশ্চিত করুন
          </button>
        </div>
      </Modal>
    </div>
  );
}
