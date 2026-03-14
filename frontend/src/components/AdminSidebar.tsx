import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getAdminCardsSummary, getAdminSummary } from "../services/api";

const navItem =
  "flex items-center gap-3 px-4 py-3 rounded-lg transition hover:bg-white/10";
const activeItem = "bg-white/15";

const adminLinks = [
  { to: "/admin/dashboard", icon: "📊", label: "অ্যাডমিন ড্যাশবোর্ড" },
  {
    to: "/admin/distributors",
    icon: "🏪",
    label: "ডিস্ট্রিবিউটর ম্যানেজমেন্ট",
  },
  {
    to: "/admin/consumers",
    icon: "👨‍👩‍👧",
    label: "কনজিউমার ও ফ্যামিলি ভেরিফিকেশন",
  },
  { to: "/admin/cards", icon: "🪪", label: "OMS কার্ড ও QR কন্ট্রোল" },
  {
    to: "/admin/distribution",
    icon: "🎫",
    label: "টোকেন ও ডিস্ট্রিবিউশন কন্ট্রোল",
  },
  { to: "/admin/audit", icon: "🛡️", label: "অডিট, ফ্রড ও ব্ল্যাকলিস্ট" },
  { to: "/admin/reports", icon: "📑", label: "রিপোর্ট ও রিকনসিলিয়েশন" },
  { to: "/admin/settings", icon: "⚙️", label: "সিস্টেম সেটিংস" },
];

export default function AdminSidebar() {
  const [pending, setPending] = useState(0);
  const [qrRevoked, setQrRevoked] = useState(0);
  const [alerts, setAlerts] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [summary, cards] = await Promise.all([
          getAdminSummary(),
          getAdminCardsSummary(),
        ]);
        setPending(summary.stats.pendingDistributors || 0);
        setAlerts(summary.stats.auditAlerts || 0);
        setQrRevoked(cards.inactiveRevoked || 0);
      } catch {
        // ignore sidebar errors
      }
    };

    void load();
  }, []);

  return (
    <div className="h-full p-3 flex flex-col">
      <div className="px-3 py-2 border-b border-white/10 mb-3">
        <div className="text-[13px] opacity-90">অ্যাডমিন মেনু</div>
      </div>

      <nav className="space-y-1">
        {adminLinks.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${navItem} ${isActive ? activeItem : ""}`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-4 border-t border-white/10 pt-3">
        <div className="text-[12px] opacity-90 px-3 mb-2">দ্রুত অবস্থা</div>

        <div className="px-3 space-y-2 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="opacity-90">অপেক্ষমান ডিস্ট্রিবিউটর</span>
            <span className="font-semibold">{pending}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-90">নিষ্ক্রিয়/বাতিল QR</span>
            <span className="font-semibold text-[#ffb4b4]">{qrRevoked}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-90">অডিট এলার্ট</span>
            <span className="font-semibold">{alerts}</span>
          </div>
        </div>

        <div className="px-3 mt-3 text-[12px] opacity-90">
          সিস্টেম স্ট্যাটাস:{" "}
          <span className="font-semibold text-[#c7f9cc]">সক্রিয়</span>
        </div>
      </div>
    </div>
  );
}
