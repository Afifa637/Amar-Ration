import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeMyPassword } from "../../services/api";
import { useAuth } from "../../context/useAuth";

export default function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const { user, logout, updateSession } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("সব ফিল্ড পূরণ করুন");
      return;
    }
    if (newPassword.length < 8) {
      setError("নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("নতুন পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড এক নয়");
      return;
    }

    try {
      setLoading(true);
      const result = await changeMyPassword({ currentPassword, newPassword });

      updateSession({
        token: result.token,
        userPatch: { mustChangePassword: false },
      });

      if (user?.role === "central-admin") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "পাসওয়ার্ড পরিবর্তন ব্যর্থ",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f5] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-[#d7dde6] rounded-xl shadow-sm p-5">
        <h1 className="text-lg font-bold text-[#1f2d3d]">
          পাসওয়ার্ড পরিবর্তন আবশ্যক
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-1 mb-4">
          নিরাপত্তার জন্য নতুন পাসওয়ার্ড সেট করুন।
        </p>

        <div className="mb-3 rounded border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-[12px] text-[#1e3a8a]">
          <div>
            আপনার লগইন ইমেইল: <b>{user?.email || "—"}</b>
          </div>
          <div className="mt-1">
            এই পাসওয়ার্ড পরিবর্তন করলে আপনার যোগাযোগের ইমেইলে একটি নিশ্চিতকরণ
            পাঠানো হবে।
          </div>
        </div>

        {error && (
          <div className="mb-3 text-[12px] bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] px-3 py-2 rounded">
            {error}
          </div>
        )}

        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            type="password"
            placeholder="বর্তমান পাসওয়ার্ড"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
          />
          <input
            type="password"
            placeholder="নতুন পাসওয়ার্ড (min 8)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
          />
          <input
            type="password"
            placeholder="নতুন পাসওয়ার্ড নিশ্চিত করুন"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full border border-[#cfd6e0] rounded px-3 py-2 text-[13px]"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-2 rounded bg-[#16679c] text-white text-[13px] hover:bg-[#0f557f] disabled:opacity-60"
          >
            {loading ? "আপডেট হচ্ছে..." : "পাসওয়ার্ড আপডেট করুন"}
          </button>
        </form>

        <button
          type="button"
          onClick={logout}
          className="mt-3 w-full px-3 py-2 rounded border border-[#d1d5db] text-[13px] text-[#374151]"
        >
          লগআউট
        </button>
      </div>
    </div>
  );
}
