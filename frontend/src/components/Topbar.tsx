import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";

export default function Topbar({
  onMenuToggle,
}: {
  onMenuToggle?: () => void;
}) {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    if (auth) {
      auth.logout();
      navigate("/");
    }
  };

  return (
    <header className="h-16 bg-[#1f77b4] text-white">
      <div className="h-full flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden h-9 w-9 rounded bg-white/15 hover:bg-white/20 text-lg"
            aria-label="মেনু"
          >
            ☰
          </button>
          <img
            src="/assets/image/app_logo.png"
            alt="আমার রেশন"
            className="h-9 w-9 rounded object-contain bg-white"
          />
          <div className="leading-tight">
            <div className="font-semibold text-[15px]">আমার রেশন</div>
            <div className="text-[12px] opacity-90">
              ডিস্ট্রিবিউটর ড্যাশবোর্ড
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="hidden md:block text-[12px] opacity-90 hover:opacity-100"
            title="অ্যাকাউন্ট সেটিংস"
          >
            ব্যবহারকারী:{" "}
            <span className="font-semibold">{auth?.user?.name || "অতিথি"}</span>
            {auth?.user?.role && (
              <span className="ml-2 text-[11px] bg-white/15 px-2 py-0.5 rounded">
                {auth.user.role === "central-admin" && "কেন্দ্রীয় প্রশাসক"}
                {auth.user.role === "distributor" && "ডিস্ট্রিবিউটর"}
              </span>
            )}
          </button>
          <NotificationBell />
          <button
            onClick={handleLogout}
            className="bg-white/15 hover:bg-white/20 text-white text-sm px-3 py-1.5 rounded"
          >
            লগআউট
          </button>
        </div>
      </div>
    </header>
  );
}
