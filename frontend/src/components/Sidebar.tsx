import { Link, useLocation } from "react-router-dom";

const items = [
  { label: "ড্যাশবোর্ড", icon: "📊", to: "/dashboard" },
  { label: "উপকারভোগী", icon: "👥", to: "#" },
  { label: "কার্ড/টোকেন", icon: "🪪", to: "#" },
  { label: "স্টক ও বিতরণ", icon: "📦", to: "#" },
  { label: "অডিট লগ", icon: "📝", to: "#" },
  { label: "সেটিংস", icon: "⚙️", to: "#" },
];

export default function SideNav() {
  const { pathname } = useLocation();

  return (
    <aside className="w-[265px] bg-[#0d2b3a] text-white min-h-[calc(100vh-88px)]">
      <div className="px-4 py-3 border-b border-white/10">
        <div className="text-[13px] opacity-90">মেনু</div>
      </div>

      <nav className="p-3 space-y-1">
        {items.map((it) => {
          const active = it.to !== "#" && pathname === it.to;

          const cls =
            "flex items-center gap-3 px-3 py-2 rounded " +
            (active
              ? "bg-white/15"
              : "hover:bg-white/10");

          if (it.to === "#") {
            return (
              <a key={it.label} href="#" className={cls}>
                <span>{it.icon}</span>
                <span className="text-[14px]">{it.label}</span>
              </a>
            );
          }

          return (
            <Link key={it.label} to={it.to} className={cls}>
              <span>{it.icon}</span>
              <span className="text-[14px]">{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
