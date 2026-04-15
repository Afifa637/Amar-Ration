import { useState } from "react";
import { submitComplaint } from "../services/api";

export default function ComplaintSubmitPage() {
  const [form, setForm] = useState({
    consumerPhone: "",
    category: "weight_mismatch",
    description: "",
    consumerCode: "",
    tokenCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await submitComplaint({
        consumerPhone: form.consumerPhone,
        category: form.category,
        description: form.description,
        consumerCode: form.consumerCode || undefined,
        tokenCode: form.tokenCode || undefined,
      });
      setSuccess("আপনার অভিযোগ জমা হয়েছে। দ্রুত সমাধানের চেষ্টা করা হবে।");
      setForm({
        consumerPhone: "",
        category: "weight_mismatch",
        description: "",
        consumerCode: "",
        tokenCode: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "অভিযোগ জমা ব্যর্থ হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-purple-50/40 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-purple-100 p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">অভিযোগ জমা</h1>
        <p className="text-sm text-gray-600 mb-6">
          রেশন বিতরণ সংক্রান্ত অভিযোগ এখানে জমা দিন।
        </p>

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
              placeholder="মোবাইল নম্বর (আবশ্যক)"
              value={form.consumerPhone}
              onChange={(e) =>
                setForm((p) => ({ ...p, consumerPhone: e.target.value }))
              }
              required
            />
            <select
              className="border border-gray-200 rounded-lg px-3 py-2"
              value={form.category}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value }))
              }
              required
            >
              <option value="weight_mismatch">ওজন গরমিল</option>
              <option value="missing_ration">রেশন কম/নেই</option>
              <option value="wrong_amount">ভুল পরিমাণ</option>
              <option value="distributor_behavior">বিতরণকারীর আচরণ</option>
              <option value="registration_issue">নিবন্ধন সমস্যা</option>
              <option value="other">অন্যান্য</option>
            </select>
            <input
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="ভোক্তা কোড (ঐচ্ছিক)"
              value={form.consumerCode}
              onChange={(e) =>
                setForm((p) => ({ ...p, consumerCode: e.target.value }))
              }
            />
            <input
              className="border border-gray-200 rounded-lg px-3 py-2"
              placeholder="টোকেন কোড (ঐচ্ছিক)"
              value={form.tokenCode}
              onChange={(e) =>
                setForm((p) => ({ ...p, tokenCode: e.target.value }))
              }
            />
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            টিপস: কনজিউমার কোড এবং/অথবা টোকেন কোড দিলে সিস্টেম স্বয়ংক্রিয়ভাবে
            Division, Ward, Session, Distributor কনটেক্সট বের করবে।
          </div>

          <textarea
            className="w-full border border-gray-200 rounded-lg px-3 py-2 min-h-35"
            placeholder="সমস্যার বিস্তারিত লিখুন"
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            required
          />

          <button
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg px-5 py-2"
          >
            {loading ? "জমা হচ্ছে..." : "অভিযোগ জমা দিন"}
          </button>
        </form>
      </div>
    </div>
  );
}
