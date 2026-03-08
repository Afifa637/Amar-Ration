import { useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext, UserRole } from "../context/AuthContext";
import api from "../services/api";

// Map frontend roles to backend userTypes
const roleToUserType: Record<UserRole, string> = {
  "central-admin": "Admin",
  "distributor": "Distributor",
  "field-distributor": "FieldUser",
};

const roleNames: Record<UserRole, string> = {
  "central-admin": "কেন্দ্রীয় অ্যাডমিন",
  "distributor": "ডিস্ট্রিবিউটর",
  "field-distributor": "ফিল্ড ডিস্ট্রিবিউটর",
};

export default function SignupPage() {
  const navigate = useNavigate();
  const { role } = useParams<{ role: UserRole }>();
  const auth = useContext(AuthContext);

  // Admin signup is not allowed — admin is preset
  if (role === "central-admin") {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
        style={{ backgroundImage: "url('/assets/image/bg-2.jpg')" }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 w-full max-w-md rounded-2xl shadow-2xl p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-2">অ্যাডমিন সাইনআপ উপলব্ধ নেই</h2>
          <p className="text-white/80 mb-6">অ্যাডমিন অ্যাকাউন্ট পূর্বনির্ধারিত। দয়া করে লগইন করুন।</p>
          <button
            onClick={() => navigate("/login/central-admin")}
            className="bg-[#16679c] text-white px-6 py-2.5 rounded-lg hover:bg-[#125a85] font-semibold"
          >
            লগইন পেজে যান
          </button>
        </div>
      </div>
    );
  }
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    wardNo: "",
    officeAddress: "",
    division: "",
    district: "",
    upazila: "",
    unionName: "",
    ward: "",
    nidLast4: "",
    category: "A",
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

    if ((role === "distributor" || role === "field-distributor") && 
        (!formData.division || !formData.district || !formData.upazila)) {
      setError("বিভাগ, জেলা এবং উপজেলা আবশ্যক");
      setLoading(false);
      return;
    }

    try {
      // Map frontend role to backend userType
      const userType = roleToUserType[role as UserRole];
      
      // Prepare signup data
      const signupData: any = {
        userType,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      };

      // Add role-specific fields
      if (role === "distributor") {
        signupData.wardNo = formData.wardNo;
        signupData.officeAddress = formData.officeAddress;
        signupData.division = formData.division;
        signupData.district = formData.district;
        signupData.upazila = formData.upazila;
        signupData.unionName = formData.unionName;
        signupData.ward = formData.ward;
      } else if (role === "field-distributor") {
        signupData.wardNo = formData.wardNo;
        signupData.division = formData.division;
        signupData.district = formData.district;
        signupData.upazila = formData.upazila;
        signupData.unionName = formData.unionName;
        signupData.ward = formData.ward;
      } else if (role === "central-admin") {
        // Admin might create consumer accounts
        if (formData.nidLast4) {
          signupData.nidLast4 = formData.nidLast4;
          signupData.category = formData.category;
        }
      }

      // Call backend API
      const response = await api.post("/auth/signup", signupData);
      
      if (response.data.success) {
        console.log("Signup successful:", response.data);
        
        // Store token
        const { token, user } = response.data.data;
        localStorage.setItem("amar_ration_auth", JSON.stringify({ token, user }));
        
        // Auto-login after successful signup
        if (auth) {
          // Update auth context with user data
          const loginSuccess = await auth.login(formData.email, formData.password, role as UserRole);
          if (loginSuccess) {
            setSuccess(true);
            // Redirect to dashboard after showing success message
            setTimeout(() => {
              navigate("/dashboard");
            }, 1500);
          } else {
            setSuccess(true);
            setTimeout(() => {
              navigate(`/login/${role}`);
            }, 1500);
          }
        }
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      const errorMessage = err.response?.data?.message || "সাইনআপে সমস্যা হয়েছে। আবার চেষ্টা করুন";
      setError(errorMessage);
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
                <input
                  type="text"
                  name="wardNo"
                  value={formData.wardNo}
                  onChange={handleChange}
                  className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                  placeholder="ওয়ার্ড নম্বর লিখুন"
                />
              </div>
            )}

            {/* Division - For Distributor and Field Distributor */}
            {(role === "distributor" || role === "field-distributor") && (
              <div>
                <label className="text-sm font-medium text-white block mb-1">
                  বিভাগ <span className="text-red-400">*</span>
                </label>
                <select
                  name="division"
                  value={formData.division}
                  onChange={handleChange}
                  className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                >
                  <option value="" className="bg-[#16679c] text-white">নির্বাচন করুন</option>
                  <option value="Dhaka" className="bg-[#16679c] text-white">ঢাকা</option>
                  <option value="Chittagong" className="bg-[#16679c] text-white">চট্টগ্রাম</option>
                  <option value="Rajshahi" className="bg-[#16679c] text-white">রাজশাহী</option>
                  <option value="Khulna" className="bg-[#16679c] text-white">খুলনা</option>
                  <option value="Barisal" className="bg-[#16679c] text-white">বরিশাল</option>
                  <option value="Sylhet" className="bg-[#16679c] text-white">সিলেট</option>
                  <option value="Rangpur" className="bg-[#16679c] text-white">রংপুর</option>
                  <option value="Mymensingh" className="bg-[#16679c] text-white">ময়মনসিংহ</option>
                </select>
              </div>
            )}

            {/* District - For Distributor and Field Distributor */}
            {(role === "distributor" || role === "field-distributor") && (
              <div>
                <label className="text-sm font-medium text-white block mb-1">
                  জেলা <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                  placeholder="জেলা লিখুন"
                />
              </div>
            )}

            {/* Upazila - For Distributor and Field Distributor */}
            {(role === "distributor" || role === "field-distributor") && (
              <div>
                <label className="text-sm font-medium text-white block mb-1">
                  উপজেলা <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="upazila"
                  value={formData.upazila}
                  onChange={handleChange}
                  className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                  placeholder="উপজেলা লিখুন"
                />
              </div>
            )}

            {/* Union Name - For Distributor and Field Distributor */}
            {(role === "distributor" || role === "field-distributor") && (
              <div>
                <label className="text-sm font-medium text-white block mb-1">
                  ইউনিয়ন
                </label>
                <input
                  type="text"
                  name="unionName"
                  value={formData.unionName}
                  onChange={handleChange}
                  className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                  placeholder="ইউনিয়ন নাম লিখুন"
                />
              </div>
            )}



            {/* NID Last 4 Digits - For Central Admin (Consumer data entry) */}
            {role === "central-admin" && (
              <div>
                <label className="text-sm font-medium text-white block mb-1">
                  এনআইডি শেষ ৪ সংখ্যা
                </label>
                <input
                  type="text"
                  name="nidLast4"
                  value={formData.nidLast4}
                  onChange={handleChange}
                  maxLength={4}
                  className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/60 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                  placeholder="শেষ ৪ ডিজিট"
                />
              </div>
            )}

            {/* Category - For Central Admin (Consumer data entry) */}
            {role === "central-admin" && (
              <div>
                <label className="text-sm font-medium text-white block mb-1">
                  ক্যাটাগরি
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50 text-sm"
                >
                  <option value="A" className="bg-[#16679c] text-white">ক্যাটাগরি A</option>
                  <option value="B" className="bg-[#16679c] text-white">ক্যাটাগরি B</option>
                  <option value="C" className="bg-[#16679c] text-white">ক্যাটাগরি C</option>
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
