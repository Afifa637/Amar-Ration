import { useNavigate } from "react-router-dom";

// Legacy login stub - the app uses LoginPage.tsx instead.
const Login = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-2 text-center">আমার রেশন লগইন</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          ড্যাশবোর্ডে প্রবেশ করতে লগইন করুন
        </p>

        <label className="text-sm font-medium text-gray-700">ইমেইল</label>
        <input
          className="mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="আপনার ইমেইল"
        />

        <label className="text-sm font-medium text-gray-700 mt-4 block">পাসওয়ার্ড</label>
        <input
          type="password"
          className="mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          placeholder="আপনার নাম"
        />

        <button
          onClick={handleLogin}
          className="mt-4 w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
        >
          লগইন করুন
        </button>
      </div>
    </div>
  );
};

export default Login;
