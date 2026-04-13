import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

const TOPBAR_H = 64;
const SIDEBAR_W = 256;

export default function DistributorLayout() {
  const location = useLocation();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const menuOpen = openPath === location.pathname;

  return (
    <div className="h-screen overflow-hidden bg-[#eef1f5]">
      <div
        className="fixed top-0 left-0 right-0 z-50"
        style={{ height: TOPBAR_H }}
      >
        <Topbar
          onMenuToggle={() =>
            setOpenPath((prev) =>
              prev === location.pathname ? null : location.pathname,
            )
          }
        />
      </div>

      <aside
        className="fixed left-0 z-40 bg-[#0d2b3a] text-white hidden md:block overflow-y-auto"
        style={{
          top: TOPBAR_H,
          width: SIDEBAR_W,
          height: `calc(100vh - ${TOPBAR_H}px)`,
        }}
      >
        <Sidebar />
      </aside>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/35 md:hidden"
          onClick={() => setOpenPath(null)}
          aria-label="Close menu"
        />
      )}

      <aside
        className={`fixed left-0 z-50 bg-[#0d2b3a] text-white md:hidden transition-transform duration-200 overflow-y-auto ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          top: TOPBAR_H,
          width: SIDEBAR_W,
          height: `calc(100vh - ${TOPBAR_H}px)`,
        }}
      >
        <Sidebar />
      </aside>

      <main
        className="h-screen overflow-y-auto md:pl-64"
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
