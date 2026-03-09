import { Outlet } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import AdminTopbar from "../components/AdminTopbar";

const TOPBAR_H = 88;
const SIDEBAR_W = 320;

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#eef1f5]">
      <div className="fixed top-0 left-0 right-0 z-50" style={{ height: TOPBAR_H }}>
        <AdminTopbar />
      </div>

      <aside
        className="fixed left-0 z-40 bg-[#0d2b3a] text-white"
        style={{
          top: TOPBAR_H,
          width: SIDEBAR_W,
          height: `calc(100vh - ${TOPBAR_H}px)`,
        }}
      >
        <AdminSidebar />
      </aside>

      <main
        className="min-h-screen"
        style={{
          paddingTop: TOPBAR_H,
          paddingLeft: SIDEBAR_W,
        }}
      >
        <div className="p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}