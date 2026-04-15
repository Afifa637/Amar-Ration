import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { submitAppeal } from "../services/api";

export default function AppealSubmitPage() {
  const { isAuthenticated, user } = useAuth();
  const [form, setForm] = useState({
    consumerCode: "",
    consumerPhone: "",
    reason: "",
    supportingInfo: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || user?.role !== "distributor") {
      setError("ডিস্ট্রিবিউটর লগইন ছাড়া আপিল জমা দেওয়া যাবে না");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await submitAppeal({
        consumerCode: form.consumerCode,
        consumerPhone: form.consumerPhone,
        reason: form.reason,
        supportingInfo: form.supportingInfo,
        attachments: files,
      });
      setSuccess("আপিল জমা হয়েছে। যাচাই শেষে আপনাকে জানানো হবে।");
      setForm({
        consumerCode: "",
        consumerPhone: "",
        reason: "",
        supportingInfo: "",
      });
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "আপিল জমা ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    const acceptedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const invalid = selected.find((file) => !acceptedTypes.includes(file.type));
    if (invalid) {
      setError("শুধু PDF, DOC, DOCX ফাইল আপলোড করা যাবে");
      event.target.value = "";
      return;
    }

    if (selected.some((file) => file.size > 5 * 1024 * 1024)) {
      setError("প্রতি ফাইল সর্বোচ্চ 5MB হতে হবে");
      event.target.value = "";
      return;
    }

    if (selected.length > 5) {
      setError("সর্বোচ্চ ৫টি ফাইল আপলোড করা যাবে");
      event.target.value = "";
      return;
    }

    setError("");
    setFiles(selected);
  };

  return (
    <div className="min-h-screen bg-purple-50/40 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-purple-100 p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">আপিল জমা</h1>
        <p className="text-sm text-gray-600 mb-6">
          কালো তালিকাভুক্ত ভোক্তার আপিল এখন ডিস্ট্রিবিউটর লগইন থেকে জমা হবে।
        </p>

        {!isAuthenticated || user?.role !== "distributor" ? (
          <div className="mb-4 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded-xl px-4 py-3 text-sm">
            আপিল জমা দিতে ডিস্ট্রিবিউটর হিসেবে লগইন করুন।{" "}
            <Link to="/login/distributor" className="underline font-semibold">
              লগইন পেইজে যান
            </Link>
          </div>
        ) : null}

        {success && (
          <div className="mb-4 border border-green-200 bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="ভোক্তা কোড (যেমন C0001)"
              value={form.consumerCode}
              onChange={(e) =>
                setForm((p) => ({ ...p, consumerCode: e.target.value }))
              }
              required
            />
            <input
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="মোবাইল নম্বর"
              value={form.consumerPhone}
              onChange={(e) =>
                setForm((p) => ({ ...p, consumerPhone: e.target.value }))
              }
              required
            />
          </div>

          <input
            className="w-full border border-gray-200 rounded-lg px-3 py-2"
            placeholder="আপিলের কারণ (সংক্ষিপ্ত)"
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            required
          />
          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 min-h-35"
            placeholder="সহায়ক তথ্য (ঐচ্ছিক)"
            value={form.supportingInfo}
            onChange={(e) =>
              setForm((p) => ({ ...p, supportingInfo: e.target.value }))
            }
          />

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              প্রমাণপত্র (PDF/DOC/DOCX, সর্বোচ্চ ৫টি)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={onFileChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            {files.length > 0 && (
              <div className="text-xs text-gray-600">
                নির্বাচিত ফাইল: {files.map((file) => file.name).join(", ")}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={
              loading || !isAuthenticated || user?.role !== "distributor"
            }
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg px-5 py-2"
          >
            {loading ? "জমা হচ্ছে..." : "আপিল জমা দিন"}
          </button>
        </form>
      </div>
    </div>
  );
}
