import { NavLink } from "react-router-dom";

const navItem =
  "flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-white/10";
const activeItem = "bg-white/15";

export default function Sidebar() {
  return (
    <div className="h-full p-3 flex flex-col">
      <div className="px-3 py-2 border-b border-white/10 mb-3">
        <div className="text-[13px] opacity-90">মেনু</div>
      </div>

      <nav className="space-y-1">
        <NavLink to="/dashboard" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`}>
          <span>📊</span><span>ড্যাশবোর্ড</span>
        </NavLink>

        <NavLink to="/beneficiaries" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`}>
          <span>👥</span><span>উপকারভোগী</span>
        </NavLink>

        <NavLink to="/cards" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`}>
          <span>🪪</span><span>OMS কার্ড/টোকেন</span>
        </NavLink>

        <NavLink to="/stock" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`}>
          <span>📦</span><span>স্টক ও বিতরণ</span>
        </NavLink>

        <NavLink to="/audit" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`}>
          <span>📝</span><span>অডিট লগ</span>
        </NavLink>

        <NavLink to="/reports" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`}>
          <span>📄</span><span>রিপোর্ট</span>
        </NavLink>

        <NavLink to="/monitoring" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`}>
          <span>🛰️</span><span>মনিটরিং</span>
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`}>
          <span>⚙️</span><span>সেটিংস</span>
        </NavLink>

        <NavLink to="/help" className={({ isActive }) => `${navItem} ${isActive ? activeItem : ""}`}>
          <span>❓</span><span>সহায়তা</span>
        </NavLink>
      </nav>

      {/* Quick panel */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="text-[12px] opacity-90 px-3 mb-2">দ্রুত তথ্য</div>

        <div className="px-3 space-y-2 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="opacity-90">আজ স্ক্যান</span>
            <span className="font-semibold">৩৮</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-90">মিসম্যাচ</span>
            <span className="font-semibold text-[#ffb4b4]">১</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-90">অফলাইন কিউ</span>
            <span className="font-semibold">০</span>
          </div>
        </div>

        <div className="px-3 mt-3 text-[12px] opacity-90">
          স্ট্যাটাস: <span className="font-semibold text-[#c7f9cc]">অনলাইন</span>
        </div>
      </div>
    </div>
  );
}
