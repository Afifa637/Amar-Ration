import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [name, setName] = useState("অতিথি");

  const handleLogin = () => {
    auth?.login(name);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow p-6">
        <h1 className="text-2xl font-bold mb-2 text-center">স্মার্ট OMS লগইন</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          ড্যাশবোর্ডে প্রবেশ করতে নাম দিয়ে লগইন করুন
        </p>

        <label className="text-sm font-medium text-gray-700">নাম</label>
        <input
          className="mt-1 w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
