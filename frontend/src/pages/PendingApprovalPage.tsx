import { useSearchParams } from "react-router-dom";

export default function PendingApprovalPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const isAuthorityExpired = code === "AUTHORITY_EXPIRED";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f8fafc]">
      <div className="bg-white border border-[#e5e7eb] rounded-2xl shadow-lg p-8 max-w-xl text-center">
        <div className="text-6xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold text-[#1f2937] mb-2">
          {isAuthorityExpired
            ? "কর্তৃত্বের মেয়াদ শেষ হয়েছে"
            : "অ্যাডমিন অনুমোদনের অপেক্ষায়"}
        </h1>
        <p className="text-[#4b5563] mb-4">
          {isAuthorityExpired
            ? "আপনার বিতরণ কর্তৃত্বের মেয়াদ শেষ হয়েছে। নবায়নের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।"
            : "আপনার ডিস্ট্রিবিউটর অ্যাকাউন্টটি এখনো অনুমোদন করা হয়নি। অনুমোদন সম্পন্ন হলে আপনি পূর্ণ ড্যাশবোর্ডে প্রবেশ করতে পারবেন।"}
        </p>
        <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3 text-sm text-[#6b7280]">
          যদি দীর্ঘ সময় অনুমোদন না আসে, অ্যাডমিনের সাথে যোগাযোগ করুন।
        </div>
      </div>
    </div>
  );
}
