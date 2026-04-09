import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import AdminTopbar from "../components/AdminTopbar";

const TOPBAR_H = 64;
const SIDEBAR_W = 320;

export default function AdminLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#eef1f5]">
      <div
        className="fixed top-0 left-0 right-0 z-50"
        style={{ height: TOPBAR_H }}
      >
        <AdminTopbar onMenuToggle={() => setMenuOpen((prev) => !prev)} />
      </div>

      <aside
        className="fixed left-0 z-40 bg-[#0d2b3a] text-white hidden md:block"
        style={{
          top: TOPBAR_H,
          width: SIDEBAR_W,
          height: `calc(100vh - ${TOPBAR_H}px)`,
        }}
      >
        <AdminSidebar />
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`fixed left-0 z-50 bg-[#0d2b3a] text-white md:hidden transition-transform duration-200 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          top: TOPBAR_H,
          width: SIDEBAR_W,
          height: `calc(100vh - ${TOPBAR_H}px)`,
        }}
      >
        <AdminSidebar />
      </aside>

      <main
        className="min-h-screen md:pl-80"
        style={{
          paddingTop: TOPBAR_H,
        }}
      >
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
