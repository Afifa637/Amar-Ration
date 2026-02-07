import { useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext, UserRole } from "../context/AuthContext";

const roleNames: Record<UserRole, string> = {
  "central-admin": "কেন্দ্রীয় অ্যাডমিন",
  "distributor": "ডিস্ট্রিবিউটর",
  "field-distributor": "ফিল্ড ডিস্ট্রিবিউটর",
};

export default function SignupPage() {
  const navigate = useNavigate();
  const { role } = useParams<{ role: UserRole }>();
  const auth = useContext(AuthContext);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    wardNo: "",
    officeAddress: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      setError("সব আবশ্যক ক্ষেত্র পূরণ করুন");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("পাসওয়ার্ड কমপক্ষে ৬ অক্ষরের হতে হবে");
      setLoading(false);
      return;
    }

    // Role-specific validation
    if ((role === "distributor" || role === "field-distributor") && !formData.wardNo) {
      setError("ওয়ার্ড নম্বর আবশ্যক");
      setLoading(false);
      return;
    }

    if (role === "distributor" && !formData.officeAddress) {
      setError("অফিস ঠিকানা আবশ্যক");
      setLoading(false);
      return;
    }

    try {
      // In production, this would call a registration API
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Demo signup - save user data (in production, this would be handled by backend)
      console.log("Signup successful:", { role, ...formData });
      
      // Auto-login after successful signup
      if (auth) {
        const loginSuccess = await auth.login(formData.email, formData.password, role as UserRole);
        if (loginSuccess) {
          setSuccess(true);
          // Redirect to dashboard after showing success message
          setTimeout(() => {
            navigate("/dashboard");
          }, 1500);
        } else {
          setError("সাইনআপ সফল, কিন্তু লগইন ব্যর্থ হয়েছে");
          setLoading(false);
        }
      }
    } catch (err) {
      setError("সাইনআপে সমস্যা হয়েছে। আবার চেষ্টা করুন");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
        style={{
          backgroundImage: "url('/assets/image/bg-2.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 w-full max-w-md rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            সাইনআপ সফল হয়েছে!
          </h2>
          <p className="text-white/80">ড্যাশবোর্ডে রিডাইরেক্ট করা হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: "url('/assets/image/bg-2.jpg')",
      }}
    >
      <div className="absolute inset-0 bg-black/50"></div>

      <div className="relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 w-full max-w-4xl rounded-2xl shadow-2xl p-6 my-6 max-h-[95vh] overflow-y-auto">
        {/* Logo */}
        <div className="flex justify-center mb-3">
          <img
            src="/assets/image/app_logo.png"
            alt="আমার রেশন"
            style={{ width: "60px", height: "60px" }}
            className="object-contain"
          />
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold mb-1 text-center text-white">
          {roleNames[role as UserRole]} - নিবন্ধন
        </h1>
        <p className="text-sm text-white/80 text-center mb-4">
          নতুন অ্যাকাউন্ট তৈরি করুন
        </p>

        {/* Error message */}
        {error && (
          <div className="mb-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-white block mb-1">
                পুরো নাম <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                placeholder="আপনার নাম লিখুন"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium text-white block mb-1">
                ইমেইল <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                placeholder="example@email.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-sm font-medium text-white block mb-1">
                ফোন নম্বর <span className="text-red-400">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                placeholder="০১XXXXXXXXX"
              />
            </div>

            {/* Ward Number - For Distributor and Field Distributor */}
            {(role === "distributor" || role === "field-distributor") && (
              <div>
                <label className="text-sm font-medium text-white block mb-1">
                  ওয়ার্ড নম্বর <span className="text-red-400">*</span>
                </label>
                <select
                  name="wardNo"
                  value={formData.wardNo}
                  onChange={handleChange}
                  className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                >
                  <option value="" className="bg-[#16679c] text-white">নির্বাচন করুন</option>
                  <option value="01" className="bg-[#16679c] text-white">ওয়ার্ড-০১</option>
                  <option value="02" className="bg-[#16679c] text-white">ওয়ার্ড-০২</option>
                  <option value="03" className="bg-[#16679c] text-white">ওয়ার্ড-০৩</option>
                  <option value="04" className="bg-[#16679c] text-white">ওয়ার্ড-০৪</option>
                  <option value="05" className="bg-[#16679c] text-white">ওয়ার্ড-০৫</option>
                </select>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-white block mb-1">
                পাসওয়ার্ড <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                placeholder="পাসওয়ার্ড লিখুন"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-sm font-medium text-white block mb-1">
                পাসওয়ার্ড নিশ্চিত করুন <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                placeholder="পাসওয়ার্ড পুনরায় লিখুন"
              />
            </div>
          </div>

          {/* Office Address - Only for Distributor */}
          {role === "distributor" && (
            <div>
              <label className="text-sm font-medium text-white block mb-1">
                অফিস ঠিকানা <span className="text-red-400">*</span>
              </label>
              <textarea
                name="officeAddress"
                value={formData.officeAddress}
                onChange={handleChange}
                rows={2}
                className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 resize-none text-sm"
                placeholder="সম্পূর্ণ অফিস ঠিকানা লিখুন"
              />
            </div>
          )}

          {/* Terms and Conditions */}
          <div className="flex items-start">
            <input type="checkbox" className="mt-1 mr-2" required />
            <label className="text-sm text-white/90">
              আমি{" "}
              <a href="#" className="text-white hover:underline">
                শর্তাবলী
              </a>{" "}
              এবং{" "}
              <a href="#" className="text-white hover:underline">
                গোপনীয়তা নীতি
              </a>{" "}
              সম্মত
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-[#16679c] text-white py-2.5 rounded-lg hover:bg-[#125a85] transition-colors font-semibold"
          >
            নিবন্ধন করুন
          </button>
        </form>

        {/* Login Link */}
        <div className="mt-4 text-center text-sm text-white/90">
          ইতিমধ্যে অ্যাকাউন্ট আছে?{" "}
          <button
            onClick={() => navigate(`/login/${role}`)}
            className="text-white hover:underline font-semibold"
          >
            লগইন করুন
          </button>
        </div>

        {/* Back to entrance */}
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
