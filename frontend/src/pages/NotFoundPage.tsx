import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[#d7dde6] bg-white p-8 text-center shadow-sm">
        <div className="text-5xl mb-3">404</div>
        <h1 className="text-2xl font-bold text-[#12344d]">
          পৃষ্ঠা পাওয়া যায়নি
        </h1>
        <p className="mt-2 text-sm text-[#4b5563]">
          আপনি যে রুটে যেতে চেয়েছেন সেটি নেই বা স্থানান্তর করা হয়েছে।
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-xl bg-[#16679c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#125a85]"
          >
            হোমে ফিরুন
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-xl border border-[#cfd6e0] px-5 py-2.5 text-sm font-semibold text-[#12344d] hover:bg-[#f8fafc]"
          >
            পেছনে যান
          </button>
        </div>
      </div>
    </div>
  );
}
