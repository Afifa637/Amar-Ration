import { useNavigate } from "react-router-dom";

const roleOptions = [
  {
    key: "distributor",
    label: "ডিস্ট্রিবিউটর / অ্যাডমিন লগইন",
    description: "ডিস্ট্রিবিউটর ও অ্যাডমিন উভয়ের জন্য একীভূত লগইন",
  },
] as const;

export default function Login() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-[#d7dde6] bg-white p-6 shadow-sm md:p-8">
        <div className="max-w-xl">
          <h1 className="text-2xl font-bold text-[#12344d]">
            আমার রেশন লগইন নির্বাচন
          </h1>
          <p className="mt-2 text-sm text-[#4b5563]">
            আপনার দায়িত্ব অনুযায়ী সঠিক লগইন স্ক্রিনে যেতে একটি অপশন বেছে নিন।
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-1">
          {roleOptions.map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() => navigate(`/login/${role.key}`)}
              className="rounded-2xl border border-[#d7dde6] bg-[#f8fafc] p-5 text-left transition hover:border-[#16679c] hover:bg-[#eef6fb]"
            >
              <div className="text-base font-semibold text-[#12344d]">
                {role.label}
              </div>
              <div className="mt-2 text-sm text-[#4b5563]">
                {role.description}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
