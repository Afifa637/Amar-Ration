import { useMemo, useRef, useState } from "react";
import Modal from "../../components/ui/Modal";
import { bulkRegisterTemplate, bulkRegisterUpload } from "../../services/api";

interface BulkErrorRow {
  row: number;
  name: string;
  nid: string;
  reason: string;
}

interface BulkResult {
  dryRun: boolean;
  total: number;
  inserted: number;
  skipped: number;
  errors: BulkErrorRow[];
}

export default function AdminBulkRegisterPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [page, setPage] = useState(1);
  const [showConfirm, setShowConfirm] = useState(false);

  const perPage = 10;
  const totalPages = Math.max(
    1,
    Math.ceil((result?.errors?.length || 0) / perPage),
  );

  const pagedErrors = useMemo(() => {
    if (!result?.errors) return [];
    const start = (page - 1) * perPage;
    return result.errors.slice(start, start + perPage);
  }, [result, page]);

  const onTemplate = async () => {
    const blob = await bulkRegisterTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-register-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doUpload = async (forceDryRun?: boolean) => {
    if (!file) {
      setError("CSV ফাইল নির্বাচন করুন");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");
      const data = await bulkRegisterUpload(file, forceDryRun ?? dryRun);
      setResult(data);
      setPage(1);
      if (data.dryRun) {
        const validRows = Math.max(0, data.total - data.errors.length);
        setMessage(
          `যাচাই সম্পন্ন। ${validRows} টি বৈধ সারি পাওয়া গেছে, কিন্তু কোনো ডেটা সংরক্ষণ করা হয়নি।`,
        );
      } else if (data.inserted > 0) {
        setMessage(`${data.inserted} জন ভোক্তা সফলভাবে নিবন্ধিত হয়েছেন।`);
      } else {
        setMessage("কোনো নতুন রেকর্ড সংরক্ষণ করা হয়নি।");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "আপলোড ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">বাল্ক নিবন্ধন</h1>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}
      {message && (
        <div className="border border-green-200 bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">CSV আপলোড</h2>

        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-purple-300 rounded-xl p-8 text-center cursor-pointer bg-purple-50/40"
        >
          <p className="text-gray-700 font-medium">
            CSV ফাইল টেনে আনুন বা ক্লিক করুন
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {file ? file.name : "কোনো ফাইল নির্বাচন করা হয়নি"}
          </p>
          <p className="text-xs text-gray-500 mt-2 text-left">
            প্রয়োজনীয় কলামসমূহ: name, nidNumber, fatherNidNumber,{" "}
            <strong>motherNidNumber</strong>, phone, wardNumber, unionName,
            upazila, district, <strong>division</strong>, category, memberCount,
            guardianName
          </p>
          <p className="text-xs text-red-400 mt-1">
            ⚠ motherNidNumber এবং division কলাম বাদ দিলে আপলোড ব্যর্থ হবে।
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <button
            onClick={() => void onTemplate()}
            className="bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            নমুনা CSV ডাউনলোড করুন
          </button>

          <label className="hidden items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            শুধু যাচাই করুন (Dry Run)
          </label>
        </div>

        {loading && (
          <div className="mt-4">
            <div className="h-2 rounded-full bg-purple-100 overflow-hidden">
              <div className="h-full w-1/2 bg-purple-500 animate-pulse" />
            </div>
            <div className="text-sm text-gray-500 mt-2">লোড হচ্ছে...</div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => void doUpload(true)}
            disabled={loading}
            className="bg-white border border-purple-300 text-purple-700 rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
          >
            আগে যাচাই করুন
          </button>
          <button
            onClick={() => void doUpload(false)}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
          >
            আসল নিবন্ধন সংরক্ষণ করুন
          </button>
        </div>
      </section>

      {result && (
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Results</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl p-3 bg-gray-100">
              <div className="text-xs text-gray-600">মোট রেকর্ড</div>
              <div className="text-xl font-bold text-gray-800">
                {result.total}
              </div>
            </div>
            <div className="rounded-xl p-3 bg-green-100">
              <div className="text-xs text-green-700">সফল নিবন্ধন</div>
              <div className="text-xl font-bold text-green-800">
                {result.inserted}
              </div>
            </div>
            <div className="rounded-xl p-3 bg-yellow-100">
              <div className="text-xs text-yellow-700">এড়িয়ে যাওয়া</div>
              <div className="text-xl font-bold text-yellow-800">
                {result.skipped}
              </div>
            </div>
            <div className="rounded-xl p-3 bg-red-100">
              <div className="text-xs text-red-700">ত্রুটি</div>
              <div className="text-xl font-bold text-red-800">
                {result.errors.length}
              </div>
            </div>
          </div>

          {result.dryRun && (
            <div className="border border-yellow-300 bg-yellow-50 rounded-xl p-4 text-sm text-yellow-800">
              এটি শুধু পরীক্ষা ছিল। আসল নিবন্ধনের জন্য Dry Run বন্ধ করুন।
              <button
                className="ml-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-3 py-1.5"
                onClick={() => setShowConfirm(true)}
              >
                এখন আসল নিবন্ধন করুন
              </button>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      সারি
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      নাম
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      NID
                    </th>
                    <th className="text-xs uppercase text-gray-500 p-2 text-left">
                      কারণ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedErrors.map((row, idx) => (
                    <tr
                      key={`${row.row}-${idx}`}
                      className="border-t border-gray-100"
                    >
                      <td className="p-2 text-sm">{row.row}</td>
                      <td className="p-2 text-sm">{row.name}</td>
                      <td className="p-2 text-sm">{row.nid}</td>
                      <td className="p-2 text-sm text-red-700">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
                <span>
                  মোট {result.errors.length} টি ফলাফল | পৃষ্ঠা {page}/
                  {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
                  >
                    পূর্বের
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-50"
                  >
                    পরের
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <Modal
        open={showConfirm}
        title="আসল নিবন্ধন নিশ্চিতকরণ"
        onClose={() => setShowConfirm(false)}
      >
        <p className="text-sm text-gray-700 mb-4">
          আপনি কি Dry Run বন্ধ করে আসল নিবন্ধন করতে চান?
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowConfirm(false)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2"
          >
            বাতিল
          </button>
          <button
            onClick={() => {
              setShowConfirm(false);
              void doUpload(false);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2"
          >
            নিশ্চিত করুন
          </button>
        </div>
      </Modal>
    </div>
  );
}
