import { useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext, type UserRole } from "../context/AuthContext";

const roleNames: Record<UserRole, string> = {
  "central-admin": "কেন্দ্রীয় অ্যাডমিন",
  distributor: "ডিস্ট্রিবিউটর",
  "field-distributor": "ফিল্ড ডিস্ট্রিবিউটর",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { role } = useParams<{ role: UserRole }>();
  const auth = useContext(AuthContext);

  const isAdminLogin = role === "central-admin";

  const [email, setEmail] = useState(
    isAdminLogin ? "admin@amar-ration.local" : "",
  );
  const [password, setPassword] = useState(isAdminLogin ? "admin123" : "");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("সব ক্ষেত্র পূরণ করুন");
      setIsLoading(false);
      return;
    }

    if (!role || !auth) {
      setError("Invalid role or auth context");
      setIsLoading(false);
      return;
    }

    try {
      const result = await auth.login(email, password, role as UserRole);

      if (result.success) {
        if (result.mustChangePassword) {
          navigate("/force-password-change");
          return;
        }
        if (role === "central-admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/dashboard");
        }
      } else if (result.reason === "pending-approval") {
        navigate("/pending-approval");
      } else if (result.reason === "authority-expired") {
        navigate("/pending-approval?code=AUTHORITY_EXPIRED");
      } else if (result.reason === "blocked") {
        setError(
          "আপনার অ্যাকাউন্টটি স্থগিত/বাতিল হয়েছে। অ্যাডমিনের সাথে যোগাযোগ করুন।",
        );
      } else {
        setError(result.message || "ইমেইল বা পাসওয়ার্ড ভুল");
      }
    } catch {
      setError("লগইন করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/image/bg-2.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-black/50"></div>

      <div className="relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 w-full max-w-md rounded-2xl shadow-2xl p-6">
        <div className="flex justify-center mb-3">
          <img
            src="/assets/image/app_logo.png"
            alt="আমার রেশন"
            style={{ width: "60px", height: "60px" }}
            className="object-contain"
          />
        </div>

        <h1 className="text-xl font-bold mb-1 text-center text-white">
          {roleNames[role as UserRole] || "লগইন"}
        </h1>
        <p className="text-sm text-white/80 text-center mb-4">
          {isAdminLogin
            ? "অ্যাডমিন প্যানেলে প্রবেশ করতে নির্ধারিত ক্রেডেনশিয়াল ব্যবহার করুন"
            : "আপনার অ্যাকাউন্টে লগইন করুন"}
        </p>

        {error && (
          <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-white block mb-1">
              ইমেইল
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-white block mb-1">
              পাসওয়ার্ড
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
              placeholder="পাসওয়ার্ড লিখুন"
            />
          </div>

          {isAdminLogin && (
            <div className="rounded-lg border border-white/20 bg-white/10 p-3 text-sm text-white/90">
              <div>
                Fixed admin email:{" "}
                <span className="font-semibold">admin@amar-ration.local</span>
              </div>
              <div>
                Fixed admin password:{" "}
                <span className="font-semibold">admin123</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center">
              <input type="checkbox" className="mr-2" />
              <span className="text-white/90">মনে রাখো</span>
            </label>
            <a href="#" className="text-white hover:underline">
              পাসওয়ার্ড ভুলে গেছেন?
            </a>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-white/90 backdrop-blur-sm text-[#16679c] py-2.5 rounded-lg hover:bg-white transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "লগইন হচ্ছে..." : "সাইন ইন"}
          </button>
        </form>

        {role !== "central-admin" && (
          <div className="mt-4 text-center text-sm text-white/90 border border-white/20 rounded-lg p-2 bg-white/10">
            ডিস্ট্রিবিউটর/ফিল্ড ইউজার অ্যাকাউন্ট শুধুমাত্র অ্যাডমিন ইস্যু করে।
          </div>
        )}

        <div className="mt-3 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-white/70 hover:text-white"
          >
            ← হোমে ফিরে যান
          </button>
        </div>
      </div>
    </div>
  );
}
