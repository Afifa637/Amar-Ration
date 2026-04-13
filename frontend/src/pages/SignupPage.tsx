import { Navigate, useNavigate, useParams } from "react-router-dom";
import type { UserRole } from "../context/AuthContext";

const roleContent: Record<
  UserRole,
  { title: string; description: string; loginPath: string }
> = {
  "central-admin": {
    title: "কেন্দ্রীয় অ্যাডমিন অ্যাকাউন্ট",
    description:
      "অ্যাডমিন অ্যাকাউন্ট আগে থেকেই নিয়ন্ত্রিতভাবে তৈরি করা হয়। নতুন অ্যাডমিন স্বয়ংক্রিয়ভাবে নিবন্ধন করা যাবে না।",
    loginPath: "/login/central-admin",
  },
  distributor: {
    title: "ডিস্ট্রিবিউটর অ্যাকাউন্ট",
    description:
      "ডিস্ট্রিবিউটর অ্যাকাউন্ট প্রশাসনিক অনুমোদন, দায়িত্বসীমা এবং ওয়ার্ড যাচাইয়ের মাধ্যমে তৈরি করা হয়। আপনার লগইন তথ্য প্রশাসন থেকে সংগ্রহ করুন।",
    loginPath: "/login/distributor",
  },
  "field-distributor": {
    title: "ফিল্ড অপারেটর অ্যাকাউন্ট",
    description:
      "ফিল্ড অপারেটর অ্যাকাউন্টও প্রশাসনিকভাবে তৈরি করা হয়। দায়িত্বপ্রাপ্ত অ্যাকাউন্ট পেলে নিচের বাটন দিয়ে লগইন করুন।",
    loginPath: "/login/field-distributor",
  },
};

function isUserRole(value: string | undefined): value is UserRole {
  return (
    value === "central-admin" ||
    value === "distributor" ||
    value === "field-distributor"
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { role } = useParams<{ role: string }>();

  if (!isUserRole(role)) {
    return <Navigate to="/" replace />;
  }

  const content = roleContent[role];

  return (
    <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#d7dde6] bg-white p-8 shadow-sm">
        <div className="inline-flex rounded-full bg-[#e8f1fb] px-3 py-1 text-xs font-semibold text-[#16679c]">
          স্বয়ংক্রিয় নিবন্ধন বন্ধ
        </div>
        <h1 className="mt-4 text-2xl font-bold text-[#12344d]">
          {content.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#4b5563]">
          {content.description}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate(content.loginPath)}
            className="rounded-xl bg-[#16679c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#125a85]"
          >
            লগইন পেজে যান
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-xl border border-[#cfd6e0] px-5 py-2.5 text-sm font-semibold text-[#12344d] hover:bg-[#f8fafc]"
          >
            হোমে ফিরুন
          </button>
        </div>
      </div>
    </div>
  );
}
