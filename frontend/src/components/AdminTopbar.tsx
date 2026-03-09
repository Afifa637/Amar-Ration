import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function AdminTopbar() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    auth?.logout();
    navigate("/");
  };

  return (
    <header className="h-22 bg-[#1f77b4] text-white">
      <div className="h-13 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-white/15 flex items-center justify-center text-sm font-bold">
            OMS
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-[15px]">
              স্মার্ট OMS রেশন ডিস্ট্রিবিউশন সিস্টেম
            </div>
            <div className="text-[12px] opacity-90">অ্যাডমিন কন্ট্রোল প্যানেল</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block text-[12px] opacity-90 text-right">
            <div>
              ব্যবহারকারী:{" "}
              <span className="font-semibold">{auth?.user?.name || "অ্যাডমিন"}</span>
            </div>
            <div className="mt-1">
              <span className="text-[11px] bg-white/15 px-2 py-0.5 rounded">
                কেন্দ্রীয় প্রশাসক
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/15 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded"
          >
            লগআউট
          </button>
        </div>
      </div>

      <div className="h-9 bg-[#16679c] px-4 flex items-center text-[13px] gap-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button onClick={() => navigate("/admin/dashboard")} className="hover:underline">
            ড্যাশবোর্ড
          </button>
          <button onClick={() => navigate("/admin/distributors")} className="hover:underline">
            ডিস্ট্রিবিউটর
          </button>
          <button onClick={() => navigate("/admin/consumers")} className="hover:underline">
            কনজিউমার
          </button>
          <button onClick={() => navigate("/admin/audit")} className="hover:underline">
            অডিট
          </button>
          <button onClick={() => navigate("/admin/reports")} className="hover:underline">
            রিপোর্ট
          </button>
          <button onClick={() => navigate("/admin/settings")} className="hover:underline">
            সেটিংস
          </button>
        </div>
      </div>
    </header>
  );
}