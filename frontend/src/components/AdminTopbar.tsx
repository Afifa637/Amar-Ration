import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

export default function AdminTopbar({
  onMenuToggle,
}: {
  onMenuToggle?: () => void;
}) {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    auth?.logout();
    navigate("/");
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
              অ্যাডমিন কন্ট্রোল প্যানেল
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/settings")}
            className="hidden md:block text-[12px] opacity-90 text-right hover:opacity-100"
            title="অ্যাকাউন্ট সেটিংস"
          >
            <div>
              ব্যবহারকারী:{" "}
              <span className="font-semibold">
                {auth?.user?.name || "অ্যাডমিন"}
              </span>
            </div>
            <div className="mt-1">
              <span className="text-[11px] bg-white/15 px-2 py-0.5 rounded">
                কেন্দ্রীয় প্রশাসক
              </span>
            </div>
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
